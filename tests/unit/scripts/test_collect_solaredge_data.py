"""Unit tests for the energy-totals script (the cron entry collect_solaredge_data)."""

from unittest.mock import AsyncMock, patch

import pytest
from home_monitoring.scripts.collect_solaredge_data import main

SERVICE = "home_monitoring.scripts.collect_solaredge_data.EnergyTotalsService"


@pytest.mark.asyncio(scope="function")
async def test_main_computes_the_energy_totals_up_to_now() -> None:
    """One run writes every completed interval; exit code 0."""
    with patch(SERVICE) as service_cls:
        service_cls.return_value.collect = AsyncMock(return_value=2)
        assert await main() == 0
    now = service_cls.return_value.collect.call_args.kwargs["now"]
    assert now.tzinfo is not None


@pytest.mark.asyncio(scope="function")
async def test_main_returns_1_when_influxdb_fails() -> None:
    """A failure is logged and reported to cron through the exit code."""
    with patch(SERVICE) as service_cls:
        service_cls.return_value.collect = AsyncMock(
            side_effect=ConnectionError("down")
        )
        assert await main() == 1


@pytest.mark.asyncio(scope="function")
async def test_main_returns_1_when_the_service_cannot_be_set_up() -> None:
    """Bad settings fail the run instead of crashing cron with a traceback."""
    with patch(SERVICE, side_effect=ValueError("bad settings")):
        assert await main() == 1
