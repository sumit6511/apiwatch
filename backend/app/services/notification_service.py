import json
import logging
from datetime import UTC, datetime
from typing import Any

from bson import ObjectId

from app.db.repositories.notifications import NotificationRepository
from app.errors import NotificationFailedError, NotificationNotFoundError
from app.models.enums import NotificationType
from app.notifications.base import NotificationEvent, NotificationEventType, NotificationProvider
from app.notifications.discord import DiscordWebhookProvider
from app.notifications.email import EmailProvider
from app.notifications.telegram import TelegramProvider
from app.schemas.notification import (
    NotificationChannelCreate,
    NotificationChannelOut,
    NotificationChannelUpdate,
)
from app.security import decrypt_secret, encrypt_secret, mask_channel_config

logger = logging.getLogger("apiwatch.notifications")


def _encrypt_config(config: dict[str, str]) -> str:
    return encrypt_secret(json.dumps(config))


def _decrypt_config(config_encrypted: str) -> dict[str, str]:
    return json.loads(decrypt_secret(config_encrypted))


class NotificationService:
    def __init__(self, repo: NotificationRepository):
        self._repo = repo
        self._providers: dict[NotificationType, NotificationProvider] = {
            NotificationType.DISCORD: DiscordWebhookProvider(),
            NotificationType.TELEGRAM: TelegramProvider(),
            NotificationType.EMAIL: EmailProvider(),
        }

    def _to_out(self, doc: dict[str, Any]) -> NotificationChannelOut:
        channel_type = NotificationType(doc["type"])
        config = _decrypt_config(doc["config_encrypted"])
        return NotificationChannelOut(
            id=str(doc["_id"]),
            type=channel_type,
            name=doc["name"],
            target_masked=mask_channel_config(channel_type, config),
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
            "config_encrypted": _encrypt_config(data.to_config()),
            "enabled": data.enabled,
            "created_at": datetime.now(UTC),
        }
        created = await self._repo.create(document)
        logger.info("notification_channel_created id=%s owner_id=%s type=%s", created["_id"], owner_id, data.type)
        return self._to_out(created)

    def _merge_config(self, channel_type: NotificationType, existing: dict[str, str], data: NotificationChannelUpdate) -> dict[str, str] | None:
        """Returns a new config dict if any type-specific field was provided,
        else None (meaning: leave the stored config untouched)."""
        merged = dict(existing)
        touched = False

        if channel_type == NotificationType.DISCORD and data.webhook_url is not None:
            merged["webhook_url"] = data.webhook_url
            touched = True
        elif channel_type == NotificationType.TELEGRAM:
            if data.bot_token is not None:
                merged["bot_token"] = data.bot_token.strip()
                touched = True
            if data.chat_id is not None:
                merged["chat_id"] = data.chat_id.strip()
                touched = True
        elif channel_type == NotificationType.EMAIL and data.to_email is not None:
            merged["to_email"] = str(data.to_email)
            touched = True

        return merged if touched else None

    async def update(
        self, channel_id: str, owner_id: str, data: NotificationChannelUpdate
    ) -> NotificationChannelOut:
        existing = await self._repo.get(channel_id, owner_id)
        if existing is None:
            raise NotificationNotFoundError()

        channel_type = NotificationType(existing["type"])
        fields: dict[str, Any] = {}
        if data.name is not None:
            fields["name"] = data.name
        if data.enabled is not None:
            fields["enabled"] = data.enabled

        merged_config = self._merge_config(channel_type, _decrypt_config(existing["config_encrypted"]), data)
        if merged_config is not None:
            fields["config_encrypted"] = _encrypt_config(merged_config)

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
        config = _decrypt_config(doc["config_encrypted"])
        event = NotificationEvent(
            event_type=NotificationEventType.TEST,
            monitor_name="APIWatch",
            monitor_url="",
        )
        try:
            await provider.send(config, event)
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
                config = _decrypt_config(channel["config_encrypted"])
                await provider.send(config, event)
                logger.info(
                    "notification_sent channel_id=%s event=%s", channel["_id"], event.event_type
                )
            except Exception:
                logger.warning(
                    "notification_send_failed channel_id=%s event=%s", channel["_id"], event.event_type
                )
