"""Unit tests for the shared async HTTP helpers."""

from unittest.mock import AsyncMock

import httpx
import pytest
from home_monitoring.utils.http import (
    DEFAULT_TIMEOUT,
    make_async_client,
    request_with_retries,
)


def _response(status_code: int) -> httpx.Response:
    return httpx.Response(status_code, request=httpx.Request("GET", "http://x"))


def test_make_async_client_sets_timeout() -> None:
    """The factory returns a client with the default timeout (happy path)."""
    client = make_async_client()

    assert client.timeout == DEFAULT_TIMEOUT


@pytest.mark.asyncio
async def test_returns_response_without_retry() -> None:
    """A 200 first try returns immediately, no sleep (happy path)."""
    client = AsyncMock()
    client.request = AsyncMock(return_value=_response(200))

    resp = await request_with_retries(client, "GET", "http://x", base_delay=0)

    assert resp.status_code == 200
    assert client.request.await_count == 1


@pytest.mark.asyncio
async def test_retries_then_succeeds_on_transport_error() -> None:
    """A transient transport error is retried and then succeeds (unhappy path)."""
    client = AsyncMock()
    client.request = AsyncMock(side_effect=[httpx.ConnectError("boom"), _response(200)])

    resp = await request_with_retries(client, "GET", "http://x", base_delay=0)

    assert resp.status_code == 200
    assert client.request.await_count == 2


@pytest.mark.asyncio
async def test_transport_error_exhausts_retries_and_raises() -> None:
    """Persistent transport errors raise after all retries (unhappy path)."""
    client = AsyncMock()
    client.request = AsyncMock(side_effect=httpx.ConnectError("down"))

    with pytest.raises(httpx.TransportError):
        await request_with_retries(client, "GET", "http://x", retries=2, base_delay=0)

    assert client.request.await_count == 3  # initial + 2 retries


@pytest.mark.asyncio
async def test_retries_on_5xx_then_succeeds() -> None:
    """A retryable 5xx is retried and then a 200 is returned (unhappy path)."""
    client = AsyncMock()
    client.request = AsyncMock(side_effect=[_response(503), _response(200)])

    resp = await request_with_retries(client, "GET", "http://x", base_delay=0)

    assert resp.status_code == 200
    assert client.request.await_count == 2


@pytest.mark.asyncio
async def test_non_retryable_status_returns_immediately() -> None:
    """A 404 is returned without retry (caller decides) (unhappy path)."""
    client = AsyncMock()
    client.request = AsyncMock(return_value=_response(404))

    resp = await request_with_retries(client, "GET", "http://x", base_delay=0)

    assert resp.status_code == 404
    assert client.request.await_count == 1


@pytest.mark.asyncio
async def test_5xx_persists_returns_last_response() -> None:
    """If 5xx persists past retries, the last response is returned, not raised."""
    client = AsyncMock()
    client.request = AsyncMock(return_value=_response(500))

    resp = await request_with_retries(
        client, "GET", "http://x", retries=1, base_delay=0
    )

    assert resp.status_code == 500
    assert client.request.await_count == 2
