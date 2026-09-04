import jwt
from fastapi import Header, Request, WebSocket

from app.errors import InvalidSessionError
from app.realtime import ConnectionManager
from app.security import decode_user_token
from app.services.auth_service import AuthService
from app.services.check_service import CheckService
from app.services.incident_service import IncidentService
from app.services.metrics_service import MetricsService
from app.services.monitor_service import MonitorService
from app.services.notification_service import NotificationService
from app.services.status_page_service import StatusPageService


def get_monitor_service(request: Request) -> MonitorService:
    return request.app.state.monitor_service


def get_check_service(request: Request) -> CheckService:
    return request.app.state.check_service


def get_incident_service(request: Request) -> IncidentService:
    return request.app.state.incident_service


def get_metrics_service(request: Request) -> MetricsService:
    return request.app.state.metrics_service


def get_notification_service(request: Request) -> NotificationService:
    return request.app.state.notification_service


def get_auth_service(request: Request) -> AuthService:
    return request.app.state.auth_service


def get_status_page_service(request: Request) -> StatusPageService:
    return request.app.state.status_page_service


def get_connection_manager(websocket: WebSocket) -> ConnectionManager:
    return websocket.app.state.connection_manager


async def get_current_user_id(x_user_token: str | None = Header(default=None)) -> str:
    """Per-user identity, layered on top of (not instead of) the shared
    API_ACCESS_KEY gate in app/auth.py -- that's a deployment-wide lock,
    this is which account is making the request. Deliberately a separate
    header (X-User-Token) rather than Authorization, which the access key
    already uses; the two checks are independent."""
    if not x_user_token:
        raise InvalidSessionError("Missing user session token.")

    try:
        payload = decode_user_token(x_user_token)
    except jwt.ExpiredSignatureError as exc:
        raise InvalidSessionError("Your session has expired. Please log in again.") from exc
    except jwt.PyJWTError as exc:
        raise InvalidSessionError("Invalid session token.") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise InvalidSessionError("Invalid session token.")
    return user_id
