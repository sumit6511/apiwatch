import logging
from email.message import EmailMessage

import aiosmtplib

from app.config import get_settings
from app.errors import NotificationFailedError
from app.notifications.base import NotificationEvent, NotificationEventType, NotificationProvider
from app.notifications.formatting import format_duration

logger = logging.getLogger("apiwatch.notifications")


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
    async def send(self, config: dict[str, str], event: NotificationEvent) -> None:
        settings = get_settings()
        if not settings.smtp_host or not settings.smtp_from_email:
            raise NotificationFailedError(
                "Email notifications aren't configured on this server (SMTP_HOST/SMTP_FROM_EMAIL missing)."
            )

        subject, body = _build_email(event)
        message = EmailMessage()
        message["From"] = settings.smtp_from_email
        message["To"] = config["to_email"]
        message["Subject"] = subject
        message.set_content(body)

        try:
            await aiosmtplib.send(
                message,
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_username or None,
                password=settings.smtp_password or None,
                start_tls=True,
                timeout=10,
            )
        except aiosmtplib.SMTPException as exc:
            logger.warning("email_notification_failed error=%s", type(exc).__name__)
            raise NotificationFailedError(f"Could not send email: {exc}") from exc
        except OSError as exc:
            logger.warning("email_notification_connect_failed error=%s", type(exc).__name__)
            raise NotificationFailedError("Could not connect to the SMTP server.") from exc

        logger.info("email_notification_sent event=%s", event.event_type)
