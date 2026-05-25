"""Tests for EV charger current, solar & phase controls."""

import sys
from pathlib import Path

PYTHON_DIR = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from ev_charger_power import (  # noqa: E402
    extract_ev_charger_power_value,
    ev_charger_power_control_supported,
    ev_charger_power_control_writable,
    parse_ev_charger_power_set,
)
from ev_charger_schedule import (  # noqa: E402
    extract_ev_charger_control_value,
    parse_ev_charger_control_set,
)


def test_extract_max_current() -> None:
    assert extract_ev_charger_power_value(
        "ev_charger_max_current", {"max_evcharge_current": "16"}
    ) == 16.0


def test_extract_solar_mode() -> None:
    assert (
        extract_ev_charger_control_value(
            "ev_charger_solar_mode", {"solar_evcharge_mode": "1"}
        )
        == "solar_only"
    )


def test_parse_max_current() -> None:
    cmd, parm, val = parse_ev_charger_control_set(
        "ev_charger_max_current",
        12,
        {"min_current_limit": "6", "max_current_limit": "32"},
    )
    assert "max_charge" in cmd or "ev_max" in cmd
    assert parm == "set_max_evcharge_current"
    assert val == 12


def test_parse_solar_switch() -> None:
    _, _, val = parse_ev_charger_power_set("ev_charger_solar_switch", True)
    assert val == 1


def test_parse_phase_mode() -> None:
    _, _, val = parse_ev_charger_power_set("ev_charger_phase_mode", "one_phase")
    assert val == 1


def test_auto_phase_hidden_on_single_phase() -> None:
    data = {"mqtt_supported": True, "device_code_features": {"phase": "single"}}
    assert not ev_charger_power_control_supported("ev_charger_auto_phase_switch", data)


def test_writable_requires_mqtt() -> None:
    data = {"mqtt_supported": True}
    assert ev_charger_power_control_writable(
        "ev_charger_solar_switch", data, {"mqttUsage": True}
    )
    assert not ev_charger_power_control_writable(
        "ev_charger_solar_switch", data, {"mqttUsage": False}
    )
