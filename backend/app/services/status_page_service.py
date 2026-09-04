import asyncio
import logging
import secrets
from datetime import UTC, datetime, timedelta

from app.db.repositories.checks import CheckRepository
from app.db.repositories.monitors import MonitorRepository
from app.db.repositories.users import UserRepository
from app.errors import AppError, StatusPageNotFoundError
from app.models.enums import MonitorStatus
from app.schemas.status_page import (
    PublicCheckPoint,
    PublicMonitorStatus,
    PublicStatusPage,
    StatusPageSlugOut,
)

logger = logging.getLogger("apiwatch.status_page")

# secrets.token_urlsafe(9) -> 12 url-safe characters, ~72 bits of entropy --
# unguessable enough that the slug itself is the access control (there's no
# separate password on a public status page).
SLUG_BYTES = 9
MAX_SLUG_GENERATION_ATTEMPTS = 5
RECENT_CHECKS_LIMIT = 50


def _uptime_percentage(stats: dict[str, int]) -> float | None:
    if stats["total"] <= 0:
        return None
    return round((stats["successful"] / stats["total"]) * 100, 2)


def _overall_status(statuses: list[MonitorStatus]) -> MonitorStatus:
    if not statuses:
        return MonitorStatus.UNKNOWN
    if MonitorStatus.DOWN in statuses:
        return MonitorStatus.DOWN
    if MonitorStatus.UNKNOWN in statuses:
        return MonitorStatus.UNKNOWN
    return MonitorStatus.UP


class StatusPageService:
    def __init__(self, users: UserRepository, monitors: MonitorRepository, checks: CheckRepository):
        self._users = users
        self._monitors = monitors
        self._checks = checks

    async def get_or_create_slug(self, user_id: str) -> StatusPageSlugOut:
        user = await self._users.get_by_id(user_id)
        existing = user.get("public_slug") if user else None
        if existing:
            return StatusPageSlugOut(slug=existing)
        return StatusPageSlugOut(slug=await self._assign_new_slug(user_id))

    async def regenerate_slug(self, user_id: str) -> StatusPageSlugOut:
        """Invalidates the old link (anyone with it loses access) and issues
        a fresh one -- for when a slug leaks somewhere it shouldn't have."""
        return StatusPageSlugOut(slug=await self._assign_new_slug(user_id))

    async def _assign_new_slug(self, user_id: str) -> str:
        for _ in range(MAX_SLUG_GENERATION_ATTEMPTS):
            slug = secrets.token_urlsafe(SLUG_BYTES)
            if await self._users.get_by_public_slug(slug) is None:
                await self._users.set_public_slug(user_id, slug)
                logger.info("status_page_slug_assigned user_id=%s", user_id)
                return slug
        # Astronomically unlikely at 72 bits of entropy, but fail loudly
        # rather than silently reusing a colliding slug.
        raise AppError("SLUG_GENERATION_FAILED", "Could not generate a unique link. Please try again.", 500)

    async def get_public_page(self, slug: str) -> PublicStatusPage:
        user = await self._users.get_by_public_slug(slug)
        if user is None:
            raise StatusPageNotFoundError()

        monitor_docs = await self._monitors.list_public_for_owner(str(user["_id"]))
        now = datetime.now(UTC)
        monitors = list(
            await asyncio.gather(*(self._build_monitor_status(doc, now) for doc in monitor_docs))
        )

        return PublicStatusPage(
            overall_status=_overall_status([m.status for m in monitors]),
            monitors=monitors,
            generated_at=now,
        )

    async def _build_monitor_status(self, doc: dict, now: datetime) -> PublicMonitorStatus:
        monitor_id = str(doc["_id"])
        stats_24h, stats_7d, stats_30d, recent = await asyncio.gather(
            self._checks.uptime_stats(monitor_id, now - timedelta(hours=24)),
            self._checks.uptime_stats(monitor_id, now - timedelta(days=7)),
            self._checks.uptime_stats(monitor_id, now - timedelta(days=30)),
            self._checks.list_for_monitor(monitor_id, limit=RECENT_CHECKS_LIMIT),
        )
        return PublicMonitorStatus(
            name=doc["name"],
            status=doc["current_status"],
            uptime_24h=_uptime_percentage(stats_24h),
            uptime_7d=_uptime_percentage(stats_7d),
            uptime_30d=_uptime_percentage(stats_30d),
            last_checked_at=doc.get("last_checked_at"),
            recent_checks=[
                PublicCheckPoint(
                    timestamp=c["checked_at"], status=c["status"], response_time_ms=c["response_time_ms"]
                )
                # list_for_monitor sorts newest-first; flip to chronological
                # order for a left-to-right sparkline.
                for c in reversed(recent)
            ],
        )
