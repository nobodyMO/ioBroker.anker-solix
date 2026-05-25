"""Tests for EV charger comfort controls (step 5) and restart."""

import sys
from pathlib import Path

PYTHON_DIR = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from ev_charger_comfort import (  # noqa: E402
    build_ev_light_off_schedule_parm_map,
    ev_charger_comfort_control_supported,
    extract_ev_charger_comfort_value,
    parse_ev_charger_comfort_set,
)
from ev_charger_schedule import (  # noqa: E402
    EV_CHARGER_MQTT_CONTROL_IDS,
    parse_ev_charger_control_set,
)


def test_restart_command() -> None:
    cmd, parm, val = parse_ev_charger_comfort_set("ev_charger_restart", True)
    assert cmd == "device_power_mode"
    assert parm == "set_device_power_mode"
    assert val == 5


def test_plug_lock_schedule_onoff() -> None:
    _, parm, val = parse_ev_charger_control_set("ev_charger_plug_lock_switch", True)
    assert parm == "set_plug_lock_switch"
    assert val == 1
    _, _, off = parse_ev_charger_control_set("ev_charger_plug_lock_switch", False)
    assert off == 2


def test_light_off_parm_map() -> None:
    data = {
        "light_off_schedule_switch": "1",
        "light_off_start_time": "22:00",
        "light_off_end_time": "06:00",
    }
    parm_map = build_ev_light_off_schedule_parm_map(
        "set_light_off_end_time", "07:00", data
    )
    assert parm_map["set_light_off_schedule_switch"] == 1
    assert parm_map["set_light_off_start_time"] == "22:00"
    assert parm_map["set_light_off_end_time"] == "07:00"


def test_brightness_step() -> None:
    _, parm, val = parse_ev_charger_comfort_set("ev_charger_light_brightness", 50)
    assert parm == "set_light_brightness"
    assert val == 50


def test_plug_lock_hidden_for_cable() -> None:
    data = {"device_code_features": {"gunType": "cable"}}
    assert not ev_charger_comfort_control_supported(
        "ev_charger_plug_lock_switch", data
    )


def test_extract_swipe_and_touch() -> None:
    assert extract_ev_charger_comfort_value(
        "ev_charger_smart_touch_mode", {"smart_touch_mode": "1"}
    ) == "anti_mistouch"
    assert extract_ev_charger_comfort_value(
        "ev_charger_wipe_up_mode", {"wipe_up_mode": "3"}
    ) == "boost_charge"


def test_comfort_ids_in_mqtt_list() -> None:
    assert "ev_charger_restart" in EV_CHARGER_MQTT_CONTROL_IDS
    assert "ev_charger_modbus_switch" in EV_CHARGER_MQTT_CONTROL_IDS
