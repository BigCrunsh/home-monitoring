"""Unit tests for Techem service."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from home_monitoring.config import Settings
from home_monitoring.core.exceptions import APIError
from home_monitoring.services.techem.service import TechemService
from pytest_mock import MockerFixture


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_success(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test successful data collection and storage."""
    # Arrange
    service = TechemService(settings=mock_settings, repository=mock_influxdb)

    # Mock serial port
    mock_serial = MagicMock()
    mock_serial.is_open = True
    mock_serial.readline.side_effect = [
        b"CUL V4.0\r\n",  # Version
        b"OK\r\n",  # WMBUS mode
        b"36446850532301534362000000000000fd000000000000",  # Meter data
        b"36446850532301534362000000000000fd000000000000",  # Meter data
        b"36446850532301534362000000000000fd000000000000",  # Meter data
        b"36446850532301534362000000000000fd000000000000",  # Meter data
        b"36446850532301534362000000000000fd000000000000",  # Meter data
    ]

    with patch("serial.Serial", return_value=mock_serial):
        # Act
        await service.collect_and_store(num_packets=5)

        # Assert
        mock_influxdb.write_measurements.assert_called_once()
        measurements = mock_influxdb.write_measurements.call_args[0][0]
        assert len(measurements) == 5
        assert measurements[0].measurement == "techem"
        assert measurements[0].tags["meter_id"] == "53012353"
        assert measurements[0].fields["value"] > 0


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_port_error(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test handling of port open error."""
    # Arrange
    service = TechemService(settings=mock_settings, repository=mock_influxdb)

    # Mock serial port error
    mock_serial = MagicMock()
    mock_serial.is_open = False

    with patch("serial.Serial", return_value=mock_serial):
        # Act & Assert
        with pytest.raises(APIError, match="Failed to open serial port"):
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
    service = TechemService(settings=mock_settings, repository=mock_influxdb)

    # Mock serial port
    mock_serial = MagicMock()
    mock_serial.is_open = True
    mock_serial.readline.side_effect = [
        b"CUL V4.0\r\n",  # Version
        b"OK\r\n",  # WMBUS mode
        b"36446850532301534362000000000000fd000000000000",  # Meter data
        b"36446850532301534362000000000000fd000000000000",  # Meter data
        b"36446850532301534362000000000000fd000000000000",  # Meter data
        b"36446850532301534362000000000000fd000000000000",  # Meter data
        b"36446850532301534362000000000000fd000000000000",  # Meter data
    ]

    with patch("serial.Serial", return_value=mock_serial):
        # Set up database error
        mock_influxdb.write_measurements.side_effect = Exception("DB Error")

        # Act & Assert
        with pytest.raises(Exception, match="DB Error"):
            await service.collect_and_store(num_packets=5)


@pytest.mark.asyncio(scope="function")
async def test_collect_and_store_invalid_response(
    mocker: MockerFixture,
    mock_influxdb: AsyncMock,
    mock_settings: Settings,
) -> None:
    """Test handling of invalid response."""
    # Arrange
    service = TechemService(settings=mock_settings, repository=mock_influxdb)

    # Mock serial port with invalid data
    mock_serial = MagicMock()
    mock_serial.is_open = True
    mock_serial.readline.side_effect = [
        b"CUL V4.0\r\n",  # Version
        b"OK\r\n",  # WMBUS mode
        b"invalid data",  # Invalid meter data
    ]

    with patch("serial.Serial", return_value=mock_serial):
        # Act & Assert
        with pytest.raises(APIError, match="No meter data received"):
            await service.collect_and_store(num_packets=1)

        assert not mock_influxdb.write_measurements.called
