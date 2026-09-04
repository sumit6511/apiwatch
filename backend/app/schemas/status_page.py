from datetime import datetime

from pydantic import BaseModel

from app.models.enums import MonitorStatus


class PublicCheckPoint(BaseModel):
    """A single recent check, trimmed for public display -- no http_status
    or error detail, which could hint at the underlying implementation."""

    timestamp: datetime
    status: MonitorStatus
    response_time_ms: int


class PublicMonitorStatus(BaseModel):
    """A public-facing monitor summary. Deliberately excludes the target
    URL, headers, body, and notification config -- only the owner-chosen
    name and status/uptime are ever shown here."""

    name: str
    status: MonitorStatus
    uptime_24h: float | None
    uptime_7d: float | None
    uptime_30d: float | None
    last_checked_at: datetime | None
    recent_checks: list[PublicCheckPoint]


class PublicStatusPage(BaseModel):
    overall_status: MonitorStatus
    monitors: list[PublicMonitorStatus]
    generated_at: datetime


class StatusPageSlugOut(BaseModel):
    slug: str
