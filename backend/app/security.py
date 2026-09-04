from datetime import UTC, datetime, timedelta
from functools import lru_cache

import bcrypt
import jwt
from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings
from app.models.enums import NotificationType

JWT_ALGORITHM = "HS256"


@lru_cache
def _fernet() -> Fernet:
    key = get_settings().encryption_key
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_secret(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Could not decrypt stored secret; ENCRYPTION_KEY may have changed.") from exc


def mask_webhook_url(url: str) -> str:
    """Never expose a full webhook URL. Show only enough to identify it."""
    if len(url) <= 12:
        return "•" * 12
    return f"{url[:24]}{'•' * 12}"


def mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    if not domain:
        return "•" * 12
    visible = local[:1] or "•"
    return f"{visible}{'•' * max(len(local) - 1, 3)}@{domain}"


def mask_channel_config(channel_type: NotificationType, config: dict[str, str]) -> str:
    """A short, safe-to-display summary of where a notification channel
    sends -- never the credential itself. Shape depends on the channel type."""
    if channel_type == NotificationType.DISCORD:
        return mask_webhook_url(config["webhook_url"])
    if channel_type == NotificationType.TELEGRAM:
        chat_id = config["chat_id"]
        suffix = chat_id[-4:] if len(chat_id) >= 4 else "••••"
        return f"Telegram chat •••{suffix}"
    if channel_type == NotificationType.EMAIL:
        return mask_email(config["to_email"])
    return "••••••••"


# ── User auth ────────────────────────────────────────────────────────────
# bcrypt only looks at the first 72 bytes of the input -- irrelevant in
# practice (72 bytes of password is already an enormous keyspace), but worth
# knowing rather than being surprised by it.


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # Malformed stored hash -- fail closed, never treat as a match.
        return False


def create_user_token(user_id: str, email: str) -> str:
    """Session token for a logged-in user. Distinct from the Fernet-based
    encrypt_secret above (that's for webhook URLs at rest) and from the
    shared API_ACCESS_KEY bearer token (that's a deployment-wide gate, not
    tied to any one user) -- this identifies *which* account is calling."""
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(days=settings.jwt_expire_days),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=JWT_ALGORITHM)


def decode_user_token(token: str) -> dict:
    """Raises jwt.PyJWTError (or a subclass) on an invalid/expired token --
    the caller (app.dependencies.get_current_user_id) maps that to a 401."""
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[JWT_ALGORITHM])
