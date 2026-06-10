"""Freshness healthcheck service.

Compares the newest data point of every InfluxDB measurement against a
per-measurement freshness SLA and raises Telegram alerts for stale
measurements, with recovery notices and 24h deduplication. The healthcheck
also alerts about its own failure when InfluxDB is unreachable.
"""

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path

from home_monitoring.services.base_service import BaseService
from home_monitoring.services.healthcheck.notifier import TelegramNotifier

# do not repeat an unchanged staleness alert more often than this
REMINDER_INTERVAL = timedelta(hours=24)

# pseudo-measurement key used to deduplicate monitoring-failure alerts
MONITORING_KEY = "_monitoring"


@dataclass
class FreshnessConfig:
    """Per-measurement freshness SLAs.

    Attributes:
        default_sla_minutes: SLA applied to measurements without an entry
        slas: Per-measurement SLA overrides in minutes
        ignore: Measurements excluded from checking (no data source by design)
    """

    default_sla_minutes: int = 120
    slas: dict[str, int] = field(default_factory=dict)
    ignore: list[str] = field(default_factory=list)

    @classmethod
    def load(cls, path: Path) -> "FreshnessConfig":
        """Load the configuration from a JSON file.

        Args:
            path: Path to the JSON configuration

        Returns:
            Parsed configuration
        """
        data = json.loads(path.read_text())
        return cls(
            default_sla_minutes=data.get("default_sla_minutes", 120),
            slas=data.get("slas", {}),
            ignore=data.get("ignore", []),
        )

    def sla_for(self, measurement: str) -> timedelta:
        """Return the freshness SLA for a measurement.

        Args:
            measurement: Measurement name

        Returns:
            SLA as a timedelta (default for unlisted measurements)
        """
        return timedelta(minutes=self.slas.get(measurement, self.default_sla_minutes))


class AlertStore:
    """File-backed alert state for deduplication and recovery detection."""

    def __init__(self, path: Path) -> None:
        """Initialize the store.

        Args:
            path: JSON file holding the alert state between runs
        """
        self._path = path
        self._state: dict[str, dict[str, str]] = {}
        if path.exists():
            try:
                self._state = json.loads(path.read_text())
            except (OSError, json.JSONDecodeError):
                # a corrupt state file must not block alerting; start fresh
                self._state = {}

    def is_stale(self, measurement: str) -> bool:
        """Whether the measurement was stale at the last check."""
        return measurement in self._state

    def last_alerted(self, measurement: str) -> datetime | None:
        """When the last alert for the measurement was sent."""
        entry = self._state.get(measurement)
        if entry is None:
            return None
        return datetime.fromisoformat(entry["alerted_at"])

    def mark_alerted(self, measurement: str, now: datetime) -> None:
        """Record that an alert was sent for the measurement."""
        self._state[measurement] = {"alerted_at": now.isoformat()}

    def mark_recovered(self, measurement: str) -> None:
        """Clear the stale record for the measurement."""
        self._state.pop(measurement, None)

    def save(self) -> None:
        """Persist the alert state."""
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(self._state, indent=2))


class HealthcheckService(BaseService):
    """Check measurement freshness and alert via Telegram."""

    def __init__(
        self,
        config: FreshnessConfig,
        store: AlertStore,
        notifier: TelegramNotifier | None = None,
        **kwargs: object,
    ) -> None:
        """Initialize the healthcheck.

        Args:
            config: Freshness SLA configuration
            store: Alert state store for dedup/recovery
            notifier: Notification channel (created if not provided)
            **kwargs: Forwarded to BaseService (settings, repository)
        """
        super().__init__(**kwargs)  # type: ignore[arg-type]
        self._config = config
        self._store = store
        self._notifier = notifier or TelegramNotifier()

    async def run(self) -> int:
        """Run one healthcheck pass.

        Returns:
            Number of alert/recovery messages sent
        """
        now = datetime.now(UTC)
        try:
            measurements = await self._list_measurements()
            sent = await self._check_measurements(measurements, now)
        except Exception as e:
            self._logger.error("healthcheck_failed", error=str(e))
            sent = self._alert_monitoring_failure(now, str(e))
            self._store.save()
            return sent

        # influx reachable again after a monitoring-failure alert
        if self._store.is_stale(MONITORING_KEY):
            self._store.mark_recovered(MONITORING_KEY)
            self._notifier.send("✅ Healthcheck: InfluxDB wieder erreichbar.")
            sent += 1

        self._store.save()
        self._logger.info(
            "healthcheck_completed", measurements=len(measurements), sent=sent
        )
        return sent

    async def _list_measurements(self) -> list[str]:
        """List all measurements in the database (minus ignored ones)."""
        names = []
        async for row in self._db.query("SHOW MEASUREMENTS"):
            name = row.get("name")
            if name and name not in self._config.ignore:
                names.append(name)
        return names

    async def _check_measurements(self, measurements: list[str], now: datetime) -> int:
        """Check each measurement and send alerts/recoveries as needed."""
        sent = 0
        for measurement in measurements:
            latest = await self._db.get_latest_timestamp(measurement)
            sla = self._config.sla_for(measurement)
            stale = latest is None or now - latest > sla

            if stale:
                age = "nie" if latest is None else _format_age(now - latest)
                if self._send_dedup(
                    measurement,
                    now,
                    f"⚠️ {measurement}: keine Daten seit {age} "
                    f"(SLA {int(sla.total_seconds() // 60)} min).",
                ):
                    sent += 1
            elif self._store.is_stale(measurement):
                self._store.mark_recovered(measurement)
                self._notifier.send(f"✅ {measurement}: Daten kommen wieder an.")
                sent += 1
        return sent

    def _alert_monitoring_failure(self, now: datetime, error: str) -> int:
        """Alert that the healthcheck itself cannot reach InfluxDB."""
        if self._send_dedup(
            MONITORING_KEY,
            now,
            f"🚨 Healthcheck: InfluxDB nicht erreichbar ({error}).",
        ):
            return 1
        return 0

    def _send_dedup(self, key: str, now: datetime, text: str) -> bool:
        """Send an alert unless one was sent within the reminder interval."""
        last = self._store.last_alerted(key)
        if last is not None and now - last < REMINDER_INTERVAL:
            return False
        self._notifier.send(text)
        self._store.mark_alerted(key, now)
        return True


# unit boundaries for human-readable ages
MINUTES_AS_MINUTES = 120
MINUTES_AS_HOURS = 48 * 60


def _format_age(age: timedelta) -> str:
    """Render a timedelta as a compact human-readable age."""
    total_minutes = int(age.total_seconds() // 60)
    if total_minutes < MINUTES_AS_MINUTES:
        return f"{total_minutes} min"
    if total_minutes < MINUTES_AS_HOURS:
        return f"{total_minutes // 60} h"
    return f"{total_minutes // (60 * 24)} Tagen"
