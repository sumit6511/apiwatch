import logging

import httpx

from app.errors import NotificationFailedError
from app.notifications.base import NotificationEvent, NotificationEventType, NotificationProvider
from app.notifications.formatting import format_duration

logger = logging.getLogger("apiwatch.notifications")

TELEGRAM_API_URL = "https://api.telegram.org/bot{token}/sendMessage"


def _format_timestamp(value) -> str:
    return value.strftime("%B %d, %Y %H:%M:%S") if value else "unknown"


def _build_message(event: NotificationEvent) -> str:
    if event.event_type == NotificationEventType.OUTAGE:
        detected = _format_timestamp(event.detected_at)
        return (
            "\U0001f6a8 *APIWatch Alert*\n\n"
            f"*{event.monitor_name}* is DOWN\n\n"
            f"URL:\n{event.monitor_url}\n\n"
            f"Reason:\n{event.reason or 'Unknown'}\n\n"
            f"Detected:\n{detected}"
        )
    if event.event_type == NotificationEventType.RECOVERY:
        recovered = _format_timestamp(event.recovered_at)
        downtime = format_duration(event.downtime_seconds or 0)
        return (
            "✅ *APIWatch Recovery*\n\n"
            f"*{event.monitor_name}* is back UP\n\n"
            f"Downtime:\n{downtime}\n\n"
            f"Recovered:\n{recovered}"
        )
    return (
        "*APIWatch Test Notification*\n\n"
        "This is a test notification from APIWatch. If you can see this, your bot is configured correctly."
    )


class TelegramProvider(NotificationProvider):
    async def send(self, config: dict[str, str], event: NotificationEvent) -> None:
        bot_token = config["bot_token"]
        chat_id = config["chat_id"]
        payload = {"chat_id": chat_id, "text": _build_message(event), "parse_mode": "Markdown"}

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(TELEGRAM_API_URL.format(token=bot_token), json=payload)
        except httpx.HTTPError as exc:
            logger.warning("telegram_notification_failed error=%s", type(exc).__name__)
            raise NotificationFailedError("The Telegram bot could not be reached.") from exc

        if response.status_code >= 400:
            # Telegram's error body has a human-readable `description` --
            # surface it since it usually says exactly what's wrong (bad
            # token, bot not started by the chat, wrong chat_id).
            try:
                detail = response.json().get("description", "")
            except ValueError:
                detail = ""
            logger.warning("telegram_notification_rejected status=%s detail=%s", response.status_code, detail)
            raise NotificationFailedError(
                f"Telegram rejected the notification"
                + (f": {detail}" if detail else f" (HTTP {response.status_code}).")
            )

        logger.info("telegram_notification_sent event=%s", event.event_type)
