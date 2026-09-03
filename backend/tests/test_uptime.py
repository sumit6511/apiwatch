from datetime import UTC, datetime, timedelta

from bson import ObjectId

from app.models.enums import MonitorStatus
from app.services.metrics_service import MetricsService


async def _make_monitor(monitor_repo):
    now = datetime.now(UTC)
    doc = {
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


async def _insert_check(check_repo, monitor_id: ObjectId, status: str, when: datetime):
    await check_repo.insert(
        {
            "monitor_id": monitor_id,
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
        await _insert_check(check_repo, monitor["_id"], "UP", now - timedelta(minutes=i))

    metrics = MetricsService(check_repo, monitor_repo)
    stats = await metrics.get_uptime(str(monitor["_id"]), "24h")
    assert stats.uptime_percentage == 100.0
    assert stats.total_checks == 10
    assert stats.failed_checks == 0


async def test_uptime_50_percent(monitor_repo, check_repo):
    monitor = await _make_monitor(monitor_repo)
    now = datetime.now(UTC)
    for i in range(5):
        await _insert_check(check_repo, monitor["_id"], "UP", now - timedelta(minutes=i))
    for i in range(5, 10):
        await _insert_check(check_repo, monitor["_id"], "DOWN", now - timedelta(minutes=i))

    metrics = MetricsService(check_repo, monitor_repo)
    stats = await metrics.get_uptime(str(monitor["_id"]), "24h")
    assert stats.uptime_percentage == 50.0
    assert stats.successful_checks == 5
    assert stats.failed_checks == 5


async def test_uptime_0_percent(monitor_repo, check_repo):
    monitor = await _make_monitor(monitor_repo)
    now = datetime.now(UTC)
    for i in range(4):
        await _insert_check(check_repo, monitor["_id"], "DOWN", now - timedelta(minutes=i))

    metrics = MetricsService(check_repo, monitor_repo)
    stats = await metrics.get_uptime(str(monitor["_id"]), "24h")
    assert stats.uptime_percentage == 0.0


async def test_uptime_with_no_checks_is_none_not_fabricated_100(monitor_repo, check_repo):
    """Section 24/89: a monitor with no checks reports UNKNOWN/no data, never a fabricated 100%."""
    monitor = await _make_monitor(monitor_repo)
    metrics = MetricsService(check_repo, monitor_repo)
    stats = await metrics.get_uptime(str(monitor["_id"]), "24h")
    assert stats.uptime_percentage is None
    assert stats.total_checks == 0


async def test_uptime_only_counts_checks_within_period(monitor_repo, check_repo):
    monitor = await _make_monitor(monitor_repo)
    now = datetime.now(UTC)
    await _insert_check(check_repo, monitor["_id"], "UP", now - timedelta(hours=1))
    await _insert_check(check_repo, monitor["_id"], "DOWN", now - timedelta(days=10))  # outside 24h window

    metrics = MetricsService(check_repo, monitor_repo)
    stats = await metrics.get_uptime(str(monitor["_id"]), "24h")
    assert stats.total_checks == 1
    assert stats.uptime_percentage == 100.0
