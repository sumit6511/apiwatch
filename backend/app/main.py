import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import checks, health, incidents, monitors, notifications
from app.config import get_settings
from app.db.client import close_mongo_connection, connect_to_mongo, get_database
from app.db.indexes import ensure_indexes
from app.db.repositories.checks import CheckRepository
from app.db.repositories.incidents import IncidentRepository
from app.db.repositories.monitors import MonitorRepository
from app.db.repositories.notifications import NotificationRepository
from app.errors import AppError, app_error_handler
from app.monitoring.checker import MonitorChecker
from app.monitoring.scheduler import SchedulerManager
from app.services.check_service import CheckService
from app.services.incident_service import IncidentService
from app.services.metrics_service import MetricsService
from app.services.monitor_service import MonitorService
from app.services.notification_service import NotificationService

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("apiwatch")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    # 1. Connect to MongoDB and verify availability (fails fast if Atlas is unreachable).
    await connect_to_mongo()
    db = get_database()
    await ensure_indexes(db)

    monitor_repo = MonitorRepository(db)
    check_repo = CheckRepository(db)
    incident_repo = IncidentRepository(db)
    notification_repo = NotificationRepository(db)

    incident_service = IncidentService(incident_repo)
    notification_service = NotificationService(notification_repo)
    checker = MonitorChecker(check_repo, monitor_repo, incident_service, notification_service)

    scheduler = SchedulerManager(checker, monitor_repo)
    check_service = CheckService(
        check_repo, monitor_repo, checker, settings.manual_check_throttle_seconds
    )
    metrics_service = MetricsService(check_repo, monitor_repo)
    monitor_service = MonitorService(monitor_repo, check_repo, incident_repo, scheduler, checker)

    app.state.monitor_service = monitor_service
    app.state.check_service = check_service
    app.state.incident_service = incident_service
    app.state.metrics_service = metrics_service
    app.state.notification_service = notification_service
    app.state.scheduler = scheduler if settings.enable_scheduler else None

    # 3-5. Load active monitors, register their jobs, start the scheduler.
    #
    # NOTE (section 20/21): this scheduler is embedded in the FastAPI process
    # and uses an in-memory job store. `uvicorn --reload`'s reloader spawns a
    # fresh worker subprocess on code changes, but only ONE worker process
    # ever runs this lifespan at a time, so it does not by itself create
    # duplicate schedulers. What WOULD create duplicates is running this app
    # with multiple workers/replicas (`--workers N>1`, or several container
    # instances) while ENABLE_SCHEDULER=true on more than one of them -- do
    # not do that. Run exactly one instance with the scheduler enabled.
    if settings.enable_scheduler:
        scheduler.add_retention_job(check_service.cleanup_old_checks, hours=6)
        await scheduler.register_active_monitors()
        scheduler.start()
        logger.info("apiwatch_startup_complete scheduler=enabled")
    else:
        logger.info("apiwatch_startup_complete scheduler=disabled")

    yield

    if settings.enable_scheduler:
        scheduler.shutdown()
    await close_mongo_connection()
    logger.info("apiwatch_shutdown_complete")


app = FastAPI(
    title="APIWatch",
    description="Monitor your APIs. Track uptime. Detect failures before your users do.",
    version="1.0.0",
    lifespan=lifespan,
)

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppError, app_error_handler)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Keep FastAPI's own 422s in the same {"error": {...}} shape as AppError,
    and never leak a raw stack trace to the client (section 91)."""
    errors = exc.errors()
    first = errors[0] if errors else {}
    field = ".".join(str(p) for p in first.get("loc", []) if p != "body")
    message = first.get("msg", "Invalid request.")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": f"{field}: {message}" if field else message,
            }
        },
    )


app.include_router(health.router)
app.include_router(monitors.router)
app.include_router(checks.router)
app.include_router(checks.dashboard_router)
app.include_router(incidents.router)
app.include_router(notifications.router)
