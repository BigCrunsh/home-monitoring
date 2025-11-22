"""Unit tests for Sam Digital data collection script."""

from unittest.mock import AsyncMock, patch

import pytest
from home_monitoring.scripts.collect_sam_digital_data import main


@pytest.mark.asyncio(scope="function")
async def test_main_success() -> None:
    """Script should return 0 when service completes successfully."""
    with patch(
        "home_monitoring.scripts.collect_sam_digital_data.SamDigitalService",
    ) as mock_service_cls:
        mock_service = mock_service_cls.return_value
        mock_service.collect_and_store = AsyncMock()

        exit_code = await main()

        assert exit_code == 0
        mock_service.collect_and_store.assert_awaited_once_with()


@pytest.mark.asyncio(scope="function")
async def test_main_failure_returns_non_zero() -> None:
    """Script should return non-zero when service raises an exception."""
    with patch(
        "home_monitoring.scripts.collect_sam_digital_data.SamDigitalService",
    ) as mock_service_cls:
        mock_service = mock_service_cls.return_value
        mock_service.collect_and_store = AsyncMock(side_effect=Exception("API error"))

        exit_code = await main()

        assert exit_code == 1
        mock_service.collect_and_store.assert_awaited_once_with()
