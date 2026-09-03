import logging
from datetime import UTC, datetime
from typing import Any

from app.db.repositories.users import UserRepository
from app.errors import EmailTakenError, InvalidCredentialsError
from app.schemas.user import TokenResponse, UserLogin, UserOut, UserSignup
from app.security import create_user_token, hash_password, verify_password

logger = logging.getLogger("apiwatch.auth")


def _to_user_out(doc: dict[str, Any]) -> UserOut:
    return UserOut(id=str(doc["_id"]), email=doc["email"], created_at=doc["created_at"])


class AuthService:
    def __init__(self, repo: UserRepository):
        self._repo = repo

    async def signup(self, data: UserSignup) -> TokenResponse:
        email = data.email.lower()
        existing = await self._repo.get_by_email(email)
        if existing is not None:
            raise EmailTakenError()

        document = {
            "email": email,
            "password_hash": hash_password(data.password),
            "created_at": datetime.now(UTC),
        }
        created = await self._repo.create(document)
        logger.info("user_signed_up user_id=%s", created["_id"])

        token = create_user_token(str(created["_id"]), email)
        return TokenResponse(token=token, user=_to_user_out(created))

    async def login(self, data: UserLogin) -> TokenResponse:
        email = data.email.lower()
        user = await self._repo.get_by_email(email)
        # Same error either way -- don't let a login attempt reveal whether
        # an email is registered.
        if user is None or not verify_password(data.password, user["password_hash"]):
            raise InvalidCredentialsError()

        logger.info("user_logged_in user_id=%s", user["_id"])
        token = create_user_token(str(user["_id"]), email)
        return TokenResponse(token=token, user=_to_user_out(user))

    async def get_user(self, user_id: str) -> UserOut | None:
        user = await self._repo.get_by_id(user_id)
        return _to_user_out(user) if user else None
