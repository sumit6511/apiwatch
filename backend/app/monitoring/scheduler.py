"""SchedulerManager: owns the APScheduler instance and the mapping from
monitor -> scheduled job. One job per active monitor, keyed by a stable
`monitor:<id>` job id so create/update/pause/resume/delete never produce
duplicate jobs (spec section 19).

IMPORTANT (section 21): APScheduler runs in-process with an in-memory job
store. Do not run more than one replica of this backend with
ENABLE_SCHEDULER=true, or checks will be duplicated. See README "Scheduler
Architecture".
"""

import logging
from typing import Any, Awaitable, Callable

from apscheduler.executors.asyncio import AsyncIOExecutor
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.monitoring.checker import MonitorChecker

logger = logging.getLogger("apiwatch.scheduler")

RETENTION_JOB_ID = "retention-cleanup"


def _job_id(monitor_id: str) -> str:
    return f"monitor:{monitor_id}"


class SchedulerManager:
    def __init__(self, checker: MonitorChecker, monitor_repo):
        self._checker = checker
        self._monitor_repo = monitor_repo
        self._scheduler = AsyncIOScheduler(executors={"default": AsyncIOExecutor()})

    def start(self) -> None:
        self._scheduler.start()
        logger.info("scheduler_started")

    def shutdown(self) -> None:
        self._scheduler.shutdown(wait=False)
        logger.info("scheduler_stopped")

    async def _run_scheduled_check(self, monitor_id: str) -> None:
        monitor = await self._monitor_repo.get_by_id(monitor_id)
        if monitor is None or not monitor.get("is_active"):
            # Monitor was deleted or paused between job registration and firing.
            return
        try:
            await self._checker.run_check(monitor)
        except Exception:
            logger.exception("scheduled_check_failed monitor_id=%s", monitor_id)

    def add_or_update_job(self, monitor_id: str, interval_seconds: int) -> None:
        self._scheduler.add_job(
            self._run_scheduled_check,
            trigger="interval",
            seconds=interval_seconds,
            id=_job_id(monitor_id),
            args=[monitor_id],
            replace_existing=True,
            max_instances=1,
            coalesce=True,
            misfire_grace_time=min(interval_seconds, 60),
        )
        logger.info("scheduler_job_registered monitor_id=%s interval_seconds=%s", monitor_id, interval_seconds)

    def remove_job(self, monitor_id: str) -> None:
        job_id = _job_id(monitor_id)
        if self._scheduler.get_job(job_id) is not None:
            self._scheduler.remove_job(job_id)
            logger.info("scheduler_job_removed monitor_id=%s", monitor_id)

    def add_retention_job(self, cleanup_fn: Callable[[], Awaitable[Any]], hours: int = 6) -> None:
        self._scheduler.add_job(
            cleanup_fn,
            trigger="interval",
            hours=hours,
            id=RETENTION_JOB_ID,
            replace_existing=True,
            max_instances=1,
        )

    async def register_active_monitors(self) -> None:
        monitors = await self._monitor_repo.list_active_for_scheduler()
        for monitor in monitors:
            self.add_or_update_job(str(monitor["_id"]), monitor["interval_seconds"])
        logger.info("scheduler_startup_registered count=%s", len(monitors))
