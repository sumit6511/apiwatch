from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from bson import ObjectId

from app.errors import StatusPageNotFoundError
from app.models.enums import MonitorStatus
from app.services.status_page_service import StatusPageService

OWNER_ID = str(ObjectId())
OTHER_OWNER_ID = str(ObjectId())


@pytest_asyncio.fixture
async def status_page_service(user_repo, monitor_repo, check_repo):
    return StatusPageService(user_repo, monitor_repo, check_repo)


async def _make_user(user_repo, email: str = "owner@example.com") -> dict:
    return await user_repo.create(
        {"email": email, "password_hash": "hashed", "created_at": datetime.now(UTC)}
    )


async def _make_monitor(
    monitor_repo,
    owner_id: str = OWNER_ID,
    name: str = "public monitor",
    is_public: bool = True,
    is_active: bool = True,
    current_status: str = MonitorStatus.UP,
) -> dict:
    now = datetime.now(UTC)
    doc = {
        "owner_id": ObjectId(owner_id),
        "name": name,
        "url": "https://example.com",
        "method": "GET",
        "headers": {},
        "body": None,
        "interval_seconds": 300,
        "timeout_seconds": 10,
        "expected_status_codes": [200],
        "is_public": is_public,
        "is_active": is_active,
        "current_status": current_status,
        "consecutive_failures": 0,
        "consecutive_successes": 0,
        "failure_count": 0,
        "success_count": 0,
        "last_checked_at": now,
        "last_success_at": now,
        "last_failure_at": None,
        "open_incident_id": None,
        "notification_channel_ids": [],
        "created_at": now,
        "updated_at": now,
    }
    return await monitor_repo.create(doc)


async def _insert_check(check_repo, monitor_id: ObjectId, owner_id: str, status: str, when: datetime):
    await check_repo.insert(
        {
            "monitor_id": monitor_id,
            "owner_id": ObjectId(owner_id),
            "status": status,
            "http_status": 200 if status == "UP" else 500,
            "response_time_ms": 120,
            "error": None,
            "checked_at": when,
        }
    )


# ── Slug assignment ─────────────────────────────────────────────────────


async def test_get_or_create_slug_assigns_one_on_first_call(status_page_service, user_repo):
    user = await _make_user(user_repo)
    result = await status_page_service.get_or_create_slug(str(user["_id"]))
    assert result.slug

    stored = await user_repo.get_by_id(str(user["_id"]))
    assert stored["public_slug"] == result.slug


async def test_get_or_create_slug_is_idempotent(status_page_service, user_repo):
    user = await _make_user(user_repo)
    first = await status_page_service.get_or_create_slug(str(user["_id"]))
    second = await status_page_service.get_or_create_slug(str(user["_id"]))
    assert first.slug == second.slug


async def test_regenerate_slug_issues_a_different_one_and_invalidates_the_old_link(
    status_page_service, user_repo
):
    user = await _make_user(user_repo)
    original = await status_page_service.get_or_create_slug(str(user["_id"]))
    regenerated = await status_page_service.regenerate_slug(str(user["_id"]))

    assert regenerated.slug != original.slug
    assert await user_repo.get_by_public_slug(original.slug) is None
    assert (await user_repo.get_by_public_slug(regenerated.slug))["_id"] == user["_id"]


# ── Public page ──────────────────────────────────────────────────────────


async def test_unknown_slug_raises_not_found(status_page_service):
    with pytest.raises(StatusPageNotFoundError):
        await status_page_service.get_public_page("does-not-exist")


async def test_public_page_only_includes_monitors_marked_public(
    status_page_service, user_repo, monitor_repo
):
    user = await _make_user(user_repo)
    slug = (await status_page_service.get_or_create_slug(str(user["_id"]))).slug

    await _make_monitor(monitor_repo, owner_id=str(user["_id"]), name="public one", is_public=True)
    await _make_monitor(monitor_repo, owner_id=str(user["_id"]), name="private one", is_public=False)

    page = await status_page_service.get_public_page(slug)
    assert [m.name for m in page.monitors] == ["public one"]


