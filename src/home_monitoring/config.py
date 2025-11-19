"""Configuration management for home monitoring."""

from typing import Any

from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # InfluxDB settings
    influxdb_host: str = "localhost"
    influxdb_port: int = 8086
    influxdb_database: str = "home_monitoring"
    influxdb_username: str | None = None
    influxdb_password: str | None = None

    # Netatmo settings
    netatmo_client_id: str | None = None
    netatmo_client_secret: str | None = None
    netatmo_username: str | None = None
    netatmo_password: str | None = None

    # SolarEdge settings
    solaredge_api_key: str | None = None
    solaredge_site_id: str | None = None

    # Gardena settings
    gardena_application_id: str | None = None
    gardena_application_secret: str | None = None
    gardena_email: str | None = None
    gardena_password: str | None = None

    # Tibber settings
    tibber_access_token: str | None = None

    # Tankerkoenig settings
    tankerkoenig_api_key: str | None = None

    # Logging
    log_level: str = "INFO"
    json_logs: bool = True

    def model_dump(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        """Override model_dump to exclude None values."""
        kwargs.setdefault("exclude_none", True)
        return super().model_dump(*args, **kwargs)


class SettingsManager:
    """Singleton manager for application settings."""

    _instance: Settings | None = None

    @classmethod
    def get_settings(cls) -> Settings:
        """Get application settings.

        Returns a singleton instance of Settings to avoid loading environment
        variables multiple times.
        """
        if cls._instance is None:
            cls._instance = Settings()
        return cls._instance


def get_settings() -> Settings:
    """Get application settings.

    Returns a singleton instance of Settings to avoid loading environment
    variables multiple times.
    """
    return SettingsManager.get_settings()
