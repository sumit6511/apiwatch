import httpx
import pytest
import pytest_asyncio
import respx

from app.errors import MonitorNotFoundError, SSRFBlockedError
from app.models.enums import MonitorStatus
from app.monitoring.checker import MonitorChecker
from app.monitoring.scheduler import SchedulerManager
from app.schemas.monitor import MonitorCreate, MonitorUpdate
from app.services.check_service import CheckService
from app.services.incident_service import IncidentService
from app.services.monitor_service import MonitorService

TEST_URL = "https://example.com/monitor-crud"


class FakeNotificationService:
    async def send_to_channels(self, channel_ids, event):
        pass


@pytest_asyncio.fixture
async def monitor_service(monitor_repo, check_repo, incident_repo):
    # SchedulerManager.start() needs a running event loop, so this fixture
    # (and every test using it) must be async.
    incident_service = IncidentService(incident_repo)
    checker = MonitorChecker(check_repo, monitor_repo, incident_service, FakeNotificationService())
    scheduler = SchedulerManager(checker, monitor_repo)
    scheduler.start()
    service = MonitorService(monitor_repo, check_repo, incident_repo, scheduler, checker)
    yield service
    scheduler.shutdown()


@respx.mock
async def test_create_runs_initial_check_and_registers_scheduler_job(monitor_service):
    respx.get(TEST_URL).mock(return_value=httpx.Response(200))
    created = await monitor_service.create(MonitorCreate(name="crud test", url=TEST_URL, interval_seconds=30))

    assert created.status == MonitorStatus.UP
    assert created.last_checked_at is not None
    assert monitor_service._scheduler._scheduler.get_job(f"monitor:{created.id}") is not None


async def test_create_rejects_ssrf_blocked_url(monitor_service):
    with pytest.raises(SSRFBlockedError):
        await monitor_service.create(
            MonitorCreate(name="bad", url="http://127.0.0.1/", interval_seconds=30)
        )


@respx.mock
async def test_get_update_delete_roundtrip(monitor_service):
    respx.get(TEST_URL).mock(return_value=httpx.Response(200))
    created = await monitor_service.create(MonitorCreate(name="crud", url=TEST_URL, interval_seconds=30))

    fetched = await monitor_service.get(created.id)
    assert fetched.id == created.id

    updated = await monitor_service.update(created.id, MonitorUpdate(name="renamed"))
    assert updated.name == "renamed"

    await monitor_service.delete(created.id)
    with pytest.raises(MonitorNotFoundError):
        await monitor_service.get(created.id)
    assert monitor_service._scheduler._scheduler.get_job(f"monitor:{created.id}") is None


@respx.mock
async def test_delete_cascades_to_checks_and_incidents(monitor_service, check_repo, incident_repo):
    respx.get(TEST_URL).mock(return_value=httpx.Response(500))
    created = await monitor_service.create(MonitorCreate(name="crud", url=TEST_URL, interval_seconds=30))

    assert await check_repo.list_for_monitor(created.id, limit=10)
    incident_service = IncidentService(incident_repo)
    assert await incident_service.list_for_monitor(created.id)

    await monitor_service.delete(created.id)

    assert await check_repo.list_for_monitor(created.id, limit=10) == []
    assert await incident_service.list_for_monitor(created.id) == []


@respx.mock
async def test_interval_update_reschedules_job(monitor_service):
    respx.get(TEST_URL).mock(return_value=httpx.Response(200))
    created = await monitor_service.create(MonitorCreate(name="crud", url=TEST_URL, interval_seconds=30))

    await monitor_service.update(created.id, MonitorUpdate(interval_seconds=120))
    job = monitor_service._scheduler._scheduler.get_job(f"monitor:{created.id}")
    assert job.trigger.interval.total_seconds() == 120


@respx.mock
async def test_pause_removes_job_and_resume_recreates_it(monitor_service):
    respx.get(TEST_URL).mock(return_value=httpx.Response(200))
    created = await monitor_service.create(MonitorCreate(name="crud", url=TEST_URL, interval_seconds=30))
    job_id = f"monitor:{created.id}"

    paused = await monitor_service.pause(created.id)
    assert paused.status == MonitorStatus.PAUSED
    assert paused.is_active is False
    assert monitor_service._scheduler._scheduler.get_job(job_id) is None

    resumed = await monitor_service.resume(created.id)
    assert resumed.is_active is True
    assert monitor_service._scheduler._scheduler.get_job(job_id) is not None


@respx.mock
async def test_resume_while_down_keeps_same_incident_no_duplicate(monitor_service, incident_repo):
    """Regression test: pausing a DOWN monitor and resuming it (while still
    failing) must land back in DOWN and keep the SAME open incident -- not
    reset to UNKNOWN (which would open a second, orphaned incident) and not
    silently drop the incident reference either."""
    respx.get(TEST_URL).mock(return_value=httpx.Response(500))
    created = await monitor_service.create(MonitorCreate(name="crud", url=TEST_URL, interval_seconds=30))
    assert created.status == MonitorStatus.DOWN

    await monitor_service.pause(created.id)
    resumed = await monitor_service.resume(created.id)
    assert resumed.status == MonitorStatus.DOWN

    incident_service = IncidentService(incident_repo)
    incidents = await incident_service.list_for_monitor(created.id)
    assert len(incidents) == 1
    assert incidents[0]["status"] == "OPEN"


@respx.mock
async def test_resume_while_down_then_recovering_resolves_the_original_incident(
    monitor_service, incident_repo
):
    respx.get(TEST_URL).mock(return_value=httpx.Response(500))
    created = await monitor_service.create(MonitorCreate(name="crud", url=TEST_URL, interval_seconds=30))
    await monitor_service.pause(created.id)
    await monitor_service.resume(created.id)

    respx.get(TEST_URL).mock(return_value=httpx.Response(200))
    check_service = CheckService(
        monitor_service._check_repo, monitor_service._monitor_repo, monitor_service._checker, 0
    )
    await check_service.run_manual_check(created.id)

    final = await monitor_service.get(created.id)
    assert final.status == MonitorStatus.UP

    incident_service = IncidentService(incident_repo)
    incidents = await incident_service.list_for_monitor(created.id)
    assert len(incidents) == 1
    assert incidents[0]["status"] == "RESOLVED"
