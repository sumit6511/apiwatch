from datetime import datetime

from pydantic import BaseModel

from app.models.enums import IncidentStatus


class IncidentOut(BaseModel):
    id: str
    monitor_id: str
    monitor_name: str | None = None
    status: IncidentStatus
    reason: str
    started_at: datetime
    resolved_at: datetime | None
    duration_seconds: int | None = None
