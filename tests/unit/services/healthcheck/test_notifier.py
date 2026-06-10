"""Unit tests for the Telegram notifier."""

import json
import subprocess
from unittest.mock import MagicMock, patch

import pytest
from home_monitoring.core.exceptions import APIError
from home_monitoring.services.healthcheck.notifier import TelegramNotifier


def _proc(returncode: int = 0, stdout: str = "") -> MagicMock:
    proc = MagicMock()
    proc.returncode = returncode
    proc.stdout = stdout
    proc.stderr = ""
    return proc


def _users_state(users: dict) -> str:
    return json.dumps({"val": json.dumps(users)})


def test_send_with_registered_users() -> None:
    """A message is sent when the adapter knows at least one chat (happy path)."""
    with patch("subprocess.run") as run:
        run.side_effect = [
            _proc(stdout=_users_state({"123": {"userName": "C"}})),
            _proc(returncode=0),
        ]

        TelegramNotifier().send("hello")

    sent_cmd = run.call_args_list[1][0][0]
    assert "message" in sent_cmd
    assert json.dumps({"text": "hello"}) in sent_cmd


def test_send_fails_without_registered_users() -> None:
    """An empty user list raises instead of delivering to nobody (unhappy path)."""
    with patch("subprocess.run") as run:
        run.side_effect = [_proc(stdout=_users_state({}))]

        with pytest.raises(APIError, match="no registered chat users"):
            TelegramNotifier().send("hello")

    assert run.call_count == 1  # never attempted the send


def test_send_fails_on_unreadable_users_state() -> None:
    """Garbage from the users state raises, not silently passes (unhappy path)."""
    with patch("subprocess.run") as run:
        run.side_effect = [_proc(stdout="not json")]

        with pytest.raises(APIError, match="Cannot read"):
            TelegramNotifier().send("hello")


def test_send_fails_on_nonzero_exit(monkeypatch) -> None:
    """A failing iobroker message command raises (unhappy path)."""
    with patch("subprocess.run") as run:
        run.side_effect = [
            _proc(stdout=_users_state({"123": {}})),
            _proc(returncode=1),
        ]

        with pytest.raises(APIError, match="Failed to send"):
            TelegramNotifier().send("hello")


def test_send_fails_on_timeout() -> None:
    """A hanging iobroker CLI raises within the timeout budget (unhappy path)."""
    with patch("subprocess.run") as run:
        run.side_effect = subprocess.TimeoutExpired(cmd="iobroker", timeout=30)

        with pytest.raises(APIError):
            TelegramNotifier().send("hello")
