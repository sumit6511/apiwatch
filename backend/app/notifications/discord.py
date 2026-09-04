import logging

import httpx

from app.errors import NotificationFailedError
from app.notifications.base import NotificationEvent, NotificationEventType, NotificationProvider
from app.notifications.formatting import format_duration

logger = logging.getLogger("apiwatch.notifications")

COLOR_DANGER = 0xE5484D
COLOR_SUCCESS = 0x30A46C
COLOR_INFO = 0x5B8DEF


def _build_payload(event: NotificationEvent) -> dict:
    if event.event_type == NotificationEventType.OUTAGE:
        return {
            "embeds": [
                {
                    "title": "\U0001f6a8 APIWatch Alert",
                    "description": f"**{event.monitor_name}** is DOWN",
                    "color": COLOR_DANGER,
                    "fields": [
                        {"name": "URL", "value": event.monitor_url, "inline": False},
                        {"name": "Reason", "value": event.reason or "Unknown", "inline": False},
                    ],
                    "timestamp": event.detected_at.isoformat() if event.detected_at else None,
                }
            ]
        }
    if event.event_type == NotificationEventType.RECOVERY:
        downtime = format_duration(event.downtime_seconds or 0)
        return {
            "embeds": [
                {
                    "title": "✅ APIWatch Recovery",
                    "description": f"**{event.monitor_name}** is back UP",
                    "color": COLOR_SUCCESS,
                    "fields": [
                        {"name": "Downtime", "value": downtime, "inline": False},
                    ],
                    "timestamp": event.recovered_at.isoformat() if event.recovered_at else None,
                }
            ]
        }
    return {
        "embeds": [
            {
                "title": "APIWatch Test Notification",
                "description": "This is a test notification from APIWatch. If you can see this, your webhook is configured correctly.",
                "color": COLOR_INFO,
            }
        ]
    }


class DiscordWebhookProvider(NotificationProvider):
    async def send(self, config: dict[str, str], event: NotificationEvent) -> None:
        webhook_url = config["webhook_url"]
        payload = _build_payload(event)
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(webhook_url, json=payload)
        except httpx.HTTPError as exc:
            logger.warning("discord_notification_failed error=%s", type(exc).__name__)
            raise NotificationFailedError("The Discord webhook could not be reached.") from exc

        if response.status_code >= 400:
            logger.warning("discord_notification_rejected status=%s", response.status_code)
            raise NotificationFailedError(
                f"Discord rejected the notification (HTTP {response.status_code})."
            )

        logger.info("discord_notification_sent event=%s", event.event_type)
