from datetime import UTC, datetime, timedelta
from typing import Any

from app.db.repositories.checks import CheckRepository
from app.db.repositories.monitors import MonitorRepository
from app.errors import AppError, MonitorNotFoundError
from app.schemas.check import MetricPoint, UptimeStats

PERIODS: dict[str, timedelta] = {
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
}

MAX_METRIC_POINTS = 2000


def _period_delta(period: str) -> timedelta:
    if period not in PERIODS:
        raise AppError("INVALID_PERIOD", "Period must be one of: 24h, 7d, 30d.", 422)
    return PERIODS[period]


class MetricsService:
    def __init__(self, check_repo: CheckRepository, monitor_repo: MonitorRepository):
        self._check_repo = check_repo
        self._monitor_repo = monitor_repo

    async def get_metrics(self, monitor_id: str, owner_id: str, period: str) -> list[MetricPoint]:
        monitor = await self._monitor_repo.get(monitor_id, owner_id)
        if monitor is None:
            raise MonitorNotFoundError()

        since = datetime.now(UTC) - _period_delta(period)
        docs = await self._check_repo.list_for_monitor(
            monitor_id, from_dt=since, limit=MAX_METRIC_POINTS
        )
        docs.reverse()  # chronological order for charting
        return [
            MetricPoint(
                timestamp=d["checked_at"],
                response_time_ms=d["response_time_ms"],
                status=d["status"],
                http_status=d.get("http_status"),
            )
            for d in docs
        ]

    async def get_uptime(self, monitor_id: str, owner_id: str, period: str) -> UptimeStats:
        monitor = await self._monitor_repo.get(monitor_id, owner_id)
        if monitor is None:
            raise MonitorNotFoundError()

        since = datetime.now(UTC) - _period_delta(period)
        stats = await self._check_repo.uptime_stats(monitor_id, since)
        total = stats["total"]
        successful = stats["successful"]
        percentage = round((successful / total) * 100, 2) if total > 0 else None
        return UptimeStats(
            period=period,
            uptime_percentage=percentage,
            total_checks=total,
            successful_checks=successful,
            failed_checks=total - successful,
        )

    async def get_dashboard_summary(self, owner_id: str) -> dict[str, Any]:
        total = await self._monitor_repo.total_count(owner_id)
        counts = await self._monitor_repo.count_by_status(owner_id)

        since_24h = datetime.now(UTC) - timedelta(hours=24)
        global_stats = await self._check_repo.global_uptime_stats(owner_id, since_24h)
        total_checks = global_stats["total"]
        successful = global_stats["successful"]
        overall_uptime = round((successful / total_checks) * 100, 2) if total_checks > 0 else None

        return {
            "total_monitors": total,
            "operational": counts.get("UP", 0),
            "down": counts.get("DOWN", 0),
            "paused": counts.get("PAUSED", 0),
            "unknown": counts.get("UNKNOWN", 0),
            "overall_uptime_percentage": overall_uptime,
        }
