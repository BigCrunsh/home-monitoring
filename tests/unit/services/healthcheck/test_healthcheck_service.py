"""Unit tests for the freshness healthcheck service."""

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from home_monitoring.config import Settings
from home_monitoring.core.exceptions import APIError
from home_monitoring.services.healthcheck import (
    AlertStore,
    FreshnessConfig,
    HealthcheckService,
)


class FakeRepository:
    """In-memory stand-in for InfluxDBRepository."""

    def __init__(
        self,
        timestamps: dict[str, datetime | None],
        list_error: Exception | None = None,
    ) -> None:
        self._timestamps = timestamps
        self._list_error = list_error

    async def query(self, query: str):
        if self._list_error is not None:
            raise self._list_error
        for name in self._timestamps:
            yield {"name": name}

    async def get_latest_timestamp(self, measurement: str) -> datetime | None:
        return self._timestamps[measurement]


class FakeNotifier:
    """Records sent messages; optionally fails."""

    def __init__(self, fail: bool = False) -> None:
        self.sent: list[str] = []
        self._fail = fail

    def send(self, text: str) -> None:
        if self._fail:
            raise APIError("telegram down")
        self.sent.append(text)


def make_service(  # noqa: PLR0913 - test helper bundles all injection points
    tmp_path: Path,
    mock_settings: Settings,
    timestamps: dict[str, datetime | None],
    config: FreshnessConfig | None = None,
    notifier: FakeNotifier | None = None,
    list_error: Exception | None = None,
) -> tuple[HealthcheckService, FakeNotifier, AlertStore]:
    store = AlertStore(tmp_path / "state.json")
    notifier = notifier or FakeNotifier()
    service = HealthcheckService(
        config=config or FreshnessConfig(default_sla_minutes=60),
        store=store,
        notifier=notifier,
        settings=mock_settings,
        repository=FakeRepository(timestamps, list_error=list_error),
    )
    return service, notifier, store


@pytest.mark.asyncio
async def test_all_fresh_sends_nothing(tmp_path, mock_settings) -> None:
    """All measurements within SLA -> silent run (happy path)."""
    now = datetime.now(UTC)
    service, notifier, _ = make_service(
        tmp_path,
        mock_settings,
        {"weather_temperature_celsius": now - timedelta(minutes=5)},
    )

    sent = await service.run()

    assert sent == 0
    assert notifier.sent == []


@pytest.mark.asyncio
async def test_stale_measurement_alerts(tmp_path, mock_settings) -> None:
    """A measurement beyond its SLA alerts once (unhappy path)."""
    now = datetime.now(UTC)
    service, notifier, store = make_service(
        tmp_path,
        mock_settings,
        {"weather_rain_mm": now - timedelta(days=3)},
    )

    sent = await service.run()

    assert sent == 1
    assert "weather_rain_mm" in notifier.sent[0]
    assert store.is_stale("weather_rain_mm")


@pytest.mark.asyncio
async def test_measurement_without_data_alerts(tmp_path, mock_settings) -> None:
    """A measurement with no data at all alerts (unhappy path)."""
    service, notifier, _ = make_service(
        tmp_path, mock_settings, {"garden_humidity_percentage": None}
    )

    sent = await service.run()

    assert sent == 1
    assert "nie" in notifier.sent[0]


@pytest.mark.asyncio
async def test_recent_alert_is_deduplicated(tmp_path, mock_settings) -> None:
    """A still-stale measurement alerted 1h ago is not re-alerted (unhappy path)."""
    now = datetime.now(UTC)
    service, notifier, store = make_service(
        tmp_path,
        mock_settings,
        {"weather_rain_mm": now - timedelta(days=3)},
    )
    store.mark_alerted("weather_rain_mm", now - timedelta(hours=1))

    sent = await service.run()

    assert sent == 0
    assert notifier.sent == []


