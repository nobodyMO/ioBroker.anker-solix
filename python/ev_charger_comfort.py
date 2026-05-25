"""EV charger hardware & comfort controls (HA-aligned, MQTT A5191 step 5)."""

from __future__ import annotations

import re
from typing import Any

from ev_charger_power import _merge_mqtt_cache
from solixapi.mqttcmdmap import SolixMqttCommands

_TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$")

# ioBroker list labels (DE)
SMART_TOUCH_MODE_STATES_DE: dict[str, str] = {
    "simple": "Einfach",
    "anti_mistouch": "Fehlbedienungsschutz",
}

SWIPE_MODE_STATES_DE: dict[str, str] = {
    "off": "Aus",
    "start_charge": "Laden starten",
    "stop_charge": "Laden stoppen",
    "boost_charge": "Boost",
}

_RESTART_CONTROL = "ev_charger_restart"

# control_id -> (mqtt_command, parameter_name, kind)
# kind: schedule_onoff (1/2), std_onoff (0/1), brightness, touch_mode, swipe_mode
_EV_COMFORT_SPECS: dict[str, tuple[str, str, str]] = {
    "ev_charger_plug_lock_switch": (
        SolixMqttCommands.plug_lock_switch,
        "set_plug_lock_switch",
        "schedule_onoff",
    ),
    "ev_charger_light_brightness": (
        SolixMqttCommands.light_brightness,
        "set_light_brightness",
        "brightness",
    ),
    "ev_charger_light_off_schedule_switch": (
        SolixMqttCommands.light_off_schedule,
        "set_light_off_schedule_switch",
        "std_onoff",
    ),
    "ev_charger_smart_touch_mode": (
        SolixMqttCommands.smart_touch_mode_select,
        "set_smart_touch_mode_select",
        "touch_mode",
    ),
    "ev_charger_modbus_switch": (
        SolixMqttCommands.modbus_switch,
        "set_modbus_switch",
        "std_onoff",
    ),
    "ev_charger_wipe_up_mode": (
        SolixMqttCommands.swipe_up_mode_select,
        "set_wipe_up_mode_select",
        "swipe_mode",
    ),
    "ev_charger_wipe_down_mode": (
        SolixMqttCommands.swipe_down_mode_select,
        "set_wipe_down_mode_select",
        "swipe_mode",
    ),
}

_LIGHT_TIME_CONTROLS = {
    "ev_charger_light_off_start_time": "light_off_start_time",
    "ev_charger_light_off_end_time": "light_off_end_time",
}

_LIGHT_OFF_PARM_SPECS: list[tuple[str, str, str]] = [
    ("set_light_off_schedule_switch", "light_off_schedule_switch", "std_onoff"),
    ("set_light_off_start_time", "light_off_start_time", "time"),
    ("set_light_off_end_time", "light_off_end_time", "time"),
]

EV_CHARGER_COMFORT_CONTROL_IDS: list[str] = [
    _RESTART_CONTROL,
    *_EV_COMFORT_SPECS.keys(),
    *_LIGHT_TIME_CONTROLS.keys(),
]


def _std_switch_on(val: Any) -> bool:
    if val is None or val == "":
        return False
    return str(val).strip().lower() in ("1", "true", "on", "yes")


def _schedule_switch_on(val: Any) -> bool:
    if val is None or val == "":
        return False
    s = str(val).strip().lower()
    if s in ("1", "on", "true", "yes"):
        return True
    if s in ("2", "off", "false", "no", "0"):
        return False
    return bool(int(s)) if str(val).isdigit() else False


def _format_time(val: Any) -> str | None:
    if val is None or val == "":
        return None
    s = str(val).strip()
    if _TIME_RE.match(s):
        parts = s.split(":")
        return f"{int(parts[0]):02d}:{parts[1]}"
    return s


def _parse_std_switch_set(value: Any) -> int:
    if isinstance(value, bool):
        return 1 if value else 0
    s = str(value or "").strip().lower()
    if s in ("1", "true", "on", "yes"):
        return 1
    if s in ("0", "false", "off", "no", "2"):
        return 0
    raise ValueError(f"Invalid switch value '{value}' (use on/off or true/false)")


