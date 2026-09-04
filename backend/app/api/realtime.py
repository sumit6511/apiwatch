import asyncio
import logging
import secrets

import jwt
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ValidationError

from app.config import get_settings
from app.dependencies import get_connection_manager
from app.realtime import ConnectionManager
from app.security import decode_user_token

logger = logging.getLogger("apiwatch.realtime")

router = APIRouter(tags=["realtime"])

AUTH_MESSAGE_TIMEOUT_SECONDS = 10
WS_UNAUTHORIZED_CODE = 4401


class _AuthMessage(BaseModel):
    access_key: str = ""
    user_token: str


@router.websocket("/ws/updates")
async def updates(
    websocket: WebSocket,
    manager: ConnectionManager = Depends(get_connection_manager),
) -> None:
    """Live push for monitor/check/incident changes -- polling stays in
    place as a fallback (see frontend useRealtimeUpdates), this just makes
    updates arrive the instant a scheduled or manual check completes
    instead of up to REFRESH_INTERVAL_MS late.

    Not registered behind require_access_key/get_current_user_id like the
    HTTP routers: a browser's native WebSocket API can't set the
    Authorization/X-User-Token headers those depend on. Auth instead
    happens in-band -- the first message received after the handshake must
    carry both credentials, checked here by hand; the connection is closed
    immediately if they don't check out, before it's ever registered to
    receive anything."""
    settings = get_settings()
    await websocket.accept()

    try:
        raw = await asyncio.wait_for(websocket.receive_json(), timeout=AUTH_MESSAGE_TIMEOUT_SECONDS)
        auth = _AuthMessage.model_validate(raw)
    except WebSocketDisconnect:
        return
    except (TimeoutError, ValidationError, ValueError):
        await websocket.close(code=WS_UNAUTHORIZED_CODE)
        return

    if settings.api_access_key and not secrets.compare_digest(auth.access_key, settings.api_access_key):
        await websocket.close(code=WS_UNAUTHORIZED_CODE)
        return

    try:
        payload = decode_user_token(auth.user_token)
        owner_id = payload["sub"]
    except jwt.PyJWTError:
        await websocket.close(code=WS_UNAUTHORIZED_CODE)
        return

    manager.register(owner_id, websocket)
    logger.info("ws_connected owner_id=%s", owner_id)
    try:
        # No further client->server messages are expected -- this just
        # blocks until the socket closes (tab closed, network drop) so the
        # connection gets unregistered promptly instead of leaking.
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.unregister(owner_id, websocket)
        logger.info("ws_disconnected owner_id=%s", owner_id)
