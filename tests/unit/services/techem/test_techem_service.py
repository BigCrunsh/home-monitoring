"""Unit tests for Techem service."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from home_monitoring.config import Settings
from home_monitoring.core.exceptions import APIError
from home_monitoring.services.techem.service import TechemService
from pytest_mock import MockerFixture

from tests.unit.services.techem.constants import (
    EXPECTED_METER_ID,
    SERIAL_BAUDRATE,
    SERIAL_TIMEOUT,
    TEST_METER_DATA,
    TEST_NUM_PACKETS,
)


def test_serial_import_available():
    """Test that pyserial dependency is available for Techem service."""
    try:
        import serial

        # Verify it's the correct pyserial package by checking a known attribute
        assert hasattr(serial, "Serial")
        assert hasattr(serial, "SerialException")
    except ImportError as e:
        pytest.fail(
            "pyserial dependency missing: "
            f"{e}. Install with 'pip install pyserial==3.5'"
        )


def test_service_init_with_serial_config():
    """Test TechemService initialization with SerialConfig parameters."""
    from home_monitoring.services.techem.config import SerialConfig

    # Test that service accepts SerialConfig, not individual parameters
    config = SerialConfig(
        port="/dev/ttyUSB0",
        baudrate=SERIAL_BAUDRATE,
        timeout=SERIAL_TIMEOUT,
    )

    # This should work
    service = TechemService(serial_config=config)
    assert service._serial_config.port == "/dev/ttyUSB0"
    assert service._serial_config.baudrate == SERIAL_BAUDRATE
    assert service._serial_config.timeout == SERIAL_TIMEOUT

    # This should fail (reproduces the script error)
    with pytest.raises(TypeError, match="unexpected keyword argument"):
        TechemService(port="/dev/ttyUSB0", baudrate=9600, timeout=60)


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
        TEST_METER_DATA,  # Meter data
        TEST_METER_DATA,  # Meter data
        TEST_METER_DATA,  # Meter data
        TEST_METER_DATA,  # Meter data
        TEST_METER_DATA,  # Meter data
    ]

    with patch("serial.Serial", return_value=mock_serial):
        # Act
        await service.collect_and_store(num_packets=5)

        # Assert
        mock_influxdb.write_measurements.assert_called_once()
        measurements = mock_influxdb.write_measurements.call_args[0][0]
        assert len(measurements) == TEST_NUM_PACKETS
        assert measurements[0].measurement == "heat_energy_watthours"
        assert measurements[0].tags["id"] == EXPECTED_METER_ID
        assert measurements[0].fields["Total_Consumption"] > 0


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
        TEST_METER_DATA,  # Meter data
        TEST_METER_DATA,  # Meter data
        TEST_METER_DATA,  # Meter data
        TEST_METER_DATA,  # Meter data
        TEST_METER_DATA,  # Meter data
    ]

    with patch("serial.Serial", return_value=mock_serial):
        # Set up database error
        mock_influxdb.write_measurements.side_effect = Exception("DB Error")

        # Act & Assert
        with pytest.raises(Exception, match="DB Error"):
            await service.collect_and_store(num_packets=TEST_NUM_PACKETS)


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
