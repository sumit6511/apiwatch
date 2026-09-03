from fastapi import APIRouter, Depends, status

from app.dependencies import get_check_service, get_current_user_id, get_monitor_service
from app.schemas.check import ManualCheckResult
from app.schemas.monitor import MonitorCreate, MonitorOut, MonitorTestRequest, MonitorUpdate
from app.services.check_service import CheckService
from app.services.monitor_service import MonitorService

router = APIRouter(prefix="/api/monitors", tags=["monitors"])


@router.post("/test-request", response_model=ManualCheckResult)
async def test_request(
    payload: MonitorTestRequest,
    checks: CheckService = Depends(get_check_service),
    _user_id: str = Depends(get_current_user_id),
) -> ManualCheckResult:
    """Ad-hoc probe used by the create-monitor form's "Test Request" button
    (section 67). Registered before /{monitor_id} so it is never shadowed by
    the dynamic path."""
    return await checks.test_request(payload)


@router.get("", response_model=list[MonitorOut])
async def list_monitors(
    monitors: MonitorService = Depends(get_monitor_service),
    user_id: str = Depends(get_current_user_id),
) -> list[MonitorOut]:
    return await monitors.list_all(user_id)


@router.post("", response_model=MonitorOut, status_code=status.HTTP_201_CREATED)
async def create_monitor(
    payload: MonitorCreate,
    monitors: MonitorService = Depends(get_monitor_service),
    user_id: str = Depends(get_current_user_id),
) -> MonitorOut:
    return await monitors.create(payload, user_id)


@router.get("/{monitor_id}", response_model=MonitorOut)
async def get_monitor(
    monitor_id: str,
    monitors: MonitorService = Depends(get_monitor_service),
    user_id: str = Depends(get_current_user_id),
) -> MonitorOut:
    return await monitors.get(monitor_id, user_id)


@router.patch("/{monitor_id}", response_model=MonitorOut)
async def update_monitor(
    monitor_id: str,
    payload: MonitorUpdate,
    monitors: MonitorService = Depends(get_monitor_service),
    user_id: str = Depends(get_current_user_id),
) -> MonitorOut:
    return await monitors.update(monitor_id, user_id, payload)


@router.delete("/{monitor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_monitor(
    monitor_id: str,
    monitors: MonitorService = Depends(get_monitor_service),
    user_id: str = Depends(get_current_user_id),
) -> None:
    await monitors.delete(monitor_id, user_id)


@router.post("/{monitor_id}/check", response_model=ManualCheckResult)
async def run_manual_check(
    monitor_id: str,
    checks: CheckService = Depends(get_check_service),
    user_id: str = Depends(get_current_user_id),
) -> ManualCheckResult:
    return await checks.run_manual_check(monitor_id, user_id)


@router.post("/{monitor_id}/pause", response_model=MonitorOut)
async def pause_monitor(
    monitor_id: str,
    monitors: MonitorService = Depends(get_monitor_service),
    user_id: str = Depends(get_current_user_id),
) -> MonitorOut:
    return await monitors.pause(monitor_id, user_id)


@router.post("/{monitor_id}/resume", response_model=MonitorOut)
async def resume_monitor(
    monitor_id: str,
    monitors: MonitorService = Depends(get_monitor_service),
    user_id: str = Depends(get_current_user_id),
) -> MonitorOut:
    return await monitors.resume(monitor_id, user_id)
