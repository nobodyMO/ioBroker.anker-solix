"""Tests for EV charger schedule & automation helpers."""

import sys
from pathlib import Path

PYTHON_DIR = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from ev_charger_schedule import (  # noqa: E402
    extract_ev_charger_control_value,
    ev_charger_control_supported,
    ev_charger_control_writable,
    parse_ev_charger_control_set,
)


def test_extract_schedule_switch_on_off() -> None:
    assert extract_ev_charger_control_value(
        "ev_charger_schedule_switch", {"schedule_switch": "1"}
    )
    assert not extract_ev_charger_control_value(
        "ev_charger_schedule_switch", {"schedule_switch": "2"}
    )
    assert extract_ev_charger_control_value(
        "ev_charger_schedule_switch", {"mqtt_data": {"schedule_switch": "1"}}
    )


def test_extract_schedule_mode() -> None:
    assert (
        extract_ev_charger_control_value(
            "ev_charger_schedule_mode", {"schedule_mode": "0"}
        )
        == "normal"
    )
    assert (
        extract_ev_charger_control_value(
            "ev_charger_schedule_mode", {"schedule_mode": "1"}
        )
        == "smart"
    )


def test_extract_times() -> None:
    data = {
        "week_start_time": "8:30",
        "week_end_time": "18:00",
        "weekend_start_time": "9:00",
        "weekend_end_time": "17:30",
    }
    assert extract_ev_charger_control_value("ev_charger_week_start_time", data) == "08:30"
    assert extract_ev_charger_control_value("ev_charger_week_end_time", data) == "18:00"


def test_parse_schedule_switch_mqtt_values() -> None:
    cmd, parm, val = parse_ev_charger_control_set("ev_charger_schedule_switch", True)
    assert parm == "set_schedule_switch"
    assert val == 1
    _, _, val2 = parse_ev_charger_control_set("ev_charger_schedule_switch", False)
    assert val2 == 2


def test_parse_schedule_mode() -> None:
    _, _, val = parse_ev_charger_control_set("ev_charger_schedule_mode", "smart")
    assert val == 1
    _, _, val2 = parse_ev_charger_control_set("ev_charger_schedule_mode", "normal")
    assert val2 == 0


def test_parse_time_and_weekend_mode() -> None:
    cmd, parm, val = parse_ev_charger_control_set("ev_charger_week_start_time", "7:15")
    assert cmd.endswith("ev_charger_schedule_times")
    assert parm == "set_week_start_time"
    assert val == "07:15"
    _, parm2, mode = parse_ev_charger_control_set("ev_charger_weekend_mode", "different")
    assert parm2 == "set_weekend_mode"
    assert mode == "different"


def test_random_delay_requires_feature() -> None:
    data = {"mqtt_supported": True, "device_code_features": {"delay_start": False}}
    assert not ev_charger_control_supported("ev_charger_random_delay_switch", data)
    data["device_code_features"] = {"delay_start": True}
    assert ev_charger_control_supported("ev_charger_random_delay_switch", data)


def test_writable_requires_mqtt() -> None:
    data = {"mqtt_supported": True}
    assert ev_charger_control_writable(
        "ev_charger_schedule_switch", data, {"mqttUsage": True}
    )
    assert not ev_charger_control_writable(
        "ev_charger_schedule_switch", data, {"mqttUsage": False}
    )
