import httpx
import pytest
import respx

from app.models.enums import MonitorStatus
from app.monitoring.checker import MonitorChecker

TEST_URL = "https://example.com/probe"


@pytest.fixture
def checker():
    # perform_request() doesn't touch any repository/service, so these can
    # stay unset for classification-only tests.
    return MonitorChecker(None, None, None, None)


@respx.mock
async def test_200_is_up(checker):
    respx.get(TEST_URL).mock(return_value=httpx.Response(200))
    result = await checker.perform_request(
        url=TEST_URL, method="GET", headers=None, body=None,
        timeout_seconds=5, expected_status_codes=[200],
    )
    assert result.status == MonitorStatus.UP
    assert result.http_status == 200
    assert result.error is None


@respx.mock
async def test_201_in_expected_list_is_up(checker):
    respx.get(TEST_URL).mock(return_value=httpx.Response(201))
    result = await checker.perform_request(
        url=TEST_URL, method="GET", headers=None, body=None,
        timeout_seconds=5, expected_status_codes=[200, 201],
    )
    assert result.status == MonitorStatus.UP


@respx.mock
async def test_204_in_expected_list_is_up(checker):
    respx.get(TEST_URL).mock(return_value=httpx.Response(204))
    result = await checker.perform_request(
        url=TEST_URL, method="GET", headers=None, body=None,
        timeout_seconds=5, expected_status_codes=[200, 204],
    )
    assert result.status == MonitorStatus.UP


@respx.mock
async def test_503_is_down(checker):
    respx.get(TEST_URL).mock(return_value=httpx.Response(503))
    result = await checker.perform_request(
        url=TEST_URL, method="GET", headers=None, body=None,
        timeout_seconds=5, expected_status_codes=[200],
    )
    assert result.status == MonitorStatus.DOWN
    assert result.http_status == 503
    assert "503" in result.error


@respx.mock
async def test_unexpected_status_is_down(checker):
    respx.get(TEST_URL).mock(return_value=httpx.Response(302))
    result = await checker.perform_request(
        url=TEST_URL, method="GET", headers=None, body=None,
        timeout_seconds=5, expected_status_codes=[200],
    )
    # 302 without a Location header is returned as-is by _do_request, not
    # followed as a redirect.
    assert result.status == MonitorStatus.DOWN


@respx.mock
async def test_timeout_is_down_with_configured_duration(checker):
    respx.get(TEST_URL).mock(side_effect=httpx.ConnectTimeout("timed out"))
    result = await checker.perform_request(
        url=TEST_URL, method="GET", headers=None, body=None,
        timeout_seconds=3, expected_status_codes=[200],
    )
    assert result.status == MonitorStatus.DOWN
    assert result.error == "Request timed out"
    assert result.response_time_ms == 3000


async def test_ssrf_blocked_url_is_down_without_network_call(checker):
    result = await checker.perform_request(
        url="http://127.0.0.1/",
        method="GET",
        headers=None,
        body=None,
        timeout_seconds=5,
        expected_status_codes=[200],
    )
    assert result.status == MonitorStatus.DOWN
    assert result.http_status is None
    assert "not allowed" in result.error or "blocked" in result.error


@respx.mock
async def test_redirect_to_safe_destination_is_followed(checker):
    respx.get(TEST_URL).mock(
        return_value=httpx.Response(302, headers={"location": "https://example.com/final"})
    )
    respx.get("https://example.com/final").mock(return_value=httpx.Response(200))
    result = await checker.perform_request(
        url=TEST_URL, method="GET", headers=None, body=None,
        timeout_seconds=5, expected_status_codes=[200],
    )
    assert result.status == MonitorStatus.UP
    assert result.http_status == 200


@respx.mock
async def test_redirect_to_private_ip_is_blocked(checker):
    respx.get(TEST_URL).mock(
        return_value=httpx.Response(302, headers={"location": "http://127.0.0.1/admin"})
    )
    result = await checker.perform_request(
        url=TEST_URL, method="GET", headers=None, body=None,
        timeout_seconds=5, expected_status_codes=[200],
    )
    assert result.status == MonitorStatus.DOWN
    assert "blocked" in result.error or "not allowed" in result.error


@respx.mock
async def test_too_many_redirects_is_down(checker):
    respx.get(TEST_URL).mock(
        return_value=httpx.Response(302, headers={"location": TEST_URL})
    )
    result = await checker.perform_request(
        url=TEST_URL, method="GET", headers=None, body=None,
        timeout_seconds=5, expected_status_codes=[200],
    )
    assert result.status == MonitorStatus.DOWN
    assert result.error == "Too many redirects"