@pytest.mark.asyncio
async def test_reminder_after_24h(tmp_path, mock_settings) -> None:
    """A still-stale measurement alerted >24h ago is reminded once (unhappy path)."""
    now = datetime.now(UTC)
    service, notifier, _ = make_service(
        tmp_path,
        mock_settings,
        {"weather_rain_mm": now - timedelta(days=3)},
    )
    service._store.mark_alerted("weather_rain_mm", now - timedelta(hours=25))

    sent = await service.run()

    assert sent == 1


@pytest.mark.asyncio
async def test_recovery_sends_notice_once(tmp_path, mock_settings) -> None:
    """A recovered measurement sends a recovery notice and clears state."""
    now = datetime.now(UTC)
    service, notifier, store = make_service(
        tmp_path,
        mock_settings,
        {"weather_rain_mm": now - timedelta(minutes=1)},
    )
    store.mark_alerted("weather_rain_mm", now - timedelta(hours=5))

    sent = await service.run()

    assert sent == 1
    assert "wieder" in notifier.sent[0]
    assert not store.is_stale("weather_rain_mm")

    # second run: nothing left to say
    sent_again = await service.run()
    assert sent_again == 0


@pytest.mark.asyncio
async def test_influx_unreachable_alerts_monitoring_failure(
    tmp_path, mock_settings
) -> None:
    """InfluxDB being down alerts about the monitoring itself (unhappy path)."""
    service, notifier, store = make_service(
        tmp_path,
        mock_settings,
        {},
        list_error=ConnectionError("connection refused"),
    )

    sent = await service.run()

    assert sent == 1
    assert "InfluxDB" in notifier.sent[0]
    assert store.is_stale("_monitoring")

    # second failing run within 24h is deduplicated
    sent_again = await service.run()
    assert sent_again == 0


@pytest.mark.asyncio
async def test_unknown_measurement_uses_default_sla(tmp_path, mock_settings) -> None:
    """A measurement without an SLA entry falls back to the default (unhappy path)."""
    now = datetime.now(UTC)
    config = FreshnessConfig(default_sla_minutes=30, slas={"other": 999})
    service, notifier, _ = make_service(
        tmp_path,
        mock_settings,
        {"brand_new_measurement": now - timedelta(minutes=45)},
        config=config,
    )

    sent = await service.run()

    assert sent == 1
    assert "brand_new_measurement" in notifier.sent[0]


@pytest.mark.asyncio
async def test_ignored_measurement_is_skipped(tmp_path, mock_settings) -> None:
    """Ignored measurements never alert, however stale (unhappy path)."""
    now = datetime.now(UTC)
    config = FreshnessConfig(
        default_sla_minutes=60, ignore=["weather_windstrength_kph"]
    )
    service, notifier, _ = make_service(
        tmp_path,
        mock_settings,
        {"weather_windstrength_kph": now - timedelta(days=300)},
        config=config,
    )

    sent = await service.run()

    assert sent == 0


@pytest.mark.asyncio
async def test_notifier_failure_propagates(tmp_path, mock_settings) -> None:
    """A failing notifier surfaces as an error, not a silent pass (unhappy path)."""
    now = datetime.now(UTC)
    service, _, _ = make_service(
        tmp_path,
        mock_settings,
        {"weather_rain_mm": now - timedelta(days=3)},
        notifier=FakeNotifier(fail=True),
    )

    with pytest.raises(APIError):
        await service.run()


def test_corrupt_state_file_starts_fresh(tmp_path) -> None:
    """A corrupt state file must not block alerting (unhappy path)."""
    path = tmp_path / "state.json"
    path.write_text("{not json")

    store = AlertStore(path)

    assert not store.is_stale("anything")
    store.mark_alerted("m", datetime.now(UTC))
    store.save()
    assert AlertStore(path).is_stale("m")


def test_config_load_and_defaults(tmp_path) -> None:
    """Config loads SLAs and applies the default for unlisted measurements."""
    path = tmp_path / "healthcheck.json"
    path.write_text('{"default_sla_minutes": 45, "slas": {"a": 10}, "ignore": ["b"]}')

    config = FreshnessConfig.load(path)

    assert config.sla_for("a") == timedelta(minutes=10)
    assert config.sla_for("unknown") == timedelta(minutes=45)
    assert "b" in config.ignore
