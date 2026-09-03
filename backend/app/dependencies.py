from fastapi import Request

from app.services.check_service import CheckService
from app.services.incident_service import IncidentService
from app.services.metrics_service import MetricsService
from app.services.monitor_service import MonitorService
from app.services.notification_service import NotificationService


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
