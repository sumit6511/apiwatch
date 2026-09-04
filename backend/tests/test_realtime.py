from datetime import UTC, datetime

import httpx
import pytest
import respx
from bson import ObjectId
from fastapi import WebSocketDisconnect

from app.api.realtime import WS_UNAUTHORIZED_CODE, updates
from app.config import get_settings
from app.models.enums import MonitorStatus
from app.monitoring.checker import MonitorChecker
from app.realtime import ConnectionManager
from app.security import create_user_token
from app.services.incident_service import IncidentService

TEST_URL = "https://example.com/realtime-probe"
OWNER_ID = str(ObjectId())


class FakeWebSocket:
    def __init__(self, fail: bool = False):
        self.fail = fail
        self.sent: list[dict] = []

    async def send_json(self, message: dict) -> None:
        if self.fail:
            raise RuntimeError("connection closed")
        self.sent.append(message)


class FakeNotificationService:
    async def send_to_channels(self, channel_ids, event):
        pass


# ── ConnectionManager (pure unit tests, no DB) ────────────────────────────


async def test_broadcast_sends_only_to_the_target_owners_connections():
    manager = ConnectionManager()
    ws_a = FakeWebSocket()
    ws_b = FakeWebSocket()
    manager.register("owner-a", ws_a)
    manager.register("owner-b", ws_b)

    await manager.broadcast("owner-a", {"type": "monitor_updated", "monitor_id": "m1"})

    assert ws_a.sent == [{"type": "monitor_updated", "monitor_id": "m1"}]
    assert ws_b.sent == []


async def test_broadcast_to_an_owner_with_no_connections_is_a_no_op():
    manager = ConnectionManager()
    await manager.broadcast("nobody-connected", {"type": "monitor_updated", "monitor_id": "m1"})


async def test_broadcast_delivers_to_every_connection_for_the_same_owner():
    manager = ConnectionManager()
    ws1 = FakeWebSocket()
    ws2 = FakeWebSocket()
    manager.register("owner-a", ws1)
    manager.register("owner-a", ws2)

    await manager.broadcast("owner-a", {"type": "monitor_updated"})

    assert len(ws1.sent) == 1
    assert len(ws2.sent) == 1


async def test_a_dead_connection_is_dropped_after_a_failed_send_and_not_retried():
    manager = ConnectionManager()
    dead = FakeWebSocket(fail=True)
    alive = FakeWebSocket()
    manager.register("owner-a", dead)
    manager.register("owner-a", alive)

    await manager.broadcast("owner-a", {"type": "x"})
    await manager.broadcast("owner-a", {"type": "y"})

    assert alive.sent == [{"type": "x"}, {"type": "y"}]


def test_unregister_is_safe_even_if_never_registered():
    manager = ConnectionManager()
    manager.unregister("owner-a", FakeWebSocket())


def test_unregister_removes_the_owner_entry_once_empty():
    manager = ConnectionManager()
    ws = FakeWebSocket()
    manager.register("owner-a", ws)
    manager.unregister("owner-a", ws)
    assert "owner-a" not in manager._connections


# ── MonitorChecker broadcasts on check completion ─────────────────────────