async def test_public_page_excludes_paused_monitors_even_if_marked_public(
    status_page_service, user_repo, monitor_repo
):
    user = await _make_user(user_repo)
    slug = (await status_page_service.get_or_create_slug(str(user["_id"]))).slug
    await _make_monitor(monitor_repo, owner_id=str(user["_id"]), is_public=True, is_active=False)

    page = await status_page_service.get_public_page(slug)
    assert page.monitors == []


async def test_public_page_excludes_another_accounts_public_monitors(
    status_page_service, user_repo, monitor_repo
):
    owner = await _make_user(user_repo, email="owner@example.com")
    other = await _make_user(user_repo, email="other@example.com")
    slug = (await status_page_service.get_or_create_slug(str(owner["_id"]))).slug

    await _make_monitor(monitor_repo, owner_id=str(owner["_id"]), name="mine", is_public=True)
    await _make_monitor(monitor_repo, owner_id=str(other["_id"]), name="theirs", is_public=True)

    page = await status_page_service.get_public_page(slug)
    assert [m.name for m in page.monitors] == ["mine"]


async def test_public_page_computes_uptime_and_recent_checks(
    status_page_service, user_repo, monitor_repo, check_repo
):
    user = await _make_user(user_repo)
    slug = (await status_page_service.get_or_create_slug(str(user["_id"]))).slug
    monitor = await _make_monitor(monitor_repo, owner_id=str(user["_id"]))

    now = datetime.now(UTC)
    for i in range(3):
        await _insert_check(check_repo, monitor["_id"], str(user["_id"]), "UP", now - timedelta(hours=i))
    await _insert_check(check_repo, monitor["_id"], str(user["_id"]), "DOWN", now - timedelta(hours=5))

    page = await status_page_service.get_public_page(slug)
    assert len(page.monitors) == 1
    summary = page.monitors[0]
    assert summary.uptime_24h == 75.0
    assert len(summary.recent_checks) == 4
    # Oldest first, for a left-to-right sparkline.
    assert summary.recent_checks[0].status == MonitorStatus.DOWN
    assert summary.recent_checks[-1].status == MonitorStatus.UP


@pytest.mark.parametrize(
    ("statuses", "expected"),
    [
        ([MonitorStatus.UP, MonitorStatus.UP], MonitorStatus.UP),
        ([MonitorStatus.UP, MonitorStatus.DOWN], MonitorStatus.DOWN),
        ([MonitorStatus.UP, MonitorStatus.UNKNOWN], MonitorStatus.UNKNOWN),
        ([MonitorStatus.DOWN, MonitorStatus.UNKNOWN], MonitorStatus.DOWN),
        ([], MonitorStatus.UNKNOWN),
    ],
)
async def test_overall_status_is_the_worst_of_all_public_monitors(
    status_page_service, user_repo, monitor_repo, statuses, expected
):
    user = await _make_user(user_repo)
    slug = (await status_page_service.get_or_create_slug(str(user["_id"]))).slug
    for i, status in enumerate(statuses):
        await _make_monitor(
            monitor_repo, owner_id=str(user["_id"]), name=f"m{i}", is_public=True, current_status=status
        )

    page = await status_page_service.get_public_page(slug)
    assert page.overall_status == expected


async def test_target_url_never_appears_in_the_public_response(
    status_page_service, user_repo, monitor_repo
):
    """The point of "name only" visibility -- a public status page must not
    leak the monitored URL even indirectly through the response shape."""
    user = await _make_user(user_repo)
    slug = (await status_page_service.get_or_create_slug(str(user["_id"]))).slug
    await _make_monitor(monitor_repo, owner_id=str(user["_id"]), is_public=True)

    page = await status_page_service.get_public_page(slug)
    assert "url" not in page.monitors[0].model_dump()
