import httpx
import pytest
import pytest_asyncio
import respx
from bson import ObjectId
from pydantic import ValidationError

from app.monitoring.checker import MonitorChecker
from app.monitoring.scheduler import SchedulerManager
from app.schemas.monitor import MonitorCreate, MonitorUpdate
from app.services.incident_service import IncidentService
from app.services.monitor_service import MonitorService

TEST_URL = "https://example.com/monitor-tags"
OWNER_ID = str(ObjectId())


class FakeNotificationService:
    async def send_to_channels(self, channel_ids, event):
        pass


@pytest_asyncio.fixture
async def monitor_service(monitor_repo, check_repo, incident_repo, notification_repo):
    incident_service = IncidentService(incident_repo)
    checker = MonitorChecker(check_repo, monitor_repo, incident_service, FakeNotificationService())
    scheduler = SchedulerManager(checker, monitor_repo)
    scheduler.start()
    service = MonitorService(monitor_repo, check_repo, incident_repo, notification_repo, scheduler, checker)
    yield service
    scheduler.shutdown()


# ── Schema validation (pure, no DB) ────────────────────────────────────────


def test_tags_default_to_an_empty_list():
    monitor = MonitorCreate(name="x", url=TEST_URL)
    assert monitor.tags == []


def test_tags_are_trimmed():
    monitor = MonitorCreate(name="x", url=TEST_URL, tags=["  prod  ", "api"])
    assert monitor.tags == ["prod", "api"]


def test_blank_tags_are_rejected():
    with pytest.raises(ValidationError):
        MonitorCreate(name="x", url=TEST_URL, tags=["prod", "   "])


def test_duplicate_tags_are_deduplicated_case_insensitively():
    monitor = MonitorCreate(name="x", url=TEST_URL, tags=["Prod", "prod", "PROD"])
    assert monitor.tags == ["Prod"]


def test_too_many_tags_are_rejected():
    with pytest.raises(ValidationError):
        MonitorCreate(name="x", url=TEST_URL, tags=["a", "b", "c", "d", "e", "f"])


def test_an_overly_long_tag_is_rejected():
    with pytest.raises(ValidationError):
        MonitorCreate(name="x", url=TEST_URL, tags=["x" * 31])


def test_monitor_update_leaves_tags_untouched_when_omitted():
    update = MonitorUpdate(name="renamed")
    assert update.tags is None


# ── Threaded through create/update (service-level, real DB) ───────────────


@respx.mock
async def test_create_persists_tags(monitor_service):
    respx.get(TEST_URL).mock(return_value=httpx.Response(200))
    created = await monitor_service.create(
        MonitorCreate(name="tagged", url=TEST_URL, interval_seconds=30, tags=["prod", "api"]), OWNER_ID
    )
    assert created.tags == ["prod", "api"]


@respx.mock
async def test_create_without_tags_defaults_to_empty_list(monitor_service):
    respx.get(TEST_URL).mock(return_value=httpx.Response(200))
    created = await monitor_service.create(
        MonitorCreate(name="untagged", url=TEST_URL, interval_seconds=30), OWNER_ID
    )
    assert created.tags == []


@respx.mock
async def test_update_replaces_tags(monitor_service):
    respx.get(TEST_URL).mock(return_value=httpx.Response(200))
    created = await monitor_service.create(
        MonitorCreate(name="tagged", url=TEST_URL, interval_seconds=30, tags=["staging"]), OWNER_ID
    )
    updated = await monitor_service.update(created.id, OWNER_ID, MonitorUpdate(tags=["prod", "critical"]))
    assert updated.tags == ["prod", "critical"]


@respx.mock
async def test_update_without_tags_leaves_existing_tags_unchanged(monitor_service):
    respx.get(TEST_URL).mock(return_value=httpx.Response(200))
    created = await monitor_service.create(
        MonitorCreate(name="tagged", url=TEST_URL, interval_seconds=30, tags=["prod"]), OWNER_ID
    )
    updated = await monitor_service.update(created.id, OWNER_ID, MonitorUpdate(name="renamed"))
    assert updated.tags == ["prod"]
