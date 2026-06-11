"""Shared async HTTP helpers for collector services.

Every collector talks to a vendor cloud API. Without a timeout a slow/hung
endpoint blocks the cron slot indefinitely; without retries a single transient
blip fails the whole run. These helpers give every service the same bounded,
retrying client.
"""

import asyncio
from typing import Any

import httpx

# total request budget and a tighter connect budget — a hung endpoint must not
# outlast the cron cadence
DEFAULT_TIMEOUT = httpx.Timeout(30.0, connect=10.0)
DEFAULT_RETRIES = 2
DEFAULT_BASE_DELAY = 1.0
RETRYABLE_STATUS = frozenset({500, 502, 503, 504})


def make_async_client(
    timeout: httpx.Timeout | float = DEFAULT_TIMEOUT,
) -> httpx.AsyncClient:
    """Create an httpx async client with a sane default timeout.

    Args:
        timeout: Request timeout (httpx.Timeout or seconds). Defaults to
            DEFAULT_TIMEOUT.

    Returns:
        A configured ``httpx.AsyncClient`` (use as an async context manager).
    """
    return httpx.AsyncClient(timeout=timeout)


async def request_with_retries(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    retries: int = DEFAULT_RETRIES,
    base_delay: float = DEFAULT_BASE_DELAY,
    **kwargs: Any,
) -> httpx.Response:
    """Perform a request, retrying transient failures with exponential backoff.

    Retries on transport errors (timeouts, connection resets) and retryable 5xx
    statuses. Non-retryable responses are returned as-is for the caller to
    handle (e.g. via ``raise_for_status``).

    Args:
        client: The async client to use.
        method: HTTP method.
        url: Request URL.
        retries: Maximum number of retries after the first attempt.
        base_delay: Base backoff delay in seconds (doubled each attempt).
        **kwargs: Forwarded to ``client.request``.

    Returns:
        The HTTP response.

    Raises:
        httpx.TransportError: If transport failures persist past all retries.
    """
    attempt = 0
    while True:
        try:
            response = await client.request(method, url, **kwargs)
        except httpx.TransportError:
            if attempt >= retries:
                raise
        else:
            if response.status_code not in RETRYABLE_STATUS or attempt >= retries:
                return response
        await asyncio.sleep(base_delay * (2**attempt))
        attempt += 1
