import time

import jwt
import pytest

from app.config import get_settings
from app.db.repositories.users import UserRepository
from app.dependencies import get_current_user_id
from app.errors import AppError, EmailTakenError, InvalidCredentialsError, InvalidSessionError
from app.schemas.user import UserLogin, UserSignup
from app.security import create_user_token, decode_user_token, hash_password, verify_password
from app.services.auth_service import AuthService


@pytest.fixture
def auth_service(test_db):
    return AuthService(UserRepository(test_db))


async def test_signup_creates_a_user_with_a_hashed_password(auth_service, test_db):
    result = await auth_service.signup(UserSignup(email="alice@example.com", password="correct-horse"))
    assert result.user.email == "alice@example.com"
    assert result.token

    stored = await test_db.users.find_one({"email": "alice@example.com"})
    assert stored is not None
    assert stored["password_hash"] != "correct-horse"
    assert verify_password("correct-horse", stored["password_hash"])


async def test_signup_lowercases_email_so_it_cant_be_used_twice_with_different_casing(auth_service):
    await auth_service.signup(UserSignup(email="Bob@Example.com", password="correct-horse"))
    with pytest.raises(EmailTakenError):
        await auth_service.signup(UserSignup(email="bob@example.com", password="another-password"))


async def test_login_with_correct_password_succeeds(auth_service):
    await auth_service.signup(UserSignup(email="carol@example.com", password="correct-horse"))
    result = await auth_service.login(UserLogin(email="carol@example.com", password="correct-horse"))
    assert result.user.email == "carol@example.com"


async def test_login_with_wrong_password_rejected(auth_service):
    await auth_service.signup(UserSignup(email="dave@example.com", password="correct-horse"))
    with pytest.raises(InvalidCredentialsError):
        await auth_service.login(UserLogin(email="dave@example.com", password="wrong-password"))


async def test_login_with_unknown_email_rejected_with_the_same_error_as_wrong_password(auth_service):
    """Same error for both cases -- a login attempt shouldn't reveal whether
    an email is registered."""
    with pytest.raises(InvalidCredentialsError):
        await auth_service.login(UserLogin(email="nobody@example.com", password="whatever123"))


def test_password_hashing_round_trip():
    hashed = hash_password("s3cret-password")
    assert hashed != "s3cret-password"
    assert verify_password("s3cret-password", hashed)
    assert not verify_password("wrong", hashed)


async def test_jwt_round_trip_via_get_current_user_id():
    token = create_user_token("507f1f77bcf86cd799439011", "test@example.com")
    user_id = await get_current_user_id(x_user_token=token)
    assert user_id == "507f1f77bcf86cd799439011"


async def test_missing_token_rejected():
    with pytest.raises(AppError) as exc_info:
        await get_current_user_id(x_user_token=None)
    assert exc_info.value.code == "INVALID_SESSION"


async def test_malformed_token_rejected():
    with pytest.raises(InvalidSessionError):
        await get_current_user_id(x_user_token="not-a-real-jwt")


async def test_expired_token_rejected():
    settings = get_settings()
    expired_payload = {
        "sub": "507f1f77bcf86cd799439011",
        "email": "test@example.com",
        "iat": time.time() - 120,
        "exp": time.time() - 60,
    }
    expired_token = jwt.encode(expired_payload, settings.jwt_secret_key, algorithm="HS256")
    with pytest.raises(InvalidSessionError):
        await get_current_user_id(x_user_token=expired_token)


async def test_token_signed_with_a_different_key_is_rejected():
    forged = jwt.encode(
        {"sub": "507f1f77bcf86cd799439011", "email": "x@example.com"},
        "not-the-real-secret",
        algorithm="HS256",
    )
    with pytest.raises(InvalidSessionError):
        await get_current_user_id(x_user_token=forged)


def test_decode_user_token_matches_create_user_token():
    token = create_user_token("507f1f77bcf86cd799439011", "test@example.com")
    payload = decode_user_token(token)
    assert payload["sub"] == "507f1f77bcf86cd799439011"
    assert payload["email"] == "test@example.com"
