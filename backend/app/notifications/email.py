import logging

import httpx

from app.config import get_settings
from app.errors import NotificationFailedError
from app.notifications.base import NotificationEvent, NotificationEventType, NotificationProvider
from app.notifications.formatting import format_duration

logger = logging.getLogger("apiwatch.notifications")

RESEND_API_URL = "https://api.resend.com/emails"


def _format_timestamp(value) -> str:
    return value.strftime("%B %d, %Y %H:%M:%S") if value else "unknown"


def _build_email(event: NotificationEvent) -> tuple[str, str]:
    """Returns (subject, plain-text body)."""
    if event.event_type == NotificationEventType.OUTAGE:
        subject = f"\U0001f6a8 APIWatch Alert: {event.monitor_name} is DOWN"
        body = (
            f"{event.monitor_name} is DOWN\n\n"
            f"URL: {event.monitor_url}\n"
            f"Reason: {event.reason or 'Unknown'}\n"
            f"Detected: {_format_timestamp(event.detected_at)}\n"
        )
        return subject, body
    if event.event_type == NotificationEventType.RECOVERY:
        subject = f"✅ APIWatch Recovery: {event.monitor_name} is back UP"
        body = (
            f"{event.monitor_name} is back UP\n\n"
            f"Downtime: {format_duration(event.downtime_seconds or 0)}\n"
            f"Recovered: {_format_timestamp(event.recovered_at)}\n"
        )
        return subject, body
    return (
        "APIWatch Test Notification",
        "This is a test notification from APIWatch. If you can see this, your email channel is configured correctly.\n",
    )


class EmailProvider(NotificationProvider):
    """Sends via the Resend HTTP API rather than SMTP -- see config.py for
    why. `config` only ever needs the recipient; the sender identity and
    API key are one shared deployment-wide setting, not per-channel."""

    async def send(self, config: dict[str, str], event: NotificationEvent) -> None:
        settings = get_settings()
        if not settings.resend_api_key or not settings.resend_from_email:
            raise NotificationFailedError(
                "Email notifications aren't configured on this server (RESEND_API_KEY/RESEND_FROM_EMAIL missing)."
            )

        subject, body = _build_email(event)
        payload = {
            "from": settings.resend_from_email,
            "to": [config["to_email"]],
            "subject": subject,
            "text": body,
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    RESEND_API_URL,
                    json=payload,
                    headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                )
        except httpx.HTTPError as exc:
            logger.warning("email_notification_failed error=%s", type(exc).__name__)
            raise NotificationFailedError("Could not reach the Resend API.") from exc

        if response.status_code >= 400:
            # Resend's error body has a human-readable `message` -- surface
            # it, since it usually says exactly what's wrong (bad API key,
            # unverified sender domain, recipient not allowed in test mode).
            try:
                detail = response.json().get("message", "")
            except ValueError:
                detail = ""
            logger.warning("email_notification_rejected status=%s detail=%s", response.status_code, detail)
            raise NotificationFailedError(
                "Resend rejected the email" + (f": {detail}" if detail else f" (HTTP {response.status_code}).")
            )

        logger.info("email_notification_sent event=%s", event.event_type)