async def _make_monitor(monitor_repo):
    now = datetime.now(UTC)
    doc = {
        "owner_id": ObjectId(OWNER_ID),
        "name": "realtime monitor",
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
    return await monitor_repo.create(doc)


@respx.mock
async def test_run_check_broadcasts_a_monitor_updated_event_to_the_owner(monitor_repo, check_repo, incident_repo):
    respx.get(TEST_URL).mock(return_value=httpx.Response(200))
    monitor = await _make_monitor(monitor_repo)

    manager = ConnectionManager()
    ws = FakeWebSocket()
    manager.register(OWNER_ID, ws)

    checker = MonitorChecker(
        check_repo, monitor_repo, IncidentService(incident_repo), FakeNotificationService(), manager
    )
    await checker.run_check(monitor)

    assert ws.sent == [{"type": "monitor_updated", "monitor_id": str(monitor["_id"])}]


@respx.mock
async def test_run_check_never_broadcasts_to_a_different_owner(monitor_repo, check_repo, incident_repo):
    respx.get(TEST_URL).mock(return_value=httpx.Response(200))
    monitor = await _make_monitor(monitor_repo)

    manager = ConnectionManager()
    other_owner_ws = FakeWebSocket()
    manager.register(str(ObjectId()), other_owner_ws)

    checker = MonitorChecker(
        check_repo, monitor_repo, IncidentService(incident_repo), FakeNotificationService(), manager
    )
    await checker.run_check(monitor)

    assert other_owner_ws.sent == []


@respx.mock
async def test_run_check_with_no_connection_manager_does_not_error(monitor_repo, check_repo, incident_repo):
    """connection_manager defaults to None -- every existing test that
    constructs a MonitorChecker without one must keep working unchanged."""
    respx.get(TEST_URL).mock(return_value=httpx.Response(200))
    monitor = await _make_monitor(monitor_repo)

    checker = MonitorChecker(check_repo, monitor_repo, IncidentService(incident_repo), FakeNotificationService())
    result = await checker.run_check(monitor)

    assert result["status"] == MonitorStatus.UP


# ── /ws/updates in-band auth (called directly, same pattern test_auth.py
# uses for require_access_key -- no ASGI transport/TestClient involved) ───


class FakeAuthWebSocket:
    def __init__(self, first_message: dict | None = None):
        self._first_message = first_message
        self.accepted = False
        self.closed_code: int | None = None

    async def accept(self) -> None:
        self.accepted = True

    async def receive_json(self) -> dict | None:
        return self._first_message

    async def receive_text(self) -> str:
        # Simulates the client disconnecting immediately after a successful
        # auth handshake, so the handler's read loop ends right away instead
        # of hanging the test.
        raise WebSocketDisconnect()

    async def close(self, code: int) -> None:
        self.closed_code = code


async def test_updates_closes_the_connection_when_the_access_key_is_wrong(monkeypatch):
    monkeypatch.setattr(get_settings(), "api_access_key", "secret123")
    ws = FakeAuthWebSocket(first_message={"access_key": "wrong", "user_token": "irrelevant"})
    manager = ConnectionManager()

    await updates(ws, manager)

    assert ws.closed_code == WS_UNAUTHORIZED_CODE


async def test_updates_closes_the_connection_on_an_invalid_user_token(monkeypatch):
    monkeypatch.setattr(get_settings(), "api_access_key", "")
    ws = FakeAuthWebSocket(first_message={"access_key": "", "user_token": "not-a-real-jwt"})
    manager = ConnectionManager()

    await updates(ws, manager)

    assert ws.closed_code == WS_UNAUTHORIZED_CODE


async def test_updates_closes_the_connection_on_a_malformed_first_message(monkeypatch):
    monkeypatch.setattr(get_settings(), "api_access_key", "")
    ws = FakeAuthWebSocket(first_message={"not": "the expected shape"})
    manager = ConnectionManager()

    await updates(ws, manager)

    assert ws.closed_code == WS_UNAUTHORIZED_CODE


async def test_updates_registers_then_unregisters_the_connection_on_a_valid_handshake(monkeypatch):
    monkeypatch.setattr(get_settings(), "api_access_key", "")
    token = create_user_token(OWNER_ID, "owner@example.com")
    ws = FakeAuthWebSocket(first_message={"access_key": "", "user_token": token})
    manager = ConnectionManager()

    await updates(ws, manager)

    assert ws.accepted is True
    assert ws.closed_code is None
    # Registered during the handshake, then unregistered once receive_text()
    # raised the simulated disconnect -- nothing left over.
    assert OWNER_ID not in manager._connections