def _parse_schedule_switch_set(value: Any) -> int:
    if isinstance(value, bool):
        return 1 if value else 2
    s = str(value or "").strip().lower()
    if s in ("1", "true", "on", "yes"):
        return 1
    if s in ("2", "false", "off", "no", "0"):
        return 2
    raise ValueError(f"Invalid schedule switch value '{value}' (use on/off or true/false)")


def _parse_time_set(value: Any) -> str:
    formatted = _format_time(value)
    if formatted and _TIME_RE.match(formatted):
        return formatted
    raise ValueError(f"Invalid time '{value}' (use HH:MM)")


def _mqtt_val(data: dict, key: str) -> Any:
    mqtt = data.get("mqtt_data")
    if isinstance(mqtt, dict) and key in mqtt and mqtt[key] not in (None, ""):
        return mqtt[key]
    return data.get(key)


def _mqtt_switch_int(val: Any, *, default: int = 0) -> int:
    if val is None or val == "":
        return default
    if isinstance(val, bool):
        return 1 if val else 0
    try:
        return _parse_std_switch_set(val)
    except ValueError:
        return 1 if _std_switch_on(val) else 0


def _touch_mode_name(val: Any) -> str | None:
    if val is None or val == "":
        return None
    s = str(val).strip().lower()
    if s in ("0", "simple"):
        return "simple"
    if s in ("1", "anti_mistouch", "avoid_error"):
        return "anti_mistouch"
    return s if s in SMART_TOUCH_MODE_STATES_DE else None


def _swipe_mode_name(val: Any) -> str | None:
    if val is None or val == "":
        return None
    s = str(val).strip().lower()
    mapping = {
        "0": "off",
        "1": "start_charge",
        "2": "stop_charge",
        "3": "boost_charge",
    }
    if s in mapping:
        return mapping[s]
    return s if s in SWIPE_MODE_STATES_DE else None


def _encode_light_time(data: dict, state_key: str) -> str:
    formatted = _format_time(_mqtt_val(data, state_key))
    return formatted or "00:00"


def build_ev_light_off_schedule_parm_map(
    target_parm: str,
    target_value: Any,
    data: dict,
    mdev: Any | None = None,
) -> dict[str, Any]:
    """Build full parm_map for light_off_schedule (all fields required)."""
    cache = _merge_mqtt_cache(data, mdev)
    parm_map: dict[str, Any] = {}
    for parm, state_key, kind in _LIGHT_OFF_PARM_SPECS:
        if parm == target_parm:
            parm_map[parm] = target_value
        elif kind == "std_onoff":
            parm_map[parm] = _mqtt_switch_int(_mqtt_val(cache, state_key))
        else:
            parm_map[parm] = _encode_light_time(cache, state_key)
    return parm_map


def is_ev_light_off_schedule_command(cmd: str) -> bool:
    return cmd == SolixMqttCommands.light_off_schedule


def _parse_brightness_set(value: Any) -> int:
    try:
        level = int(round(float(value)))
    except (TypeError, ValueError):
        raise ValueError(f"Invalid brightness '{value}' (use 0-100)") from None
    if level < 0 or level > 100:
        raise ValueError(f"Invalid brightness '{value}' (allowed: 0-100)")
    if level % 10 != 0:
        raise ValueError(f"Invalid brightness '{value}' (step 10, e.g. 0, 10, …, 100)")
    return level


def _parse_touch_mode_set(value: Any) -> int:
    name = _touch_mode_name(value) or str(value or "").strip().lower()
    if name == "simple":
        return 0
    if name == "anti_mistouch":
        return 1
    raise ValueError(f"Invalid touch mode '{value}' (use: simple, anti_mistouch)")


def _parse_swipe_mode_set(value: Any) -> int:
    name = _swipe_mode_name(value) or str(value or "").strip().lower()
    mapping = {
        "off": 0,
        "start_charge": 1,
        "stop_charge": 2,
        "boost_charge": 3,
    }
    if name in mapping:
        return mapping[name]
    raise ValueError(
        f"Invalid swipe mode '{value}' (use: off, start_charge, stop_charge, boost_charge)"
    )


