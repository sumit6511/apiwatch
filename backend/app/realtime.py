import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger("apiwatch.realtime")


class ConnectionManager:
    """In-memory, per-account registry of live WebSocket connections, used
    to push dashboard updates the instant a check completes rather than
    waiting for the next poll.

    Single-process, in-memory by design -- same assumption the embedded
    scheduler already makes (see README "Scheduler Architecture"): fine at
    this app's scale, and a connection that's registered on instance A is
    simply invisible to a broadcast from instance B. Running multiple
    backend replicas would need a shared pub/sub layer (e.g. Redis) for
    this to reach every connected client; not implemented here for the same
    reason the scheduler isn't distributed."""

    def __init__(self):
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    def register(self, owner_id: str, websocket: WebSocket) -> None:
        self._connections[owner_id].add(websocket)

    def unregister(self, owner_id: str, websocket: WebSocket) -> None:
        self._connections[owner_id].discard(websocket)
        if not self._connections[owner_id]:
            del self._connections[owner_id]

    async def broadcast(self, owner_id: str, message: dict[str, Any]) -> None:
        """Best-effort -- a stale/dead connection that fails to send is
        dropped rather than raised, so one broken client can't affect
        others or the caller (the scheduler's check pipeline)."""
        dead: list[WebSocket] = []
        for websocket in self._connections.get(owner_id, ()):
            try:
                await websocket.send_json(message)
            except Exception:
                dead.append(websocket)
        for websocket in dead:
            self.unregister(owner_id, websocket)
