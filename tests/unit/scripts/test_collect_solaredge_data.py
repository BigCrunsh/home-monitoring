"""Unit tests for SolarEdge data collection script."""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from home_monitoring.scripts.collect_solaredge_data import main


@pytest.mark.asyncio(scope="function")
async def test_main_no_existing_data_uses_30_day_window() -> None:
    """When no data exists, script should query the last 30 days for all meters."""
    fixed_now = datetime(2024, 2, 16, 20, 0, 0, tzinfo=UTC)
    expected_start = fixed_now - timedelta(days=30)

    with (
        patch(
            "home_monitoring.scripts.collect_solaredge_data.SolarEdgeService"
        ) as mock_service_cls,
        patch(
            "home_monitoring.scripts.collect_solaredge_data.InfluxDBRepository"
        ) as mock_repo_cls,
        patch("home_monitoring.scripts.collect_solaredge_data.datetime")
        as mock_datetime,
    ):
        mock_datetime.now.return_value = fixed_now

        mock_repo = mock_repo_cls.return_value
        mock_repo.get_latest_timestamp = AsyncMock(side_effect=[None, None])

        mock_service = mock_service_cls.return_value
        mock_service.collect_and_store_energy_details = AsyncMock()
        mock_service.collect_and_store_power_details = AsyncMock()

        exit_code = await main()
        assert exit_code == 0

        mock_service.collect_and_store_energy_details.assert_awaited_once_with(
            start_time=expected_start,
            end_time=fixed_now,
            time_unit="QUARTER_OF_AN_HOUR",
            meters=[
                "PRODUCTION",
                "CONSUMPTION",
                "SELFCONSUMPTION",
                "FEEDIN",
                "PURCHASED",
            ],
        )

        mock_service.collect_and_store_power_details.assert_awaited_once_with(
            start_time=expected_start,
            end_time=fixed_now,
            meters=[
                "PRODUCTION",
                "CONSUMPTION",
                "SELFCONSUMPTION",
                "FEEDIN",
                "PURCHASED",
            ],
        )


@pytest.mark.asyncio(scope="function")
async def test_main_clamps_latest_timestamp_to_30_day_window() -> None:
    """If latest data is older than 30 days, clamp to the 30-day window start."""
    fixed_now = datetime(2024, 2, 16, 20, 0, 0, tzinfo=UTC)
    latest_ts = fixed_now - timedelta(days=60)
    expected_start = fixed_now - timedelta(days=30)

    with (
        patch(
            "home_monitoring.scripts.collect_solaredge_data.SolarEdgeService"
        ) as mock_service_cls,
        patch(
            "home_monitoring.scripts.collect_solaredge_data.InfluxDBRepository"
        ) as mock_repo_cls,
        patch("home_monitoring.scripts.collect_solaredge_data.datetime")
        as mock_datetime,
    ):
        mock_datetime.now.return_value = fixed_now

        mock_repo = mock_repo_cls.return_value
        # Same old timestamp for both energy and power measurements
        mock_repo.get_latest_timestamp = AsyncMock(
            side_effect=[latest_ts, latest_ts]
        )

        mock_service = mock_service_cls.return_value
        mock_service.collect_and_store_energy_details = AsyncMock()
        mock_service.collect_and_store_power_details = AsyncMock()

        exit_code = await main()
        assert exit_code == 0

        mock_service.collect_and_store_energy_details.assert_awaited_once_with(
            start_time=expected_start,
            end_time=fixed_now,
            time_unit="QUARTER_OF_AN_HOUR",
            meters=[
                "PRODUCTION",
                "CONSUMPTION",
                "SELFCONSUMPTION",
                "FEEDIN",
                "PURCHASED",
            ],
        )

        mock_service.collect_and_store_power_details.assert_awaited_once_with(
            start_time=expected_start,
            end_time=fixed_now,
            meters=[
                "PRODUCTION",
                "CONSUMPTION",
                "SELFCONSUMPTION",
                "FEEDIN",
                "PURCHASED",
            ],
        )