def _parse_restart_set(value: Any) -> int:
    if isinstance(value, bool):
        if value:
            return 5
        raise ValueError("ev_charger_restart requires true/on to trigger restart")
    s = str(value or "").strip().lower()
    if s in ("1", "true", "on", "yes", "restart"):
        return 5
    raise ValueError("ev_charger_restart requires true/on to trigger restart")


def extract_ev_charger_comfort_value(control_id: str, data: dict) -> Any:
    if control_id == "ev_charger_plug_lock_switch":
        return _schedule_switch_on(_mqtt_val(data, "plug_lock_switch"))
    if control_id == "ev_charger_light_brightness":
        raw = _mqtt_val(data, "light_brightness")
        if raw in (None, ""):
            return None
        try:
            return int(float(raw))
        except (TypeError, ValueError):
            return None
    if control_id == "ev_charger_light_off_schedule_switch":
        return _std_switch_on(_mqtt_val(data, "light_off_schedule_switch"))
    if control_id in _LIGHT_TIME_CONTROLS:
        return _format_time(_mqtt_val(data, _LIGHT_TIME_CONTROLS[control_id]))
    if control_id == "ev_charger_smart_touch_mode":
        return _touch_mode_name(_mqtt_val(data, "smart_touch_mode"))
    if control_id == "ev_charger_modbus_switch":
        return _std_switch_on(_mqtt_val(data, "modbus_switch"))
    if control_id == "ev_charger_wipe_up_mode":
        return _swipe_mode_name(_mqtt_val(data, "wipe_up_mode"))
    if control_id == "ev_charger_wipe_down_mode":
        return _swipe_mode_name(_mqtt_val(data, "wipe_down_mode"))
    return None


def parse_ev_charger_comfort_set(
    control_id: str, value: Any, data: dict | None = None
) -> tuple[str, str, Any]:
    if control_id == _RESTART_CONTROL:
        return (
            SolixMqttCommands.device_power_mode,
            "set_device_power_mode",
            _parse_restart_set(value),
        )
    if control_id in _LIGHT_TIME_CONTROLS:
        field = _LIGHT_TIME_CONTROLS[control_id]
        return (
            SolixMqttCommands.light_off_schedule,
            f"set_{field}",
            _parse_time_set(value),
        )
    if control_id not in _EV_COMFORT_SPECS:
        raise ValueError(f"Unknown EV charger comfort control '{control_id}'")
    cmd, parm, kind = _EV_COMFORT_SPECS[control_id]
    if kind == "schedule_onoff":
        return cmd, parm, _parse_schedule_switch_set(value)
    if kind == "std_onoff":
        return cmd, parm, _parse_std_switch_set(value)
    if kind == "brightness":
        return cmd, parm, _parse_brightness_set(value)
    if kind == "touch_mode":
        return cmd, parm, _parse_touch_mode_set(value)
    if kind == "swipe_mode":
        return cmd, parm, _parse_swipe_mode_set(value)
    raise ValueError(f"Unsupported comfort control kind '{kind}'")


def ev_charger_comfort_control_supported(
    control_id: str, data: dict, mdev: Any | None = None
) -> bool:
    if control_id == "ev_charger_plug_lock_switch":
        features = data.get("device_code_features") or {}
        if features.get("gunType") == "cable":
            return False
    if control_id == _RESTART_CONTROL:
        if mdev is not None:
            return SolixMqttCommands.device_power_mode in (mdev.controls or {})
        return True
    spec = _EV_COMFORT_SPECS.get(control_id)
    if spec:
        if mdev is not None:
            return spec[0] in (mdev.controls or {})
        return True
    if control_id in _LIGHT_TIME_CONTROLS:
        if mdev is not None:
            return SolixMqttCommands.light_off_schedule in (mdev.controls or {})
        return True
    return False


def ev_charger_comfort_control_writable(
    control_id: str, data: dict, config: dict | None, mdev: Any | None = None
) -> bool:
    from ev_charger_schedule import ev_charger_mqtt_available  # noqa: PLC0415

    if not ev_charger_mqtt_available(data, config):
        return False
    return ev_charger_comfort_control_supported(control_id, data, mdev)
