"""Tests for EV charger mode helpers (HA-aligned)."""

import sys
from pathlib import Path

PYTHON_DIR = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from ev_charger_mode import (  # noqa: E402
    current_ev_charger_mode,
    ev_charger_action_options,
    ev_charger_mode_options,
    ev_charger_mode_writable,
    parse_ev_charger_mode_set,
)


def test_parse_mode_set() -> None:
    assert parse_ev_charger_mode_set("start_charge") == 1
    assert parse_ev_charger_mode_set("stop_charge") == 2
    assert parse_ev_charger_mode_set("boost_charge") == 4


def test_current_mode_standby() -> None:
    data = {"ev_charger_status": "0"}
    assert current_ev_charger_mode(data) == "stop_charge"
    assert "start_charge" in ev_charger_mode_options(data)


def test_current_mode_charging() -> None:
    data = {"ev_charger_status": "2"}
    assert current_ev_charger_mode(data) == "start_charge"
    opts = ev_charger_mode_options(data)
    assert "stop_charge" in opts
    assert "boost_charge" in opts


def test_action_options_exclude_wait_states() -> None:
    data = {"ev_charger_status": "1", "plug_countdown_seconds": "120"}
    assert current_ev_charger_mode(data) == "wait_plug"
    assert "wait_plug" in ev_charger_mode_options(data)
    actions = ev_charger_action_options(data)
    assert "wait_plug" not in actions
    assert "stop_charge" in actions


def test_boost_flag_zero_is_off() -> None:
    data = {"ev_charger_status": "2", "boost_status": "0"}
    assert current_ev_charger_mode(data) == "start_charge"


def test_writable_requires_mqtt() -> None:
    data = {"ev_charger_status": "0", "mqtt_supported": True}
    assert ev_charger_mode_writable(data, {"mqttUsage": True}) is True
    assert ev_charger_mode_writable(data, {"mqttUsage": False}) is False
