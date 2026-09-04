from datetime import datetime

from pydantic import BaseModel, Field

from app.models.common import PyObjectId
from app.models.enums import HttpMethod, MonitorStatus


class MonitorDocument(BaseModel):
    """Shape of a document in the `monitors` collection."""

    id: PyObjectId = Field(alias="_id")
    owner_id: PyObjectId
    name: str
    url: str
    method: HttpMethod = HttpMethod.GET
    headers: dict[str, str] = Field(default_factory=dict)
    body: dict | str | None = None
    interval_seconds: int
    timeout_seconds: int
    expected_status_codes: list[int]

    is_active: bool = True
    current_status: MonitorStatus = MonitorStatus.UNKNOWN

    # Opt-in visibility on the owner's public status page. Only the name and
    # status/uptime are ever shown there -- never the URL, headers, or body.
    is_public: bool = False
    tags: list[str] = Field(default_factory=list)

    # Consecutive counters used by the threshold state machine (reset on transition).
    consecutive_failures: int = 0
    consecutive_successes: int = 0

    # Lifetime counters surfaced in the UI.
    failure_count: int = 0
    success_count: int = 0

    last_checked_at: datetime | None = None
    last_success_at: datetime | None = None
    last_failure_at: datetime | None = None

    open_incident_id: PyObjectId | None = None
    notification_channel_ids: list[str] = Field(default_factory=list)

    created_at: datetime
    updated_at: datetime

    model_config = {"populate_by_name": True}
