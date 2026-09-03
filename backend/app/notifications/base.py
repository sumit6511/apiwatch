from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


class NotificationEventType(StrEnum):
    OUTAGE = "outage"
    RECOVERY = "recovery"
    TEST = "test"


@dataclass(frozen=True)
class NotificationEvent:
    event_type: NotificationEventType
    monitor_name: str
    monitor_url: str
    reason: str | None = None
    detected_at: datetime | None = None
    recovered_at: datetime | None = None
    downtime_seconds: int | None = None


class NotificationProvider(ABC):
    """Extensibility point for alert channels. Add Email/Slack/Telegram/etc.
    by implementing this interface -- nothing else in the codebase should
    need to change."""

    @abstractmethod
    async def send(self, webhook_url: str, event: NotificationEvent) -> None:
        """Deliver `event`. Should raise NotificationFailedError on failure."""
        raise NotImplementedError
