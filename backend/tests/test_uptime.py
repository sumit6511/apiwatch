from datetime import UTC, datetime, timedelta

import pytest
from bson import ObjectId

from app.errors import MonitorNotFoundError
from app.models.enums import MonitorStatus
from app.services.metrics_service import MetricsService

OWNER_ID = str(ObjectId())
OTHER_OWNER_ID = str(ObjectId())


async def _make_monitor(monitor_repo, owner_id: str = OWNER_ID):
    now = datetime.now(UTC)
    doc = {
        "owner_id": ObjectId(owner_id),
        "name": "uptime monitor",
        "url": "https://example.com",
        "method": "GET",
        "headers": {},
        "body": None,
        "interval_seconds": 300,
        "timeout_seconds": 10,
        "expected_status_codes": [200],
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
            "response_time_ms": 100,
            "error": None,
            "checked_at": when,
        }
    )


async def test_uptime_100_percent(monitor_repo, check_repo):
    monitor = await _make_monitor(monitor_repo)
    now = datetime.now(UTC)
    for i in range(10):
        await _insert_check(check_repo, monitor["_id"], OWNER_ID, "UP", now - timedelta(minutes=i))

    metrics = MetricsService(check_repo, monitor_repo)
    stats = await metrics.get_uptime(str(monitor["_id"]), OWNER_ID, "24h")
    assert stats.uptime_percentage == 100.0
    assert stats.total_checks == 10
    assert stats.failed_checks == 0


async def test_uptime_50_percent(monitor_repo, check_repo):
    monitor = await _make_monitor(monitor_repo)
    now = datetime.now(UTC)
    for i in range(5):
        await _insert_check(check_repo, monitor["_id"], OWNER_ID, "UP", now - timedelta(minutes=i))
    for i in range(5, 10):
        await _insert_check(check_repo, monitor["_id"], OWNER_ID, "DOWN", now - timedelta(minutes=i))

    metrics = MetricsService(check_repo, monitor_repo)
    stats = await metrics.get_uptime(str(monitor["_id"]), OWNER_ID, "24h")
    assert stats.uptime_percentage == 50.0
    assert stats.successful_checks == 5
    assert stats.failed_checks == 5


async def test_uptime_0_percent(monitor_repo, check_repo):
    monitor = await _make_monitor(monitor_repo)
    now = datetime.now(UTC)
    for i in range(4):
        await _insert_check(check_repo, monitor["_id"], OWNER_ID, "DOWN", now - timedelta(minutes=i))

    metrics = MetricsService(check_repo, monitor_repo)
    stats = await metrics.get_uptime(str(monitor["_id"]), OWNER_ID, "24h")
    assert stats.uptime_percentage == 0.0


async def test_uptime_with_no_checks_is_none_not_fabricated_100(monitor_repo, check_repo):
    """Section 24/89: a monitor with no checks reports UNKNOWN/no data, never a fabricated 100%."""
    monitor = await _make_monitor(monitor_repo)
    metrics = MetricsService(check_repo, monitor_repo)
    stats = await metrics.get_uptime(str(monitor["_id"]), OWNER_ID, "24h")
    assert stats.uptime_percentage is None
    assert stats.total_checks == 0


async def test_uptime_only_counts_checks_within_period(monitor_repo, check_repo):
    monitor = await _make_monitor(monitor_repo)
    now = datetime.now(UTC)
    await _insert_check(check_repo, monitor["_id"], OWNER_ID, "UP", now - timedelta(hours=1))
    await _insert_check(check_repo, monitor["_id"], OWNER_ID, "DOWN", now - timedelta(days=10))  # outside window

    metrics = MetricsService(check_repo, monitor_repo)
    stats = await metrics.get_uptime(str(monitor["_id"]), OWNER_ID, "24h")
    assert stats.total_checks == 1
    assert stats.uptime_percentage == 100.0


async def test_get_uptime_for_a_different_owners_monitor_is_not_found(monitor_repo, check_repo):
    monitor = await _make_monitor(monitor_repo, owner_id=OWNER_ID)
    metrics = MetricsService(check_repo, monitor_repo)
    with pytest.raises(MonitorNotFoundError):
        await metrics.get_uptime(str(monitor["_id"]), OTHER_OWNER_ID, "24h")


async def test_dashboard_summary_only_aggregates_the_callers_own_checks(monitor_repo, check_repo):
    mine = await _make_monitor(monitor_repo, owner_id=OWNER_ID)
    theirs = await _make_monitor(monitor_repo, owner_id=OTHER_OWNER_ID)
    now = datetime.now(UTC)
    await _insert_check(check_repo, mine["_id"], OWNER_ID, "UP", now)
    await _insert_check(check_repo, theirs["_id"], OTHER_OWNER_ID, "DOWN", now)

    metrics = MetricsService(check_repo, monitor_repo)
    summary = await metrics.get_dashboard_summary(OWNER_ID)
    assert summary["total_monitors"] == 1
    assert summary["overall_uptime_percentage"] == 100.0
