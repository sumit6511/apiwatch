import pytest_asyncio

from app.monitoring.scheduler import SchedulerManager


class FakeMonitorRepo:
    def __init__(self, monitors: dict | None = None):
        self._monitors = monitors or {}

    async def get(self, monitor_id: str):
        return self._monitors.get(monitor_id)

    async def list_all(self, active_only: bool = False):
        return list(self._monitors.values())


@pytest_asyncio.fixture
async def scheduler_manager():
    # AsyncIOScheduler.start() needs a running event loop, so this fixture
    # (and every test using it) must be async.
    manager = SchedulerManager(checker=None, monitor_repo=FakeMonitorRepo())
    manager.start()
    yield manager
    manager.shutdown()


async def test_add_job_registers_it_under_stable_monitor_id(scheduler_manager):
    scheduler_manager.add_or_update_job("mon1", 30)
    assert scheduler_manager._scheduler.get_job("monitor:mon1") is not None


async def test_update_job_replaces_interval_without_duplicating(scheduler_manager):
    scheduler_manager.add_or_update_job("mon1", 30)
    scheduler_manager.add_or_update_job("mon1", 60)

    job = scheduler_manager._scheduler.get_job("monitor:mon1")
    assert job is not None
    assert job.trigger.interval.total_seconds() == 60
    assert len(scheduler_manager._scheduler.get_jobs()) == 1


async def test_pause_removes_the_job(scheduler_manager):
    scheduler_manager.add_or_update_job("mon1", 30)
    scheduler_manager.remove_job("mon1")
    assert scheduler_manager._scheduler.get_job("monitor:mon1") is None


async def test_resume_recreates_the_job(scheduler_manager):
    scheduler_manager.add_or_update_job("mon1", 30)
    scheduler_manager.remove_job("mon1")
    scheduler_manager.add_or_update_job("mon1", 30)
    assert scheduler_manager._scheduler.get_job("monitor:mon1") is not None


async def test_delete_removes_the_job(scheduler_manager):
    scheduler_manager.add_or_update_job("mon1", 30)
    scheduler_manager.remove_job("mon1")
    assert scheduler_manager._scheduler.get_job("monitor:mon1") is None


async def test_removing_a_nonexistent_job_is_a_noop(scheduler_manager):
    scheduler_manager.remove_job("does-not-exist")


async def test_register_active_monitors_creates_one_job_per_monitor():
    monitors = {
        "m1": {"_id": "m1", "interval_seconds": 30, "is_active": True},
        "m2": {"_id": "m2", "interval_seconds": 60, "is_active": True},
    }
    manager = SchedulerManager(checker=None, monitor_repo=FakeMonitorRepo(monitors))
    await manager.register_active_monitors()
    assert manager._scheduler.get_job("monitor:m1") is not None
    assert manager._scheduler.get_job("monitor:m2") is not None
