from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings


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
