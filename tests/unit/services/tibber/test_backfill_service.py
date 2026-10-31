"""Unit tests for TibberService.backfill_month_history (one-off YoY backfill)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from home_monitoring.config import Settings
from home_monitoring.services.tibber import TibberService

OCT_2025 = {
    "from": "2025-10-01T00:00:00.000+02:00",
    "cost": 70.12,
    "consumption": 180.5,
}


def make_connection(monthly: object) -> AsyncMock:
    home = MagicMock()
    home.update_info = AsyncMock()
    home.get_historic_data = AsyncMock(side_effect=[monthly, []])
    connection = AsyncMock()
    connection.get_homes = MagicMock(return_value=[home])
    return connection


@pytest.mark.asyncio
async def test_backfill_writes_every_completed_month(
    mock_influxdb: AsyncMock, mock_settings: Settings
) -> None:
    with patch("tibber.Tibber", return_value=make_connection([OCT_2025])):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        measurements = await service.backfill_month_history(months=24, dry_run=False)

    mock_influxdb.write_measurements.assert_called_once_with(measurements)
    assert len(measurements) == 3


@pytest.mark.asyncio
async def test_dry_run_reports_the_months_but_writes_nothing(
    mock_influxdb: AsyncMock, mock_settings: Settings
) -> None:
    with patch("tibber.Tibber", return_value=make_connection([OCT_2025])):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        measurements = await service.backfill_month_history(months=24, dry_run=True)

    mock_influxdb.write_measurements.assert_not_called()
    assert len(measurements) == 3


@pytest.mark.asyncio
async def test_no_history_writes_nothing(
    mock_influxdb: AsyncMock, mock_settings: Settings
) -> None:
    with patch("tibber.Tibber", return_value=make_connection([])):
        service = TibberService(settings=mock_settings, repository=mock_influxdb)

        assert await service.backfill_month_history(months=24, dry_run=False) == []

    mock_influxdb.write_measurements.assert_not_called()
