from datetime import UTC
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user_id, get_incident_service, get_monitor_service
from app.schemas.incident import IncidentOut
from app.services.incident_service import IncidentService
from app.services.monitor_service import MonitorService

router = APIRouter(tags=["incidents"])


def _duration_seconds(incident: dict[str, Any]) -> int | None:
    if incident.get("resolved_at") is None:
        return None
    started = incident["started_at"]
    resolved = incident["resolved_at"]
    if started.tzinfo is None:
        started = started.replace(tzinfo=UTC)
    if resolved.tzinfo is None:
        resolved = resolved.replace(tzinfo=UTC)
    return int((resolved - started).total_seconds())


def _to_out(incident: dict[str, Any], monitor_name: str | None = None) -> IncidentOut:
    return IncidentOut(
        id=str(incident["_id"]),
        monitor_id=str(incident["monitor_id"]),
        monitor_name=monitor_name,
        status=incident["status"],
        reason=incident["reason"],
        started_at=incident["started_at"],
        resolved_at=incident.get("resolved_at"),
        duration_seconds=_duration_seconds(incident),
    )


@router.get("/api/monitors/{monitor_id}/incidents", response_model=list[IncidentOut])
async def list_monitor_incidents(
    monitor_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    incidents: IncidentService = Depends(get_incident_service),
    monitors: MonitorService = Depends(get_monitor_service),
    user_id: str = Depends(get_current_user_id),
) -> list[IncidentOut]:
    # Raises MonitorNotFoundError (404) if this monitor isn't the caller's --
    # list_for_monitor() itself isn't owner-scoped, so this check is what
    # actually keeps one account from reading another's incident history.
    await monitors.get(monitor_id, user_id)
    docs = await incidents.list_for_monitor(monitor_id, limit)
    return [_to_out(d) for d in docs]


@router.get("/api/incidents", response_model=list[IncidentOut])
async def list_all_incidents(
    limit: int = Query(default=100, ge=1, le=500),
    incidents: IncidentService = Depends(get_incident_service),
    monitors: MonitorService = Depends(get_monitor_service),
    user_id: str = Depends(get_current_user_id),
) -> list[IncidentOut]:
    docs = await incidents.list_all(user_id, limit)
    if not docs:
        return []

    monitor_ids = {str(d["monitor_id"]) for d in docs}
    names: dict[str, str] = {}
    for monitor_id in monitor_ids:
        name = await monitors.get_name(monitor_id, user_id)
        names[monitor_id] = name or "Unknown monitor"

    return [_to_out(d, monitor_name=names.get(str(d["monitor_id"]))) for d in docs]
