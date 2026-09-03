import logging
from datetime import UTC, datetime
from typing import Any

from bson import ObjectId

from app.db.repositories.notifications import NotificationRepository
from app.errors import NotificationFailedError, NotificationNotFoundError
from app.models.enums import NotificationType
from app.notifications.base import NotificationEvent, NotificationEventType, NotificationProvider
from app.notifications.discord import DiscordWebhookProvider
from app.schemas.notification import (
    NotificationChannelCreate,
    NotificationChannelOut,
    NotificationChannelUpdate,
)
from app.security import decrypt_secret, encrypt_secret, mask_webhook_url

logger = logging.getLogger("apiwatch.notifications")


class NotificationService:
    def __init__(self, repo: NotificationRepository):
        self._repo = repo
        self._providers: dict[NotificationType, NotificationProvider] = {
            NotificationType.DISCORD: DiscordWebhookProvider(),
        }

    def _to_out(self, doc: dict[str, Any]) -> NotificationChannelOut:
        plaintext = decrypt_secret(doc["webhook_url_encrypted"])
        return NotificationChannelOut(
            id=str(doc["_id"]),
            type=doc["type"],
            name=doc["name"],
            webhook_url_masked=mask_webhook_url(plaintext),
            enabled=doc["enabled"],
            created_at=doc["created_at"],
        )

    async def list_all(self, owner_id: str) -> list[NotificationChannelOut]:
        docs = await self._repo.list_all(owner_id)
        return [self._to_out(d) for d in docs]

    async def create(self, data: NotificationChannelCreate, owner_id: str) -> NotificationChannelOut:
        document = {
            "owner_id": ObjectId(owner_id),
            "type": data.type,
            "name": data.name,
            "webhook_url_encrypted": encrypt_secret(data.webhook_url),
            "enabled": data.enabled,
            "created_at": datetime.now(UTC),
        }
        created = await self._repo.create(document)
        logger.info("notification_channel_created id=%s owner_id=%s type=%s", created["_id"], owner_id, data.type)
        return self._to_out(created)

    async def update(
        self, channel_id: str, owner_id: str, data: NotificationChannelUpdate
    ) -> NotificationChannelOut:
        existing = await self._repo.get(channel_id, owner_id)
        if existing is None:
            raise NotificationNotFoundError()

        fields: dict[str, Any] = {}
        if data.name is not None:
            fields["name"] = data.name
        if data.webhook_url is not None:
            fields["webhook_url_encrypted"] = encrypt_secret(data.webhook_url)
        if data.enabled is not None:
            fields["enabled"] = data.enabled

        updated = await self._repo.update(channel_id, owner_id, fields) if fields else existing
        logger.info("notification_channel_updated id=%s owner_id=%s", channel_id, owner_id)
        return self._to_out(updated)

    async def delete(self, channel_id: str, owner_id: str) -> None:
        deleted = await self._repo.delete(channel_id, owner_id)
        if not deleted:
            raise NotificationNotFoundError()
        logger.info("notification_channel_deleted id=%s owner_id=%s", channel_id, owner_id)

    async def test(self, channel_id: str, owner_id: str) -> None:
        doc = await self._repo.get(channel_id, owner_id)
        if doc is None:
            raise NotificationNotFoundError()

        provider = self._providers[NotificationType(doc["type"])]
        webhook_url = decrypt_secret(doc["webhook_url_encrypted"])
        event = NotificationEvent(
            event_type=NotificationEventType.TEST,
            monitor_name="APIWatch",
            monitor_url="",
        )
        try:
            await provider.send(webhook_url, event)
        except NotificationFailedError:
            logger.warning("notification_test_failed id=%s", channel_id)
            raise
        logger.info("notification_test_sent id=%s", channel_id)

    async def send_to_channels(self, channel_ids: list[str], event: NotificationEvent) -> None:
        """Best-effort fan-out: a failure on one channel must not affect others
        or the monitoring pipeline that triggered this. No owner_id here --
        called from the background checker with channel ids that were already
        validated to belong to the monitor's owner when the monitor was saved
        (see MonitorService._validate_notification_channel_ids)."""
        if not channel_ids:
            return
        channels = await self._repo.list_enabled_by_ids(channel_ids)
        for channel in channels:
            provider = self._providers.get(NotificationType(channel["type"]))
            if provider is None:
                continue
            try:
                webhook_url = decrypt_secret(channel["webhook_url_encrypted"])
                await provider.send(webhook_url, event)
                logger.info(
                    "notification_sent channel_id=%s event=%s", channel["_id"], event.event_type
                )
            except Exception:
                logger.warning(
                    "notification_send_failed channel_id=%s event=%s", channel["_id"], event.event_type
                )
