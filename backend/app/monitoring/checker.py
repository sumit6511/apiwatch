"""MonitorChecker: performs the actual HTTP probe and, for scheduled/manual
runs against a saved monitor, drives the full pipeline described in spec
section 12 -- validate, request, measure, classify, persist, update monitor
state, open/resolve incidents, notify. Intentionally kept out of the API
routers (section 12: "Do not put this logic inside FastAPI routes.")
"""

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urljoin

import httpx
from bson import ObjectId

from app.config import get_settings
from app.errors import AppError, SSRFBlockedError
from app.models.enums import MonitorStatus
from app.monitoring.state import apply_check_result
from app.monitoring.url_validator import validate_url
from app.notifications.base import NotificationEvent, NotificationEventType

logger = logging.getLogger("apiwatch.checker")


class _TooManyRedirectsError(Exception):
    def __init__(self, status_code: int):
        self.status_code = status_code


@dataclass(frozen=True)
class RawCheckResult:
    status: MonitorStatus
    http_status: int | None
    response_time_ms: int
    error: str | None


class MonitorChecker:
    def __init__(self, check_repo, monitor_repo, incident_service, notification_service):
        self._check_repo = check_repo
        self._monitor_repo = monitor_repo
        self._incident_service = incident_service
        self._notification_service = notification_service

    async def perform_request(
        self,
        *,
        url: str,
        method: str,
        headers: dict[str, str] | None,
        body: dict | str | None,
        timeout_seconds: int,
        expected_status_codes: list[int],
    ) -> RawCheckResult:
        """Validate + request + measure + classify. No persistence -- reused
        by the full pipeline (run_check) and the standalone test-request
        endpoint used by the create-monitor form (section 67)."""
        settings = get_settings()
        start = time.monotonic()

        try:
            validated_url = await validate_url(url)
        except AppError as exc:
            return RawCheckResult(MonitorStatus.DOWN, None, 0, exc.message)

        request_kwargs: dict[str, Any] = {}
        if body is not None:
            if isinstance(body, str):
                request_kwargs["content"] = body
            else:
                request_kwargs["json"] = body

        async def _do_request() -> httpx.Response:
            current_url = validated_url
            redirects_followed = 0
            async with httpx.AsyncClient(follow_redirects=False, timeout=timeout_seconds) as client:
                while True:
                    response = await client.request(
                        method, current_url, headers=headers or None, **request_kwargs
                    )
                    if response.is_redirect and settings.follow_redirects:
                        if redirects_followed >= settings.max_redirects:
                            raise _TooManyRedirectsError(response.status_code)
                        location = response.headers.get("location")
                        if not location:
                            return response
                        # Redirect protection (section 36/37): the destination is
                        # revalidated against the SAME SSRF rules as the original
                        # URL before we follow it, on every hop.
                        current_url = await validate_url(urljoin(current_url, location))
                        redirects_followed += 1
                        continue
                    return response

        try:
            # httpx.AsyncClient(timeout=timeout_seconds) above is the primary
            # bound (it's what actually fires for a slow connect/read/write).
            # asyncio.wait_for is a backstop for pathological redirect chains
            # where each individual hop is fast but many hops accumulate.
            response = await asyncio.wait_for(_do_request(), timeout=timeout_seconds)
        except (httpx.TimeoutException, TimeoutError):
            return RawCheckResult(MonitorStatus.DOWN, None, timeout_seconds * 1000, "Request timed out")
        except SSRFBlockedError as exc:
            elapsed_ms = int((time.monotonic() - start) * 1000)
            return RawCheckResult(MonitorStatus.DOWN, None, elapsed_ms, exc.message)
        except _TooManyRedirectsError as exc:
            elapsed_ms = int((time.monotonic() - start) * 1000)
            return RawCheckResult(MonitorStatus.DOWN, exc.status_code, elapsed_ms, "Too many redirects")
        except httpx.HTTPError as exc:
            elapsed_ms = int((time.monotonic() - start) * 1000)
            return RawCheckResult(
                MonitorStatus.DOWN, None, elapsed_ms, f"Request failed: {type(exc).__name__}"
            )

        elapsed_ms = int((time.monotonic() - start) * 1000)
        if response.status_code in expected_status_codes:
            return RawCheckResult(MonitorStatus.UP, response.status_code, elapsed_ms, None)
        return RawCheckResult(
            MonitorStatus.DOWN,
            response.status_code,
            elapsed_ms,
            f"Unexpected status code: {response.status_code}",
        )

    async def run_check(self, monitor: dict[str, Any]) -> dict[str, Any]:
        """Full pipeline against a saved monitor document. Persists a check,
        advances the state machine, and opens/resolves incidents + fires
        transition-only notifications."""
        result = await self.perform_request(
            url=monitor["url"],
            method=monitor["method"],
            headers=monitor.get("headers") or {},
            body=monitor.get("body"),
            timeout_seconds=monitor["timeout_seconds"],
            expected_status_codes=monitor["expected_status_codes"],
        )

        now = datetime.now(UTC)
        monitor_id = str(monitor["_id"])
        owner_id = str(monitor["owner_id"])

        saved_check = await self._check_repo.insert(
            {
                "monitor_id": ObjectId(monitor_id),
                "owner_id": monitor["owner_id"],
                "status": result.status,
                "http_status": result.http_status,
                "response_time_ms": result.response_time_ms,
                "error": result.error,
                "checked_at": now,
            }
        )

        settings = get_settings()
        transition = apply_check_result(
            current_status=MonitorStatus(monitor["current_status"]),
            is_success=result.status == MonitorStatus.UP,
            consecutive_failures=monitor.get("consecutive_failures", 0),
            consecutive_successes=monitor.get("consecutive_successes", 0),
            failure_threshold=settings.failure_threshold,
            recovery_threshold=settings.recovery_threshold,
        )

        monitor_updates: dict[str, Any] = {
            "current_status": transition.new_status,
            "consecutive_failures": transition.consecutive_failures,
            "consecutive_successes": transition.consecutive_successes,
            "last_checked_at": now,
        }
        if result.status == MonitorStatus.UP:
            monitor_updates["last_success_at"] = now
            monitor_updates["success_count"] = monitor.get("success_count", 0) + 1
        else:
            monitor_updates["last_failure_at"] = now
            monitor_updates["failure_count"] = monitor.get("failure_count", 0) + 1

        channel_ids = monitor.get("notification_channel_ids") or []

        if transition.should_open_incident and monitor.get("open_incident_id"):
            # Defense in depth: a monitor should never carry an open incident
            # while transitioning into DOWN again (this would mean an
            # earlier incident was never resolved/cleared, e.g. via a
            # pause/resume edge case). Keep the existing incident instead of
            # opening a duplicate.
            logger.warning(
                "duplicate_incident_prevented monitor_id=%s existing_incident_id=%s",
                monitor_id,
                monitor["open_incident_id"],
            )
        elif transition.should_open_incident:
            reason = result.error or f"HTTP {result.http_status}"
            incident = await self._incident_service.open_incident(
                monitor_id=monitor_id, owner_id=owner_id, reason=reason, started_at=now
            )
            monitor_updates["open_incident_id"] = str(incident["_id"])
            logger.info("monitor_state_changed monitor_id=%s status=DOWN reason=%s", monitor_id, reason)
            await self._notification_service.send_to_channels(
                channel_ids,
                NotificationEvent(
                    event_type=NotificationEventType.OUTAGE,
                    monitor_name=monitor["name"],
                    monitor_url=monitor["url"],
                    reason=reason,
                    detected_at=now,
                ),
            )
        elif transition.should_resolve_incident and monitor.get("open_incident_id"):
            incident = await self._incident_service.resolve_incident(monitor["open_incident_id"], now)
            monitor_updates["open_incident_id"] = None
            downtime_seconds = None
            if incident and incident.get("started_at"):
                started_at = incident["started_at"]
                if started_at.tzinfo is None:
                    started_at = started_at.replace(tzinfo=UTC)
                downtime_seconds = int((now - started_at).total_seconds())
            logger.info("monitor_state_changed monitor_id=%s status=UP", monitor_id)
            await self._notification_service.send_to_channels(
                channel_ids,
                NotificationEvent(
                    event_type=NotificationEventType.RECOVERY,
                    monitor_name=monitor["name"],
                    monitor_url=monitor["url"],
                    recovered_at=now,
                    downtime_seconds=downtime_seconds,
                ),
            )

        await self._monitor_repo.update(monitor_id, owner_id, monitor_updates)
        logger.info(
            "check_completed monitor_id=%s status=%s http_status=%s response_time_ms=%s",
            monitor_id,
            result.status,
            result.http_status,
            result.response_time_ms,
        )
        return saved_check
