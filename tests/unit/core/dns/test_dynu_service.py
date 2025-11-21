"""Unit tests for Dynu DNS service."""

import pytest
from home_monitoring.config import Settings
from home_monitoring.core.dns import DynuService


def test_settings_has_dynu_attributes():
    """Test that Settings class has required Dynu DNS attributes."""
    settings = Settings()
    
    # These should exist (reproduces the AttributeError)
    try:
        _ = settings.dynu_host
        _ = settings.dynu_username  
        _ = settings.dynu_password
    except AttributeError as e:
        pytest.fail(f"Missing Dynu settings attribute: {e}")


def test_dynu_service_init_with_missing_settings():
    """Test DynuService initialization with missing settings."""
    # This should fail if dynu settings are missing
    settings = Settings()
    
    # Service should initialize but accessing dynu_* attributes should work
    service = DynuService(settings=settings)
    
    # These attributes should exist (even if None)
    assert hasattr(service._settings, 'dynu_host')
    assert hasattr(service._settings, 'dynu_username')
    assert hasattr(service._settings, 'dynu_password')


def test_dynu_service_init_with_settings():
    """Test DynuService initialization with proper settings."""
    settings = Settings(
        dynu_host="example.dynu.net",
        dynu_username="testuser", 
        dynu_password="testpass"
    )
    
    service = DynuService(settings=settings)
    assert service._settings.dynu_host == "example.dynu.net"
    assert service._settings.dynu_username == "testuser"
    assert service._settings.dynu_password == "testpass"
