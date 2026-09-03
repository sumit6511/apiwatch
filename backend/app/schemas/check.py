from datetime import datetime

from pydantic import BaseModel

from app.models.enums import MonitorStatus


class CheckOut(BaseModel):
    id: str
    monitor_id: str
    status: MonitorStatus
    http_status: int | None
    response_time_ms: int
    error: str | None
    checked_at: datetime


class ManualCheckResult(BaseModel):
    status: MonitorStatus
    http_status: int | None
    response_time_ms: int
    error: str | None


class MetricPoint(BaseModel):
    timestamp: datetime
    response_time_ms: int
    status: MonitorStatus
    http_status: int | None


class UptimeStats(BaseModel):
    period: str
    uptime_percentage: float | None
    total_checks: int
    successful_checks: int
    failed_checks: int
