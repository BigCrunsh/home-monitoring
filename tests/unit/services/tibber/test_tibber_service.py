"""Unit tests for Tibber service."""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from home_monitoring.config import Settings
from home_monitoring.services.tibber.service import TibberService
from pytest_mock import MockerFixture

# Test constants
TEST_HOURLY_COST = 0.45
TEST_HOURLY_CONSUMPTION = 1.5
TEST_DAILY_COST = 7.65
TEST_DAILY_CONSUMPTION = 25.5
DEFAULT_COST = 0.0
DEFAULT_CONSUMPTION = 0.0
HOURS_IN_DAY = 24
LAST_HOUR_OF_DAY = 23
TEST_24H_COST = 7.2
TEST_24H_CONSUMPTION = 36.0
TEST_PARTIAL_COST = 3.6
TEST_PARTIAL_CONSUMPTION = 24.0
FLOAT_TOLERANCE = 0.01
EXPECTED_ALL_MEASUREMENTS = 6
EXPECTED_COST_MEASUREMENTS = 3
EXPECTED_CONSUMPTION_MEASUREMENTS = 3
EXPECTED_PARTIAL_MEASUREMENTS = 4


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_success(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test successful data collection and storage."""
    # Arrange
    mock_home = AsyncMock()
    mock_home.address1 = "Test Address"
    # current_price_data returns tuple: (total, datetime, rank)
    mock_home.current_price_data = MagicMock(
        return_value=(1.234, datetime(2024, 2, 16, 20, 0, 0), 0.5)
    )

    mock_connection = AsyncMock()
    mock_connection.name = "Test User"
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        # Create service
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act
        await service.collect_and_store()

        # Assert
        mock_influxdb.write_measurements.assert_called_once()
        measurements = mock_influxdb.write_measurements.call_args[0][0]
        assert len(measurements) == 1
        measurement = measurements[0]
        assert measurement.measurement == "electricity_prices_euro"
        assert measurement.tags == {}
        assert measurement.timestamp == datetime(2024, 2, 16, 20, 0, 0)
        assert measurement.fields == {"total": 1.234, "rank": 0.5}


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_api_error(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test handling of API error."""
    # Arrange
    mock_connection = AsyncMock()
    mock_connection.update_info.side_effect = Exception("API Error")

    with patch("tibber.Tibber", return_value=mock_connection):
        # Create service
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act & Assert
        with pytest.raises(Exception, match="API Error"):
            await service.collect_and_store()

        assert not mock_influxdb.write_measurements.called


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_database_error(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test handling of database error."""
    # Arrange
    mock_home = AsyncMock()
    mock_home.address1 = "Test Address"
    # current_price_data returns tuple: (total, datetime, rank)
    mock_home.current_price_data = MagicMock(
        return_value=(1.234, datetime(2024, 2, 16, 20, 0, 0), 0.5)
    )

    mock_connection = AsyncMock()
    mock_connection.name = "Test User"
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        # Create service and set up database error
        service = TibberService(settings=mock_settings, repository=mock_influxdb)
        mock_influxdb.write_measurements.side_effect = Exception("DB Error")

        # Act & Assert
        with pytest.raises(Exception, match="DB Error"):
            await service.collect_and_store()


@pytest.mark.asyncio(scope="function")
async def test_current_price_data_returns_tuple(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test that current_price_data returns tuple directly (not coroutine)."""
    # Arrange - Mock current_price_data to return tuple like real API
    mock_home = AsyncMock()
    mock_home.address1 = "Test Address"
    # current_price_data returns tuple: (total, datetime, rank)
    from datetime import datetime

    mock_home.current_price_data = MagicMock(
        return_value=(1.234, datetime(2024, 2, 16, 20, 0, 0), 0.5)
    )

    mock_connection = AsyncMock()
    mock_connection.name = "Test User"
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        # Create service
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act
        await service.collect_and_store()

        # Assert - should handle tuple return value correctly
        mock_influxdb.write_measurements.assert_called_once()
        measurements = mock_influxdb.write_measurements.call_args[0][0]
        assert len(measurements) == 1
        assert measurements[0].measurement == "electricity_prices_euro"


# Tests for get_last_hour_cost
@pytest.mark.asyncio(scope="function")
async def test_get_last_hour_cost_success(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test successful retrieval of last hour cost (happy path)."""
    # Arrange
    mock_consumption_node = MagicMock()
    mock_consumption_node.from_time = datetime(2024, 2, 16, 19, 0, 0)
    mock_consumption_node.to_time = datetime(2024, 2, 16, 20, 0, 0)
    mock_consumption_node.consumption = 1.5
    mock_consumption_node.cost = 0.45
    mock_consumption_node.unit_price = 0.30
    mock_consumption_node.currency = "EUR"

    mock_home = AsyncMock()
    mock_home.fetch_consumption = AsyncMock(return_value=[mock_consumption_node])

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act
        cost = await service.get_last_hour_cost()

        # Assert
        assert cost == TEST_HOURLY_COST
        mock_home.fetch_consumption.assert_called_once_with(
            resolution="HOURLY", last=1
        )


@pytest.mark.asyncio(scope="function")
async def test_get_last_hour_cost_no_data(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test get_last_hour_cost when no data is available (unhappy path)."""
    # Arrange
    mock_home = AsyncMock()
    mock_home.fetch_consumption = AsyncMock(return_value=[])

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act & Assert
        with pytest.raises(ValueError, match="No hourly consumption data available"):
            await service.get_last_hour_cost()


@pytest.mark.asyncio(scope="function")
async def test_get_last_hour_cost_api_error(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test get_last_hour_cost when API fails (unhappy path)."""
    # Arrange
    mock_connection = AsyncMock()
    mock_connection.update_info.side_effect = Exception("API connection failed")

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act & Assert
        with pytest.raises(Exception, match="API connection failed"):
            await service.get_last_hour_cost()


@pytest.mark.asyncio(scope="function")
async def test_get_last_hour_cost_null_cost(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test get_last_hour_cost with null cost value (unhappy path)."""
    # Arrange
    mock_consumption_node = MagicMock()
    mock_consumption_node.from_time = datetime(2024, 2, 16, 19, 0, 0)
    mock_consumption_node.to_time = datetime(2024, 2, 16, 20, 0, 0)
    mock_consumption_node.consumption = 1.5
    mock_consumption_node.cost = None  # Null cost
    mock_consumption_node.unit_price = 0.30
    mock_consumption_node.currency = "EUR"

    mock_home = AsyncMock()
    mock_home.fetch_consumption = AsyncMock(return_value=[mock_consumption_node])

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act
        cost = await service.get_last_hour_cost()

        # Assert - should default to 0.0
        assert cost == DEFAULT_COST


# Tests for get_last_hour_consumption
@pytest.mark.asyncio(scope="function")
async def test_get_last_hour_consumption_success(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test successful retrieval of last hour consumption (happy path)."""
    # Arrange
    mock_consumption_node = MagicMock()
    mock_consumption_node.from_time = datetime(2024, 2, 16, 19, 0, 0)
    mock_consumption_node.to_time = datetime(2024, 2, 16, 20, 0, 0)
    mock_consumption_node.consumption = TEST_HOURLY_CONSUMPTION
    mock_consumption_node.cost = TEST_HOURLY_COST
    mock_consumption_node.unit_price = 0.30
    mock_consumption_node.currency = "EUR"

    mock_home = AsyncMock()
    mock_home.fetch_consumption = AsyncMock(return_value=[mock_consumption_node])

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act
        consumption = await service.get_last_hour_consumption()

        # Assert
        assert consumption == TEST_HOURLY_CONSUMPTION
        mock_home.fetch_consumption.assert_called_once_with(
            resolution="HOURLY", last=1
        )


@pytest.mark.asyncio(scope="function")
async def test_get_last_hour_consumption_no_data(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test get_last_hour_consumption when no data is available (unhappy path)."""
    # Arrange
    mock_home = AsyncMock()
    mock_home.fetch_consumption = AsyncMock(return_value=[])

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act & Assert
        with pytest.raises(ValueError, match="No hourly consumption data available"):
            await service.get_last_hour_consumption()


@pytest.mark.asyncio(scope="function")
async def test_get_last_hour_consumption_api_error(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test get_last_hour_consumption when API fails (unhappy path)."""
    # Arrange
    mock_connection = AsyncMock()
    mock_connection.update_info.side_effect = Exception("API connection failed")

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act & Assert
        with pytest.raises(Exception, match="API connection failed"):
            await service.get_last_hour_consumption()


@pytest.mark.asyncio(scope="function")
async def test_get_last_hour_consumption_null_value(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test get_last_hour_consumption with null consumption value (unhappy path)."""
    # Arrange
    mock_consumption_node = MagicMock()
    mock_consumption_node.from_time = datetime(2024, 2, 16, 19, 0, 0)
    mock_consumption_node.to_time = datetime(2024, 2, 16, 20, 0, 0)
    mock_consumption_node.consumption = None  # Null consumption
    mock_consumption_node.cost = TEST_HOURLY_COST
    mock_consumption_node.unit_price = 0.30
    mock_consumption_node.currency = "EUR"

    mock_home = AsyncMock()
    mock_home.fetch_consumption = AsyncMock(return_value=[mock_consumption_node])

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act
        consumption = await service.get_last_hour_consumption()

        # Assert - should default to 0.0
        assert consumption == DEFAULT_CONSUMPTION


# Tests for get_yesterday_cost
@pytest.mark.asyncio(scope="function")
async def test_get_yesterday_cost_success(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test successful retrieval of yesterday's cost (happy path)."""
    # Arrange
    mock_consumption_node = MagicMock()
    mock_consumption_node.from_time = datetime(2024, 2, 15, 0, 0, 0)
    mock_consumption_node.to_time = datetime(2024, 2, 16, 0, 0, 0)
    mock_consumption_node.consumption = 25.5
    mock_consumption_node.cost = 7.65
    mock_consumption_node.unit_price = 0.30
    mock_consumption_node.currency = "EUR"

    mock_home = AsyncMock()
    mock_home.fetch_consumption = AsyncMock(return_value=[mock_consumption_node])

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act
        cost = await service.get_yesterday_cost()

        # Assert
        assert cost == TEST_DAILY_COST
        mock_home.fetch_consumption.assert_called_once_with(
            resolution="DAILY", last=1
        )


@pytest.mark.asyncio(scope="function")
async def test_get_yesterday_cost_no_data(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test get_yesterday_cost when no data is available (unhappy path)."""
    # Arrange
    mock_home = AsyncMock()
    mock_home.fetch_consumption = AsyncMock(return_value=[])

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act & Assert
        with pytest.raises(ValueError, match="No daily consumption data available"):
            await service.get_yesterday_cost()


@pytest.mark.asyncio(scope="function")
async def test_get_yesterday_cost_api_error(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test get_yesterday_cost when API fails (unhappy path)."""
    # Arrange
    mock_home = AsyncMock()
    mock_home.fetch_consumption.side_effect = Exception("Fetch failed")

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act & Assert
        with pytest.raises(Exception, match="Fetch failed"):
            await service.get_yesterday_cost()


@pytest.mark.asyncio(scope="function")
async def test_get_yesterday_cost_null_cost(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test get_yesterday_cost with null cost value (unhappy path)."""
    # Arrange
    mock_consumption_node = MagicMock()
    mock_consumption_node.from_time = datetime(2024, 2, 15, 0, 0, 0)
    mock_consumption_node.to_time = datetime(2024, 2, 16, 0, 0, 0)
    mock_consumption_node.consumption = 25.5
    mock_consumption_node.cost = None  # Null cost
    mock_consumption_node.unit_price = None
    mock_consumption_node.currency = None

    mock_home = AsyncMock()
    mock_home.fetch_consumption = AsyncMock(return_value=[mock_consumption_node])

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act
        cost = await service.get_yesterday_cost()

        # Assert - should default to 0.0
        assert cost == DEFAULT_COST


# Tests for get_yesterday_consumption
@pytest.mark.asyncio(scope="function")
async def test_get_yesterday_consumption_success(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test successful retrieval of yesterday's consumption (happy path)."""
    # Arrange
    mock_consumption_node = MagicMock()
    mock_consumption_node.from_time = datetime(2024, 2, 15, 0, 0, 0)
    mock_consumption_node.to_time = datetime(2024, 2, 16, 0, 0, 0)
    mock_consumption_node.consumption = TEST_DAILY_CONSUMPTION
    mock_consumption_node.cost = TEST_DAILY_COST
    mock_consumption_node.unit_price = 0.30
    mock_consumption_node.currency = "EUR"

    mock_home = AsyncMock()
    mock_home.fetch_consumption = AsyncMock(return_value=[mock_consumption_node])

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act
        consumption = await service.get_yesterday_consumption()

        # Assert
        assert consumption == TEST_DAILY_CONSUMPTION
        mock_home.fetch_consumption.assert_called_once_with(
            resolution="DAILY", last=1
        )


@pytest.mark.asyncio(scope="function")
async def test_get_yesterday_consumption_no_data(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test get_yesterday_consumption when no data is available (unhappy path)."""
    # Arrange
    mock_home = AsyncMock()
    mock_home.fetch_consumption = AsyncMock(return_value=[])

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act & Assert
        with pytest.raises(ValueError, match="No daily consumption data available"):
            await service.get_yesterday_consumption()


@pytest.mark.asyncio(scope="function")
async def test_get_yesterday_consumption_api_error(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test get_yesterday_consumption when API fails (unhappy path)."""
    # Arrange
    mock_home = AsyncMock()
    mock_home.fetch_consumption.side_effect = Exception("Fetch failed")

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act & Assert
        with pytest.raises(Exception, match="Fetch failed"):
            await service.get_yesterday_consumption()


@pytest.mark.asyncio(scope="function")
async def test_get_yesterday_consumption_null_value(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test get_yesterday_consumption with null consumption value (unhappy path)."""
    # Arrange
    mock_consumption_node = MagicMock()
    mock_consumption_node.from_time = datetime(2024, 2, 15, 0, 0, 0)
    mock_consumption_node.to_time = datetime(2024, 2, 16, 0, 0, 0)
    mock_consumption_node.consumption = None  # Null consumption
    mock_consumption_node.cost = TEST_DAILY_COST
    mock_consumption_node.unit_price = None
    mock_consumption_node.currency = None

    mock_home = AsyncMock()
    mock_home.fetch_consumption = AsyncMock(return_value=[mock_consumption_node])

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act
        consumption = await service.get_yesterday_consumption()

        # Assert - should default to 0.0
        assert consumption == DEFAULT_CONSUMPTION


# Tests for get_last_24h_cost
@pytest.mark.asyncio(scope="function")
async def test_get_last_24h_cost_success(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test successful retrieval of last 24h cost (happy path)."""
    # Arrange - Create 24 hourly data points
    mock_consumption_nodes = []
    for i in range(24):
        node = MagicMock()
        node.from_time = (
            datetime(2024, 2, 15, i, 0, 0)
            if i < HOURS_IN_DAY
            else datetime(2024, 2, 16, 0, 0, 0)
        )
        node.to_time = (
            datetime(2024, 2, 15, i + 1, 0, 0)
            if i < LAST_HOUR_OF_DAY
            else datetime(2024, 2, 16, 0, 0, 0)
        )
        node.consumption = 1.0
        node.cost = 0.30  # 0.30 EUR per hour
        node.unit_price = 0.30
        node.currency = "EUR"
        mock_consumption_nodes.append(node)

    mock_home = AsyncMock()
    mock_home.fetch_consumption = AsyncMock(return_value=mock_consumption_nodes)

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act
        cost = await service.get_last_24h_cost()

        # Assert
        assert abs(cost - TEST_24H_COST) < FLOAT_TOLERANCE
        mock_home.fetch_consumption.assert_called_once_with(
            resolution="HOURLY", last=24
        )


@pytest.mark.asyncio(scope="function")
async def test_get_last_24h_cost_no_data(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test get_last_24h_cost when no data is available (unhappy path)."""
    # Arrange
    mock_home = AsyncMock()
    mock_home.fetch_consumption = AsyncMock(return_value=[])

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act & Assert
        with pytest.raises(ValueError, match="No hourly consumption data available"):
            await service.get_last_24h_cost()


@pytest.mark.asyncio(scope="function")
async def test_get_last_24h_cost_partial_data(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test get_last_24h_cost with partial data (unhappy path)."""
    # Arrange - Only 12 hours of data
    mock_consumption_nodes = []
    for i in range(12):
        node = MagicMock()
        node.from_time = datetime(2024, 2, 16, i, 0, 0)
        node.to_time = datetime(2024, 2, 16, i + 1, 0, 0)
        node.consumption = 1.0
        node.cost = 0.30
        node.unit_price = 0.30
        node.currency = "EUR"
        mock_consumption_nodes.append(node)

    mock_home = AsyncMock()
    mock_home.fetch_consumption = AsyncMock(return_value=mock_consumption_nodes)

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act
        cost = await service.get_last_24h_cost()

        # Assert - Should sum only available data
        assert abs(cost - TEST_PARTIAL_COST) < FLOAT_TOLERANCE


@pytest.mark.asyncio(scope="function")
async def test_get_last_24h_cost_with_null_values(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test get_last_24h_cost with some null cost values (unhappy path)."""
    # Arrange - 24 hours with some null costs
    mock_consumption_nodes = []
    for i in range(24):
        node = MagicMock()
        node.from_time = (
            datetime(2024, 2, 15, i, 0, 0)
            if i < HOURS_IN_DAY
            else datetime(2024, 2, 16, 0, 0, 0)
        )
        node.to_time = (
            datetime(2024, 2, 15, i + 1, 0, 0)
            if i < LAST_HOUR_OF_DAY
            else datetime(2024, 2, 16, 0, 0, 0)
        )
        node.consumption = 1.0
        node.cost = 0.30 if i % 2 == 0 else None  # Every other hour is null
        node.unit_price = 0.30
        node.currency = "EUR"
        mock_consumption_nodes.append(node)

    mock_home = AsyncMock()
    mock_home.fetch_consumption = AsyncMock(return_value=mock_consumption_nodes)

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act
        cost = await service.get_last_24h_cost()

        # Assert - Should sum with null values treated as 0.0
        assert abs(cost - TEST_PARTIAL_COST) < FLOAT_TOLERANCE


# Tests for get_last_24h_consumption
@pytest.mark.asyncio(scope="function")
async def test_get_last_24h_consumption_success(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test successful retrieval of last 24h consumption (happy path)."""
    # Arrange - Create 24 hourly data points
    mock_consumption_nodes = []
    for i in range(24):
        node = MagicMock()
        node.from_time = (
            datetime(2024, 2, 15, i, 0, 0)
            if i < HOURS_IN_DAY
            else datetime(2024, 2, 16, 0, 0, 0)
        )
        node.to_time = (
            datetime(2024, 2, 15, i + 1, 0, 0)
            if i < LAST_HOUR_OF_DAY
            else datetime(2024, 2, 16, 0, 0, 0)
        )
        node.consumption = 1.5  # 1.5 kWh per hour
        node.cost = 0.45
        node.unit_price = 0.30
        node.currency = "EUR"
        mock_consumption_nodes.append(node)

    mock_home = AsyncMock()
    mock_home.fetch_consumption = AsyncMock(return_value=mock_consumption_nodes)

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act
        consumption = await service.get_last_24h_consumption()

        # Assert
        assert consumption == TEST_24H_CONSUMPTION
        mock_home.fetch_consumption.assert_called_once_with(
            resolution="HOURLY", last=24
        )


@pytest.mark.asyncio(scope="function")
async def test_get_last_24h_consumption_no_data(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test get_last_24h_consumption when no data is available (unhappy path)."""
    # Arrange
    mock_home = AsyncMock()
    mock_home.fetch_consumption = AsyncMock(return_value=[])

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act & Assert
        with pytest.raises(ValueError, match="No hourly consumption data available"):
            await service.get_last_24h_consumption()


@pytest.mark.asyncio(scope="function")
async def test_get_last_24h_consumption_api_error(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test get_last_24h_consumption when API fails (unhappy path)."""
    # Arrange
    mock_connection = AsyncMock()
    mock_connection.update_info.side_effect = Exception("API connection failed")

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act & Assert
        with pytest.raises(Exception, match="API connection failed"):
            await service.get_last_24h_consumption()


@pytest.mark.asyncio(scope="function")
async def test_get_last_24h_consumption_with_null_values(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test get_last_24h_consumption with null consumption values (unhappy path)."""
    # Arrange - 24 hours with some null consumption
    mock_consumption_nodes = []
    for i in range(24):
        node = MagicMock()
        node.from_time = (
            datetime(2024, 2, 15, i, 0, 0)
            if i < HOURS_IN_DAY
            else datetime(2024, 2, 16, 0, 0, 0)
        )
        node.to_time = (
            datetime(2024, 2, 15, i + 1, 0, 0)
            if i < LAST_HOUR_OF_DAY
            else datetime(2024, 2, 16, 0, 0, 0)
        )
        node.consumption = 1.5 if i % 3 != 0 else None  # Every 3rd hour is null
        node.cost = 0.45
        node.unit_price = 0.30
        node.currency = "EUR"
        mock_consumption_nodes.append(node)

    mock_home = AsyncMock()
    mock_home.fetch_consumption = AsyncMock(return_value=mock_consumption_nodes)

    mock_connection = AsyncMock()
    mock_connection.get_homes = MagicMock(return_value=[mock_home])

    with patch("tibber.Tibber", return_value=mock_connection):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        # Act
        consumption = await service.get_last_24h_consumption()

        # Assert - Should sum with null values treated as 0.0
        assert consumption == TEST_PARTIAL_CONSUMPTION


# Tests for collect_and_store_consumption_data
@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_consumption_data_success(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test successful collection and storage of all consumption data (happy path)."""
    # Arrange
    service = TibberService(settings=mock_settings, repository=mock_influxdb)

    # Mock all get methods
    mocker.patch.object(service, "get_last_hour_cost", return_value=0.45)
    mocker.patch.object(service, "get_last_hour_consumption", return_value=1.5)
    mocker.patch.object(service, "get_yesterday_cost", return_value=7.65)
    mocker.patch.object(service, "get_yesterday_consumption", return_value=25.5)
    mocker.patch.object(service, "get_last_24h_cost", return_value=8.50)
    mocker.patch.object(service, "get_last_24h_consumption", return_value=36.0)

    # Act
    await service.collect_and_store_consumption_data()

    # Assert
    mock_influxdb.write_measurements.assert_called_once()
    measurements = mock_influxdb.write_measurements.call_args[0][0]
    assert len(measurements) == EXPECTED_ALL_MEASUREMENTS

    # Verify cost measurements
    cost_measurements = [
        m for m in measurements if m.measurement == "electricity_costs_euro"
    ]
    assert len(cost_measurements) == EXPECTED_COST_MEASUREMENTS
    periods = {m.tags["period"] for m in cost_measurements}
    assert periods == {"last_hour", "yesterday", "last_24h"}

    # Verify consumption measurements
    consumption_measurements = [
        m for m in measurements if m.measurement == "electricity_consumption_kwh"
    ]
    assert len(consumption_measurements) == EXPECTED_CONSUMPTION_MEASUREMENTS
    periods = {m.tags["period"] for m in consumption_measurements}
    assert periods == {"last_hour", "yesterday", "last_24h"}


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_consumption_data_partial_failure(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test collection when some data points fail (unhappy path)."""
    # Arrange
    service = TibberService(settings=mock_settings, repository=mock_influxdb)

    # Mock some methods to succeed, others to fail
    mocker.patch.object(service, "get_last_hour_cost", return_value=0.45)
    mocker.patch.object(
        service,
        "get_last_hour_consumption",
        side_effect=ValueError("No data"),
    )
    mocker.patch.object(service, "get_yesterday_cost", return_value=7.65)
    mocker.patch.object(service, "get_yesterday_consumption", return_value=25.5)
    mocker.patch.object(
        service,
        "get_last_24h_cost",
        side_effect=ValueError("No data"),
    )
    mocker.patch.object(service, "get_last_24h_consumption", return_value=36.0)

    # Act
    await service.collect_and_store_consumption_data()

    # Assert - Should store only successful data points
    mock_influxdb.write_measurements.assert_called_once()
    measurements = mock_influxdb.write_measurements.call_args[0][0]
    assert len(measurements) == EXPECTED_PARTIAL_MEASUREMENTS


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_consumption_data_all_fail(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test collection when all data points fail (unhappy path)."""
    # Arrange
    service = TibberService(settings=mock_settings, repository=mock_influxdb)

    # Mock all methods to fail
    mocker.patch.object(
        service,
        "get_last_hour_cost",
        side_effect=ValueError("No data"),
    )
    mocker.patch.object(
        service,
        "get_last_hour_consumption",
        side_effect=ValueError("No data"),
    )
    mocker.patch.object(
        service,
        "get_yesterday_cost",
        side_effect=ValueError("No data"),
    )
    mocker.patch.object(
        service,
        "get_yesterday_consumption",
        side_effect=ValueError("No data"),
    )
    mocker.patch.object(
        service,
        "get_last_24h_cost",
        side_effect=ValueError("No data"),
    )
    mocker.patch.object(
        service,
        "get_last_24h_consumption",
        side_effect=ValueError("No data"),
    )

    # Act
    await service.collect_and_store_consumption_data()

    # Assert - Should not attempt to write
    mock_influxdb.write_measurements.assert_not_called()


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_consumption_data_db_error(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test collection when database write fails (unhappy path)."""
    # Arrange
    service = TibberService(settings=mock_settings, repository=mock_influxdb)

    # Mock all get methods to succeed
    mocker.patch.object(service, "get_last_hour_cost", return_value=0.45)
    mocker.patch.object(service, "get_last_hour_consumption", return_value=1.5)
    mocker.patch.object(service, "get_yesterday_cost", return_value=7.65)
    mocker.patch.object(service, "get_yesterday_consumption", return_value=25.5)
    mocker.patch.object(service, "get_last_24h_cost", return_value=8.50)
    mocker.patch.object(service, "get_last_24h_consumption", return_value=36.0)

    # Mock database to fail
    mock_influxdb.write_measurements.side_effect = Exception("DB Error")

    # Act & Assert
    with pytest.raises(Exception, match="DB Error"):
        await service.collect_and_store_consumption_data()
