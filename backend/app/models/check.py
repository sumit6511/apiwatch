from datetime import datetime

from pydantic import BaseModel, Field

from app.models.common import PyObjectId
from app.models.enums import MonitorStatus


class CheckDocument(BaseModel):
    """Shape of a document in the `checks` collection."""

    id: PyObjectId = Field(alias="_id")
    monitor_id: PyObjectId
    status: MonitorStatus
    http_status: int | None
    response_time_ms: int
    error: str | None = None
    checked_at: datetime

    model_config = {"populate_by_name": True}
