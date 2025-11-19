"""Integration tests for data collection scripts."""
import importlib
import sys
from pathlib import Path

import pytest


SCRIPTS = [
    "collect_netatmo_data",
    "collect_solaredge_data",
    "collect_gardena_data",
    "collect_tankerkoenig_data",
    "collect_tibber_data",
    "collect_techem_data",
    "update_dns",
]

@pytest.mark.parametrize("script_name", SCRIPTS)
def test_script_exists(script_name: str) -> None:
    """Test that script files exist in the correct location and are executable.
    
    Args:
        script_name: Name of the script to test without .py extension
    """
    script_file = Path("src/home_monitoring/scripts") / f"{script_name}.py"
    assert script_file.exists(), f"Script file not found: {script_file}"
    assert script_file.stat().st_mode & 0o111, f"Script {script_file} is not executable"

@pytest.mark.parametrize("script_name", SCRIPTS)
def test_script_imports(script_name: str) -> None:
    """Test that scripts can be imported without errors.
    
    Args:
        script_name: Name of the script to test without .py extension
    """
    module_name = f"home_monitoring.scripts.{script_name}"
    try:
        importlib.import_module(module_name)
    except ImportError as e:
        pytest.fail(f"Failed to import {module_name}: {e}")


