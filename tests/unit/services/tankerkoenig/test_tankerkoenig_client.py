"""Unit tests for Tankerkoenig client."""

from unittest.mock import AsyncMock, patch

import httpx
import pytest
from home_monitoring.core.exceptions import APIError
from home_monitoring.services.tankerkoenig.client import TankerkoenigClient


@pytest.mark.asyncio
async def test_get_prices_single_station_success() -> None:
    """Test successful price retrieval for single station (happy path)."""
    # Arrange
    client = TankerkoenigClient(api_key="test-key")
    station_id = "test-station-1"

    mock_response = AsyncMock()
    mock_response.json = lambda: {
        "ok": True,
        "prices": {
            station_id: {
                "e5": 1.789,
                "e10": 1.729,
                "diesel": 1.669,
                "status": "open",
            }
        },
    }
    mock_response.raise_for_status = lambda: None

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client_class.return_value = mock_client

        # Act
        result = await client.get_prices([station_id])

    # Assert
    assert result["ok"] is True
    assert station_id in result["prices"]
    assert result["prices"][station_id]["diesel"] == 1.669


@pytest.mark.asyncio
async def test_get_prices_all_batches_fail() -> None:
    """Test error raised when all batches fail (unhappy path)."""
    # Arrange
    client = TankerkoenigClient(api_key="invalid-key")
    station_ids = ["station-1", "station-2"]

    mock_response = AsyncMock()
    mock_response.json = lambda: {
        "ok": False,
        "message": "API-Key existiert nicht",
    }
    mock_response.raise_for_status = lambda: None

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client_class.return_value = mock_client

        # Act & Assert
        with pytest.raises(
            APIError, match="Failed to get prices for all station batches"
        ):
            await client.get_prices(station_ids)


@pytest.mark.asyncio
async def test_get_prices_network_error() -> None:
    """Test error raised on network failure (unhappy path)."""
    # Arrange
    client = TankerkoenigClient(api_key="test-key")
    station_ids = ["station-1"]

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.get.side_effect = httpx.ConnectError("Connection failed")
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client_class.return_value = mock_client

        # Act & Assert
        with pytest.raises(
            APIError, match="Failed to get prices for all station batches"
        ):
            await client.get_prices(station_ids)


@pytest.mark.asyncio
async def test_get_prices_batching_over_10_stations() -> None:
    """Test batching when more than 10 stations requested (happy path)."""
    # Arrange
    client = TankerkoenigClient(api_key="test-key")
    # 12 stations - should be split into 2 batches (10 + 2)
    station_ids = [f"station-{i}" for i in range(12)]

    call_count = 0

    def mock_get(*args, **kwargs):
        nonlocal call_count
        call_count += 1

        # First batch: 10 stations
        if call_count == 1:
            prices = {f"station-{i}": {"diesel": 1.5 + i * 0.01} for i in range(10)}
        # Second batch: 2 stations
        else:
            prices = {f"station-{i}": {"diesel": 1.5 + i * 0.01} for i in range(10, 12)}

        mock_response = AsyncMock()
        mock_response.json = lambda p=prices: {"ok": True, "prices": p}
        mock_response.raise_for_status = lambda: None
        return mock_response

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.get.side_effect = mock_get
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client_class.return_value = mock_client

        # Act
        result = await client.get_prices(station_ids)

    # Assert
    assert result["ok"] is True
    assert len(result["prices"]) == 12
    assert call_count == 2  # Should have made 2 API calls


@pytest.mark.asyncio
async def test_get_prices_partial_batch_failure() -> None:
    """Test warning when some batches fail but partial data retrieved (unhappy path)."""
    # Arrange
    client = TankerkoenigClient(api_key="test-key")
    # 12 stations - should be split into 2 batches
    station_ids = [f"station-{i}" for i in range(12)]

    call_count = 0

    def mock_get(*args, **kwargs):
        nonlocal call_count
        call_count += 1

        mock_response = AsyncMock()
        # First batch succeeds
        if call_count == 1:
            prices = {f"station-{i}": {"diesel": 1.5 + i * 0.01} for i in range(10)}
            mock_response.json = lambda p=prices: {"ok": True, "prices": p}
        # Second batch fails
        else:
            mock_response.json = lambda: {
                "ok": False,
                "message": "parameter error",
            }
        mock_response.raise_for_status = lambda: None
        return mock_response

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.get.side_effect = mock_get
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client_class.return_value = mock_client

        # Act
        result = await client.get_prices(station_ids)

    # Assert - should return partial data with warning logged
    assert result["ok"] is True
    assert len(result["prices"]) == 10  # Only first batch succeeded


@pytest.mark.asyncio
async def test_get_prices_http_error() -> None:
    """Test error raised on HTTP error status (unhappy path)."""
    # Arrange
    client = TankerkoenigClient(api_key="test-key")
    station_ids = ["station-1"]

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_response = AsyncMock()
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "500 Server Error",
            request=AsyncMock(),
            response=AsyncMock(),
        )
        mock_client.get.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client_class.return_value = mock_client

        # Act & Assert
        with pytest.raises(
            APIError, match="Failed to get prices for all station batches"
        ):
            await client.get_prices(station_ids)


@pytest.mark.asyncio
async def test_get_prices_empty_station_list() -> None:
    """Test handling of empty station list (unhappy path)."""
    # Arrange
    client = TankerkoenigClient(api_key="test-key")

    # Act
    result = await client.get_prices([])

    # Assert - should return empty but valid response
    assert result["ok"] is True
    assert result["prices"] == {}
