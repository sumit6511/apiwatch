import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from bson import ObjectId

from app.config import get_settings
from app.db.repositories.checks import CheckRepository
from app.db.repositories.incidents import IncidentRepository
from app.db.repositories.monitors import MonitorRepository
from app.db.repositories.notifications import NotificationRepository
from app.errors import AppError, MonitorLimitExceededError, MonitorNotFoundError, RateLimitedError
from app.models.enums import MonitorStatus
from app.monitoring.checker import MonitorChecker
from app.monitoring.scheduler import SchedulerManager
from app.monitoring.url_validator import validate_url
from app.schemas.monitor import MonitorCreate, MonitorOut, MonitorUpdate, UptimeSummary

logger = logging.getLogger("apiwatch.monitors")


def _uptime_percentage(stats: dict[str, int]) -> float | None:
    if stats["total"] <= 0:
        return None
    return round((stats["successful"] / stats["total"]) * 100, 2)


class MonitorService:
    def __init__(
        self,
        monitor_repo: MonitorRepository,
        check_repo: CheckRepository,
        incident_repo: IncidentRepository,
        notification_repo: NotificationRepository,
        scheduler: SchedulerManager,
        checker: MonitorChecker,
    ):
        self._monitor_repo = monitor_repo
        self._check_repo = check_repo
        self._incident_repo = incident_repo
        self._notification_repo = notification_repo
        self._scheduler = scheduler
        self._checker = checker
        # In-memory, per-owner creation cooldown -- same pattern as
        # CheckService's manual-check throttle. Single-instance assumption
        # is fine here for the same reason it's fine there (see README
        # "Scheduler Architecture"): this app runs as one backend process.
        self._last_create: dict[str, float] = {}
        self._create_lock = asyncio.Lock()

    async def _to_out(self, doc: dict[str, Any]) -> MonitorOut:
        monitor_id = str(doc["_id"])
        now = datetime.now(UTC)
        latest_check, stats_24h, stats_7d, stats_30d = await asyncio.gather(
            self._check_repo.latest_for_monitor(monitor_id),
            self._check_repo.uptime_stats(monitor_id, now - timedelta(hours=24)),
            self._check_repo.uptime_stats(monitor_id, now - timedelta(days=7)),
            self._check_repo.uptime_stats(monitor_id, now - timedelta(days=30)),
        )

        return MonitorOut(
            id=monitor_id,
            name=doc["name"],
            url=doc["url"],
            method=doc["method"],
            headers=doc.get("headers") or {},
            body=doc.get("body"),
            interval_seconds=doc["interval_seconds"],
            timeout_seconds=doc["timeout_seconds"],
            expected_status_codes=doc["expected_status_codes"],
            notification_channel_ids=doc.get("notification_channel_ids") or [],
            is_active=doc["is_active"],
            status=doc["current_status"],
            http_status=latest_check.get("http_status") if latest_check else None,
            response_time_ms=latest_check.get("response_time_ms") if latest_check else None,
            failure_count=doc.get("failure_count", 0),
            success_count=doc.get("success_count", 0),
            last_checked_at=doc.get("last_checked_at"),
            last_success_at=doc.get("last_success_at"),
            last_failure_at=doc.get("last_failure_at"),
            uptime=UptimeSummary(
                period_24h=_uptime_percentage(stats_24h),
                period_7d=_uptime_percentage(stats_7d),
                period_30d=_uptime_percentage(stats_30d),
            ),
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
        )

    async def _validate_notification_channel_ids(self, channel_ids: list[str], owner_id: str) -> None:
        if not channel_ids:
            return
        owned_count = await self._notification_repo.count_by_ids_and_owner(channel_ids, owner_id)
        if owned_count != len(set(channel_ids)):
            raise AppError(
                "INVALID_NOTIFICATION_CHANNEL",
                "One or more notification channels don't exist or aren't yours.",
                422,
            )

    async def list_all(self, owner_id: str) -> list[MonitorOut]:
        docs = await self._monitor_repo.list_all(owner_id)
        return list(await asyncio.gather(*(self._to_out(d) for d in docs)))

    async def get(self, monitor_id: str, owner_id: str) -> MonitorOut:
        doc = await self._monitor_repo.get(monitor_id, owner_id)
        if doc is None:
            raise MonitorNotFoundError()
        return await self._to_out(doc)

    async def get_name(self, monitor_id: str, owner_id: str) -> str | None:
        """Lightweight lookup (no uptime/latest-check aggregation) for
        contexts that only need the display name, e.g. joining incidents."""
        doc = await self._monitor_repo.get(monitor_id, owner_id)
        return doc["name"] if doc else None

    async def _enforce_creation_limits(self, owner_id: str) -> None:
        settings = get_settings()

        existing_count = await self._monitor_repo.total_count(owner_id)
        if existing_count >= settings.max_monitors_per_owner:
            raise MonitorLimitExceededError(
                f"You've reached the limit of {settings.max_monitors_per_owner} monitors per account. "
                "Delete an existing monitor to add a new one."
            )

        async with self._create_lock:
            now_ts = datetime.now(UTC).timestamp()
            last = self._last_create.get(owner_id)
            cooldown = settings.monitor_create_cooldown_seconds
            if last is not None and (now_ts - last) < cooldown:
                wait = cooldown - (now_ts - last)
                raise RateLimitedError(f"Please wait {wait:.0f}s before creating another monitor.")
            self._last_create[owner_id] = now_ts

    async def create(self, data: MonitorCreate, owner_id: str) -> MonitorOut:
        await self._enforce_creation_limits(owner_id)
        validated_url = await validate_url(data.url)
        await self._validate_notification_channel_ids(data.notification_channel_ids, owner_id)
        now = datetime.now(UTC)
        document = {
            "owner_id": ObjectId(owner_id),
            "name": data.name,
            "url": validated_url,
            "method": data.method,
            "headers": data.headers,
            "body": data.body,
            "interval_seconds": data.interval_seconds,
            "timeout_seconds": data.timeout_seconds,
            "expected_status_codes": data.expected_status_codes,
            "is_active": True,
            "current_status": MonitorStatus.UNKNOWN,
            "consecutive_failures": 0,
            "consecutive_successes": 0,
            "failure_count": 0,
            "success_count": 0,
            "last_checked_at": None,
            "last_success_at": None,
            "last_failure_at": None,
            "open_incident_id": None,
            "notification_channel_ids": data.notification_channel_ids,
            "created_at": now,
            "updated_at": now,
        }
        created = await self._monitor_repo.create(document)
        monitor_id = str(created["_id"])
        logger.info("monitor_created id=%s owner_id=%s name=%s url=%s", monitor_id, owner_id, data.name, validated_url)

        # Run one immediate check (section 22) so the user isn't staring at
        # UNKNOWN until the first scheduled interval elapses.
        try:
            await self._checker.run_check(created)
            created = await self._monitor_repo.get(monitor_id, owner_id)
        except Exception:
            logger.exception("initial_check_failed monitor_id=%s", monitor_id)

        self._scheduler.add_or_update_job(monitor_id, data.interval_seconds)
        return await self._to_out(created)

    async def update(self, monitor_id: str, owner_id: str, data: MonitorUpdate) -> MonitorOut:
        existing = await self._monitor_repo.get(monitor_id, owner_id)
        if existing is None:
            raise MonitorNotFoundError()

        fields = data.model_dump(exclude_unset=True)
        if "url" in fields:
            fields["url"] = await validate_url(fields["url"])
        if "notification_channel_ids" in fields:
            await self._validate_notification_channel_ids(fields["notification_channel_ids"], owner_id)

        updated = await self._monitor_repo.update(monitor_id, owner_id, fields) if fields else existing

        # Section 19: interval change -> remove old job, register new job.
        # add_or_update_job(replace_existing=True) does both in one call.
        if "interval_seconds" in fields and updated.get("is_active"):
            self._scheduler.add_or_update_job(monitor_id, updated["interval_seconds"])

        logger.info("monitor_updated id=%s owner_id=%s", monitor_id, owner_id)
        return await self._to_out(updated)

    async def delete(self, monitor_id: str, owner_id: str) -> None:
        deleted = await self._monitor_repo.delete(monitor_id, owner_id)
        if not deleted:
            raise MonitorNotFoundError()
        self._scheduler.remove_job(monitor_id)
        # Cascade: a deleted monitor shouldn't leave orphaned checks/incidents
        # behind referencing a monitor_id that no longer exists.
        await self._check_repo.delete_for_monitor(monitor_id)
        await self._incident_repo.delete_for_monitor(monitor_id)
        logger.info("monitor_deleted id=%s owner_id=%s", monitor_id, owner_id)

    async def pause(self, monitor_id: str, owner_id: str) -> MonitorOut:
        existing = await self._monitor_repo.get(monitor_id, owner_id)
        if existing is None:
            raise MonitorNotFoundError()
        updated = await self._monitor_repo.update(
            monitor_id, owner_id, {"is_active": False, "current_status": MonitorStatus.PAUSED}
        )
        self._scheduler.remove_job(monitor_id)
        logger.info("monitor_paused id=%s owner_id=%s", monitor_id, owner_id)
        return await self._to_out(updated)

    async def resume(self, monitor_id: str, owner_id: str) -> MonitorOut:
        existing = await self._monitor_repo.get(monitor_id, owner_id)
        if existing is None:
            raise MonitorNotFoundError()

        # If the monitor still has an open incident (it was DOWN when paused),
        # resuming must land it back in DOWN, not UNKNOWN. Resetting to
        # UNKNOWN here would make the state machine treat the next check as
        # a fresh start: a continued failure would open a second, orphaned
        # incident, and an immediate recovery would flip straight to UP
        # without ever resolving the original incident (see state.py -- only
        # a DOWN->UP transition resolves an incident). A monitor that was
        # healthy (no open incident) resumes into UNKNOWN as the state
        # diagram in section 9 describes.
        resume_status = (
            MonitorStatus.DOWN if existing.get("open_incident_id") else MonitorStatus.UNKNOWN
        )
        updated = await self._monitor_repo.update(
            monitor_id,
            owner_id,
            {
                "is_active": True,
                "current_status": resume_status,
                "consecutive_failures": 0,
                "consecutive_successes": 0,
            },
        )

        try:
            await self._checker.run_check(updated)
            updated = await self._monitor_repo.get(monitor_id, owner_id)
        except Exception:
            logger.exception("resume_check_failed monitor_id=%s", monitor_id)

        self._scheduler.add_or_update_job(monitor_id, updated["interval_seconds"])
        logger.info("monitor_resumed id=%s owner_id=%s", monitor_id, owner_id)
        return await self._to_out(updated)
