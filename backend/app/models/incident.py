from datetime import datetime

from pydantic import BaseModel, Field

from app.models.common import PyObjectId
from app.models.enums import IncidentStatus


class IncidentDocument(BaseModel):
    """Shape of a document in the `incidents` collection."""

    id: PyObjectId = Field(alias="_id")
    monitor_id: PyObjectId
    status: IncidentStatus
    reason: str
    started_at: datetime
    resolved_at: datetime | None = None

    model_config = {"populate_by_name": True}
