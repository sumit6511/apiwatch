"""Shared fixtures.

DB-touching tests run against a real MongoDB Atlas database
(`MONGODB_TEST_DATABASE`, default `apiwatch_test`) -- a different database
than the dev `apiwatch` one, on the same cluster the app already uses.
Collections are wiped after every test for isolation. Pure-logic tests
(state machine, URL validator, checker classification) don't touch the
database at all.
"""

import pytest_asyncio
from pymongo import AsyncMongoClient

from app.config import get_settings
from app.db.indexes import ensure_indexes
from app.db.repositories.checks import CheckRepository
from app.db.repositories.incidents import IncidentRepository
from app.db.repositories.monitors import MonitorRepository
from app.db.repositories.notifications import NotificationRepository
from app.db.repositories.users import UserRepository

COLLECTIONS = ["monitors", "checks", "incidents", "notification_channels", "users"]


@pytest_asyncio.fixture
async def test_db():
    settings = get_settings()
    client = AsyncMongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=8000)
    db = client[settings.mongodb_test_database]
    await ensure_indexes(db)
    try:
        yield db
    finally:
        for name in COLLECTIONS:
            await db[name].delete_many({})
        await client.close()


@pytest_asyncio.fixture
async def monitor_repo(test_db):
    return MonitorRepository(test_db)


@pytest_asyncio.fixture
async def check_repo(test_db):
    return CheckRepository(test_db)


@pytest_asyncio.fixture
async def incident_repo(test_db):
    return IncidentRepository(test_db)


@pytest_asyncio.fixture
async def notification_repo(test_db):
    return NotificationRepository(test_db)


@pytest_asyncio.fixture
async def user_repo(test_db):
    return UserRepository(test_db)
