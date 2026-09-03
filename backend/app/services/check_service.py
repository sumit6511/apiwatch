import asyncio
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from app.config import get_settings
from app.db.repositories.checks import CheckRepository
from app.db.repositories.monitors import MonitorRepository
from app.errors import MonitorNotFoundError, RateLimitedError
from app.monitoring.checker import MonitorChecker
from app.schemas.check import CheckOut, ManualCheckResult
from app.schemas.monitor import MonitorTestRequest

logger = logging.getLogger("apiwatch.checks")


def check_doc_to_out(doc: dict[str, Any]) -> CheckOut:
    return CheckOut(
        id=str(doc["_id"]),
        monitor_id=str(doc["monitor_id"]),
        status=doc["status"],
        http_status=doc.get("http_status"),
        response_time_ms=doc["response_time_ms"],
        error=doc.get("error"),
        checked_at=doc["checked_at"],
    )


class CheckService:
    def __init__(
        self,
        check_repo: CheckRepository,
        monitor_repo: MonitorRepository,
        checker: MonitorChecker,
        throttle_seconds: int,
    ):
        self._check_repo = check_repo
        self._monitor_repo = monitor_repo
        self._checker = checker
        self._throttle_seconds = throttle_seconds
        self._last_manual_check: dict[str, float] = {}
        self._lock = asyncio.Lock()

    async def list_checks(
        self,
        monitor_id: str,
        owner_id: str,
        from_dt: datetime | None = None,
        to_dt: datetime | None = None,
        limit: int = 100,
    ) -> list[CheckOut]:
        monitor = await self._monitor_repo.get(monitor_id, owner_id)
        if monitor is None:
            raise MonitorNotFoundError()
        docs = await self._check_repo.list_for_monitor(monitor_id, from_dt, to_dt, limit)
        return [check_doc_to_out(d) for d in docs]

    async def run_manual_check(self, monitor_id: str, owner_id: str) -> ManualCheckResult:
        """Manual "Run Check" on an existing monitor (section 32/33). Design
        decision: unlike an ad-hoc test-request, this DOES record a check to
        history and updates monitor state/incidents just like a scheduled
        check -- it's the same action the user sees reflected in "Recent
        Checks" and the uptime chart, and matches the immediate first-check
        behavior described in section 22."""
        monitor = await self._monitor_repo.get(monitor_id, owner_id)
        if monitor is None:
            raise MonitorNotFoundError()

        async with self._lock:
            now_ts = datetime.now(UTC).timestamp()
            last = self._last_manual_check.get(monitor_id)
            if last is not None and (now_ts - last) < self._throttle_seconds:
                wait = self._throttle_seconds - (now_ts - last)
                raise RateLimitedError(
                    f"Please wait {wait:.0f}s between manual checks for this monitor."
                )
            self._last_manual_check[monitor_id] = now_ts

        check_doc = await self._checker.run_check(monitor)
        logger.info("manual_check_completed monitor_id=%s", monitor_id)
        return ManualCheckResult(
            status=check_doc["status"],
            http_status=check_doc.get("http_status"),
            response_time_ms=check_doc["response_time_ms"],
            error=check_doc.get("error"),
        )

    async def test_request(self, config: MonitorTestRequest) -> ManualCheckResult:
        """Ad-hoc probe for the create-monitor form's "Test Request" button.
        No monitor needs to exist yet, and nothing is persisted."""
        result = await self._checker.perform_request(
            url=config.url,
            method=config.method,
            headers=config.headers,
            body=config.body,
            timeout_seconds=config.timeout_seconds,
            expected_status_codes=config.expected_status_codes,
        )
        return ManualCheckResult(
            status=result.status,
            http_status=result.http_status,
            response_time_ms=result.response_time_ms,
            error=result.error,
        )

    async def cleanup_old_checks(self) -> int:
        """Retention job (section 39): delete checks older than
        CHECK_RETENTION_DAYS using the indexed `checked_at` field. Incidents
        are never touched. Runs on the interval registered in scheduler.py."""
        settings = get_settings()
        cutoff = datetime.now(UTC) - timedelta(days=settings.check_retention_days)
        deleted = await self._check_repo.delete_older_than(cutoff)
        if deleted:
            logger.info("retention_cleanup_completed deleted=%s cutoff=%s", deleted, cutoff.isoformat())
        return deleted
