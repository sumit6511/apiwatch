from datetime import UTC, datetime

import httpx
import pytest
import respx
from bson import ObjectId

from app.models.enums import MonitorStatus
from app.monitoring.checker import MonitorChecker
from app.services.incident_service import IncidentService

TEST_URL = "https://example.com/incident-probe"
OWNER_ID = str(ObjectId())


class FakeNotificationService:
    """Records send_to_channels calls instead of hitting a real webhook."""

    def __init__(self):
        self.sent = []

    async def send_to_channels(self, channel_ids, event):
        self.sent.append(event)


@pytest.fixture
def notifications():
    return FakeNotificationService()


async def _make_monitor(monitor_repo, **overrides):
    now = datetime.now(UTC)
    doc = {
        "owner_id": ObjectId(OWNER_ID),
        "name": "test monitor",
        "url": TEST_URL,
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
    doc.update(overrides)
    return await monitor_repo.create(doc)


@respx.mock
async def test_first_failure_opens_exactly_one_incident(monitor_repo, check_repo, incident_repo, notifications):
    respx.get(TEST_URL).mock(return_value=httpx.Response(500))
    incident_service = IncidentService(incident_repo)
    checker = MonitorChecker(check_repo, monitor_repo, incident_service, notifications)

    monitor = await _make_monitor(monitor_repo)
    await checker.run_check(monitor)

    monitor_id = str(monitor["_id"])
    incidents = await incident_service.list_for_monitor(monitor_id)
    assert len(incidents) == 1
    assert incidents[0]["status"] == "OPEN"
    assert incidents[0]["owner_id"] == ObjectId(OWNER_ID)

    updated_monitor = await monitor_repo.get(monitor_id, OWNER_ID)
    assert updated_monitor["current_status"] == MonitorStatus.DOWN
    assert len(notifications.sent) == 1
    assert notifications.sent[0].event_type == "outage"


@respx.mock
async def test_repeated_failures_do_not_duplicate_incident_or_notify_again(
    monitor_repo, check_repo, incident_repo, notifications
):
    respx.get(TEST_URL).mock(return_value=httpx.Response(500))
    incident_service = IncidentService(incident_repo)
    checker = MonitorChecker(check_repo, monitor_repo, incident_service, notifications)

    monitor = await _make_monitor(monitor_repo)
    monitor_id = str(monitor["_id"])

    for _ in range(3):
        monitor = await monitor_repo.get(monitor_id, OWNER_ID)
        await checker.run_check(monitor)

    incidents = await incident_service.list_for_monitor(monitor_id)
    assert len(incidents) == 1

    outage_events = [e for e in notifications.sent if e.event_type == "outage"]
    assert len(outage_events) == 1


@respx.mock
async def test_recovery_resolves_incident_and_sends_one_recovery_notification(
    monitor_repo, check_repo, incident_repo, notifications
):
    incident_service = IncidentService(incident_repo)
    checker = MonitorChecker(check_repo, monitor_repo, incident_service, notifications)

    respx.get(TEST_URL).mock(return_value=httpx.Response(500))
    monitor = await _make_monitor(monitor_repo)
    monitor_id = str(monitor["_id"])
    await checker.run_check(monitor)

    respx.get(TEST_URL).mock(return_value=httpx.Response(200))
    monitor = await monitor_repo.get(monitor_id, OWNER_ID)
    await checker.run_check(monitor)

    monitor = await monitor_repo.get(monitor_id, OWNER_ID)
    assert monitor["current_status"] == MonitorStatus.UP
    assert monitor["open_incident_id"] is None

    incidents = await incident_service.list_for_monitor(monitor_id)
    assert len(incidents) == 1
    assert incidents[0]["status"] == "RESOLVED"
    assert incidents[0]["resolved_at"] is not None

    recovery_events = [e for e in notifications.sent if e.event_type == "recovery"]
    assert len(recovery_events) == 1
