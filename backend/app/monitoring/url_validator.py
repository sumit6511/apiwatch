"""SSRF-focused URL validation.

Every user-supplied URL that APIWatch might request (on monitor create/update,
manual test, an immediately-preceding scheduled check, or a redirect hop) MUST
go through `validate_url` here. This is the single source of truth for what
counts as a safe destination -- do not re-implement scheme/IP checks elsewhere.

Limitation (documented, see README "Security"): we resolve the hostname and
validate the resolved IP right before connecting, which defeats a URL that is
simply *configured* to point at a private address. We do not, however,
guarantee immunity to DNS rebinding, where a name resolves to a public IP at
validation time and to a private IP a few milliseconds later when the
underlying HTTP library opens the socket. Full protection would require
pinning the resolved IP and connecting to it directly (bypassing the
resolver httpx/OpenSSL uses internally), which is out of scope for a v1
portfolio implementation.
"""

import asyncio
import ipaddress
import socket
from urllib.parse import urlsplit

from app.errors import InvalidURLError, SSRFBlockedError

ALLOWED_SCHEMES = {"http", "https"}
DEFAULT_PORTS = {"http": 80, "https": 443}
BLOCKED_HOSTNAMES = {"localhost", "localhost.localdomain", "ip6-localhost", "ip6-loopback"}


def _is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if (
        ip.is_loopback
        or ip.is_private
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    ):
        return True
    if isinstance(ip, ipaddress.IPv6Address):
        mapped = ip.ipv4_mapped
        if mapped is not None:
            return _is_blocked_ip(mapped)
    return False


async def validate_url(url: str) -> str:
    """Validate `url` is a well-formed http(s) URL that does not resolve to a
    private/loopback/link-local/reserved/metadata address. Returns the
    (unmodified) URL on success; raises InvalidURLError / SSRFBlockedError.
    """
    url = (url or "").strip()
    if not url:
        raise InvalidURLError("URL is required.")

    try:
        parts = urlsplit(url)
    except ValueError as exc:
        raise InvalidURLError(f"Could not parse URL: {exc}") from exc

    if parts.scheme.lower() not in ALLOWED_SCHEMES:
        raise InvalidURLError("Only http:// and https:// URLs are allowed.")

    hostname = parts.hostname
    if not hostname:
        raise InvalidURLError("URL must include a hostname.")

    if hostname.lower() in BLOCKED_HOSTNAMES:
        raise SSRFBlockedError(f"Requests to '{hostname}' are not allowed.")

    port = parts.port or DEFAULT_PORTS[parts.scheme.lower()]

    try:
        loop = asyncio.get_running_loop()
        infos = await loop.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise InvalidURLError(f"Could not resolve hostname '{hostname}'.") from exc

    if not infos:
        raise InvalidURLError(f"Could not resolve hostname '{hostname}'.")

    for family, _type, _proto, _canonname, sockaddr in infos:
        raw_ip = sockaddr[0]
        try:
            ip = ipaddress.ip_address(raw_ip)
        except ValueError:
            continue
        if _is_blocked_ip(ip):
            raise SSRFBlockedError(
                f"'{hostname}' resolves to a blocked address ({raw_ip}). "
                "Private, loopback, link-local, and metadata addresses are not allowed."
            )

    return url
