import pytest

from app.errors import InvalidURLError, SSRFBlockedError
from app.monitoring.url_validator import validate_url


async def test_valid_https_url_passes():
    assert await validate_url("https://example.com") == "https://example.com"


async def test_valid_http_url_passes():
    assert await validate_url("http://example.com") == "http://example.com"


async def test_invalid_protocol_rejected():
    with pytest.raises(InvalidURLError):
        await validate_url("ftp://example.com")


async def test_missing_hostname_rejected():
    with pytest.raises(InvalidURLError):
        await validate_url("https:///no-host")


async def test_empty_url_rejected():
    with pytest.raises(InvalidURLError):
        await validate_url("")


async def test_localhost_blocked():
    with pytest.raises(SSRFBlockedError):
        await validate_url("http://localhost/")


async def test_loopback_ip_blocked():
    with pytest.raises(SSRFBlockedError):
        await validate_url("http://127.0.0.1/")


async def test_private_ip_10_blocked():
    with pytest.raises(SSRFBlockedError):
        await validate_url("http://10.0.0.5/")


async def test_private_ip_192_blocked():
    with pytest.raises(SSRFBlockedError):
        await validate_url("http://192.168.1.1/")


async def test_private_ip_172_blocked():
    with pytest.raises(SSRFBlockedError):
        await validate_url("http://172.16.0.1/")


async def test_cloud_metadata_endpoint_blocked():
    with pytest.raises(SSRFBlockedError):
        await validate_url("http://169.254.169.254/latest/meta-data/")


async def test_ipv6_loopback_blocked():
    with pytest.raises(SSRFBlockedError):
        await validate_url("http://[::1]/")


async def test_ipv6_unique_local_blocked():
    with pytest.raises(SSRFBlockedError):
        await validate_url("http://[fc00::1]/")


async def test_ipv6_link_local_blocked():
    with pytest.raises(SSRFBlockedError):
        await validate_url("http://[fe80::1]/")


async def test_ipv4_mapped_ipv6_loopback_blocked():
    with pytest.raises(SSRFBlockedError):
        await validate_url("http://[::ffff:127.0.0.1]/")
