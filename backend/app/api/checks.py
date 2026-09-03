from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_check_service, get_current_user_id, get_metrics_service
from app.schemas.check import CheckOut, MetricPoint, UptimeStats
from app.services.check_service import CheckService
from app.services.metrics_service import MetricsService

router = APIRouter(prefix="/api/monitors", tags=["checks"])
dashboard_router = APIRouter(prefix="/api/dashboard", tags=["metrics"])


@router.get("/{monitor_id}/checks", response_model=list[CheckOut])
async def list_checks(
    monitor_id: str,
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    checks: CheckService = Depends(get_check_service),
    user_id: str = Depends(get_current_user_id),
) -> list[CheckOut]:
    return await checks.list_checks(monitor_id, user_id, from_dt=from_, to_dt=to, limit=limit)


@router.get("/{monitor_id}/metrics", response_model=list[MetricPoint])
async def get_metrics(
    monitor_id: str,
    period: str = Query(default="24h", pattern="^(24h|7d|30d)$"),
    metrics: MetricsService = Depends(get_metrics_service),
    user_id: str = Depends(get_current_user_id),
) -> list[MetricPoint]:
    return await metrics.get_metrics(monitor_id, user_id, period)


@router.get("/{monitor_id}/uptime", response_model=UptimeStats)
async def get_uptime(
    monitor_id: str,
    period: str = Query(default="24h", pattern="^(24h|7d|30d)$"),
    metrics: MetricsService = Depends(get_metrics_service),
    user_id: str = Depends(get_current_user_id),
) -> UptimeStats:
    return await metrics.get_uptime(monitor_id, user_id, period)


@dashboard_router.get("/summary")
async def get_dashboard_summary(
    metrics: MetricsService = Depends(get_metrics_service),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """Real, dynamically-computed dashboard totals (section 27) -- never
    hardcoded sample numbers."""
    return await metrics.get_dashboard_summary(user_id)
