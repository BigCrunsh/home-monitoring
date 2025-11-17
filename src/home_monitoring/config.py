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
        extra="ignore"
    )

    # InfluxDB settings
    influxdb_host: str = "localhost"
    influxdb_port: int = 8086
    influxdb_database: str = "home_monitoring"
    influxdb_username: str | None = None
    influxdb_password: str | None = None

    # Netatmo settings
    netatmo_client_id: str
    netatmo_client_secret: str
    netatmo_username: str
    netatmo_password: str

    # SolarEdge settings
    solaredge_api_key: str
    solaredge_site_id: str

    # Gardena settings
    gardena_client_id: str
    gardena_client_secret: str
    gardena_username: str
    gardena_password: str

    # Tibber settings
    tibber_access_token: str

    # Tankerkoenig settings
    tankerkoenig_api_key: str

    # Logging
    log_level: str = "INFO"
    json_logs: bool = True

    def model_dump(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        """Override model_dump to exclude None values."""
        kwargs.setdefault("exclude_none", True)
        return super().model_dump(*args, **kwargs)


def get_settings() -> Settings:
    """Get application settings."""
    return Settings()


_settings = None


def get_settings() -> Settings:
    """Get application settings."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
