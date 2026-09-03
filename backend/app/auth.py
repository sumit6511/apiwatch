"""Shared-secret API access control.

Deliberately not a user/session system -- spec section 5 explicitly scoped
full authentication out of v1 ("do not spend most of the project
implementing authentication"). But a monitoring dashboard that's fully open
on the public internet lets anyone create/pause/delete monitors or read
incident history, and -- more concerning -- lets anyone use this server to
send outbound requests at arbitrary public URLs of their choosing. A single
shared key, checked on every route except /api/health, closes that at
near-zero implementation cost.

If API_ACCESS_KEY is unset (the default), this is a no-op -- local dev and
tests are unaffected.
"""

import secrets

from fastapi import Header, status

from app.config import get_settings
from app.errors import AppError


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Missing or invalid access key."):
        super().__init__("UNAUTHORIZED", message, status.HTTP_401_UNAUTHORIZED)


async def require_access_key(authorization: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if not settings.api_access_key:
        return

    provided = ""
    if authorization and authorization.startswith("Bearer "):
        provided = authorization[len("Bearer ") :]

    # Constant-time comparison -- this is a shared secret, not a public value.
    if not secrets.compare_digest(provided, settings.api_access_key):
        raise UnauthorizedError()
