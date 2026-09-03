from fastapi import Request, status
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Application-level error mapped to a consistent {"error": {...}} response body."""

    def __init__(self, code: str, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class InvalidURLError(AppError):
    def __init__(self, message: str = "The provided URL is not valid."):
        super().__init__("INVALID_URL", message, status.HTTP_400_BAD_REQUEST)


class SSRFBlockedError(AppError):
    def __init__(self, message: str = "The provided URL is not allowed."):
        super().__init__("SSRF_BLOCKED", message, status.HTTP_400_BAD_REQUEST)


class MonitorNotFoundError(AppError):
    def __init__(self, message: str = "Monitor not found."):
        super().__init__("MONITOR_NOT_FOUND", message, status.HTTP_404_NOT_FOUND)


class InvalidIntervalError(AppError):
    def __init__(self, message: str):
        super().__init__("INVALID_INTERVAL", message, status.HTTP_422_UNPROCESSABLE_CONTENT)


class InvalidTimeoutError(AppError):
    def __init__(self, message: str):
        super().__init__("INVALID_TIMEOUT", message, status.HTTP_422_UNPROCESSABLE_CONTENT)


class InvalidStatusCodesError(AppError):
    def __init__(self, message: str):
        super().__init__("INVALID_STATUS_CODES", message, status.HTTP_422_UNPROCESSABLE_CONTENT)


class CheckFailedError(AppError):
    def __init__(self, message: str):
        super().__init__("CHECK_FAILED", message, status.HTTP_502_BAD_GATEWAY)


class RateLimitedError(AppError):
    def __init__(self, message: str = "Too many requests. Please slow down."):
        super().__init__("RATE_LIMITED", message, status.HTTP_429_TOO_MANY_REQUESTS)


class NotificationNotFoundError(AppError):
    def __init__(self, message: str = "Notification channel not found."):
        super().__init__("NOTIFICATION_NOT_FOUND", message, status.HTTP_404_NOT_FOUND)


class NotificationFailedError(AppError):
    def __init__(self, message: str):
        super().__init__("NOTIFICATION_FAILED", message, status.HTTP_502_BAD_GATEWAY)


class EmailTakenError(AppError):
    def __init__(self, message: str = "An account with this email already exists."):
        super().__init__("EMAIL_TAKEN", message, status.HTTP_409_CONFLICT)


class InvalidCredentialsError(AppError):
    def __init__(self, message: str = "Incorrect email or password."):
        super().__init__("INVALID_CREDENTIALS", message, status.HTTP_401_UNAUTHORIZED)


class InvalidSessionError(AppError):
    """Distinct code from app.auth.UnauthorizedError ("UNAUTHORIZED", the
    shared API_ACCESS_KEY gate) on purpose -- both are 401s, but the
    frontend needs to tell them apart to show the right lock screen
    (deployment access key vs. user login) and clear only the relevant
    stored token."""

    def __init__(self, message: str = "Missing or invalid session. Please log in again."):
        super().__init__("INVALID_SESSION", message, status.HTTP_401_UNAUTHORIZED)


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )
