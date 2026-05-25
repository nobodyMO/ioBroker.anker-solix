"""EV charger schedule & automation (HA-aligned, MQTT A5191)."""

from __future__ import annotations

import re
from typing import Any

from solixapi.apitypes import SolixScheduleWeekendMode
from solixapi.helpers import get_enum_name
from solixapi.mqttcmdmap import SolixMqttCommands

EV_CHARGER = "ev_charger"

# ioBroker list labels (DE)
SCHEDULE_MODE_STATES_DE: dict[str, str] = {
    "normal": "Normal",
    "smart": "Smart",
}

WEEKEND_MODE_STATES_DE: dict[str, str] = {
    "same": "Wochenende wie Werktag",
    "different": "Wochenende anders",
}

_TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$")

# control_id -> (mqtt_command, parameter_name, kind)
# kind: schedule_onoff (1/2), std_onoff (0/1), schedule_mode, weekend_mode, time
_EV_CONTROL_SPECS: dict[str, tuple[str, str, str]] = {
    "ev_charger_schedule_switch": (
        SolixMqttCommands.ev_charger_schedule_settings,
        "set_schedule_switch",
        "schedule_onoff",
    ),
    "ev_charger_schedule_mode": (
        SolixMqttCommands.ev_charger_schedule_settings,
        "set_schedule_mode",
        "schedule_mode",
    ),
    "ev_charger_auto_start_switch": (
        SolixMqttCommands.ev_auto_start_switch,
        "set_auto_start_switch",
        "std_onoff",
    ),
    "ev_charger_auto_charge_restart_switch": (
        SolixMqttCommands.ev_auto_charge_restart_switch,
        "set_auto_charge_restart_switch",
        "std_onoff",
    ),
    "ev_charger_random_delay_switch": (
        SolixMqttCommands.ev_random_delay_switch,
        "set_random_delay_switch",
        "std_onoff",
    ),
}

_TIME_CONTROLS = {
    "ev_charger_week_start_time": "week_start_time",
    "ev_charger_week_end_time": "week_end_time",
    "ev_charger_weekend_start_time": "weekend_start_time",
    "ev_charger_weekend_end_time": "weekend_end_time",
}

_WEEKEND_MODE_CONTROL = "ev_charger_weekend_mode"

EV_CHARGER_SCHEDULE_CONTROL_IDS: list[str] = [
    *_EV_CONTROL_SPECS.keys(),
    *_TIME_CONTROLS.keys(),
    _WEEKEND_MODE_CONTROL,
]



def _mqtt_val(data: dict, key: str) -> Any:
    mqtt = data.get("mqtt_data")
    if isinstance(mqtt, dict) and key in mqtt and mqtt[key] not in (None, ""):
        return mqtt[key]
    return data.get(key)


def _schedule_switch_on(val: Any) -> bool:
    if val is None or val == "":
        return False
    s = str(val).strip().lower()
    if s in ("1", "on", "true", "yes"):
        return True
    if s in ("2", "off", "false", "no", "0"):
        return False
    return bool(int(s)) if str(val).isdigit() else False


def _std_switch_on(val: Any) -> bool:
    if val is None or val == "":
        return False
    return str(val).strip().lower() in ("1", "true", "on", "yes")


def _schedule_mode_name(val: Any) -> str | None:
    if val is None or val == "":
        return None
    s = str(val).strip().lower()
    if s in ("0", "normal"):
        return "normal"
    if s in ("1", "smart"):
        return "smart"
    return s if s in SCHEDULE_MODE_STATES_DE else None


def _weekend_mode_name(val: Any) -> str | None:
    if val is None or val == "":
        return None
    s = str(val).strip().lower()
    if s in ("same", "1", SolixScheduleWeekendMode.same.name):
        return SolixScheduleWeekendMode.same.name
    if s in ("different", "2", SolixScheduleWeekendMode.different.name):
        return SolixScheduleWeekendMode.different.name
    return get_enum_name(SolixScheduleWeekendMode, str(val), None)


def _format_time(val: Any) -> str | None:
    if val is None or val == "":
        return None
    s = str(val).strip()
    if _TIME_RE.match(s):
        parts = s.split(":")
        return f"{int(parts[0]):02d}:{parts[1]}"
    return s


def extract_ev_charger_control_value(control_id: str, data: dict) -> Any:
    """Map device/MQTT cache to ioBroker state value."""
    from ev_charger_power import (  # noqa: PLC0415
        EV_CHARGER_POWER_CONTROL_IDS,
        extract_ev_charger_power_value,
    )

    if control_id in EV_CHARGER_POWER_CONTROL_IDS:
        return extract_ev_charger_power_value(control_id, data)
    if control_id == "ev_charger_schedule_switch":
        return _schedule_switch_on(_mqtt_val(data, "schedule_switch"))
    if control_id == "ev_charger_schedule_mode":
        return _schedule_mode_name(_mqtt_val(data, "schedule_mode"))
    if control_id == _WEEKEND_MODE_CONTROL:
        return _weekend_mode_name(_mqtt_val(data, "weekend_mode"))
    if control_id == "ev_charger_auto_start_switch":
        return _std_switch_on(_mqtt_val(data, "auto_start_switch"))
    if control_id == "ev_charger_auto_charge_restart_switch":
        return _std_switch_on(_mqtt_val(data, "auto_charge_restart_switch"))
    if control_id == "ev_charger_random_delay_switch":
        return _std_switch_on(_mqtt_val(data, "random_delay_switch"))
    if control_id in _TIME_CONTROLS:
        return _format_time(_mqtt_val(data, _TIME_CONTROLS[control_id]))
    return None


def _parse_schedule_switch_set(value: Any) -> int:
    if isinstance(value, bool):
        return 1 if value else 2
    s = str(value or "").strip().lower()
    if s in ("1", "true", "on", "yes"):
        return 1
    if s in ("2", "false", "off", "no", "0"):
        return 2
    raise ValueError(f"Invalid schedule switch value '{value}' (use on/off or true/false)")


def _parse_std_switch_set(value: Any) -> int:
    if isinstance(value, bool):
        return 1 if value else 0
    s = str(value or "").strip().lower()
    if s in ("1", "true", "on", "yes"):
        return 1
    if s in ("0", "false", "off", "no", "2"):
        return 0
    raise ValueError(f"Invalid switch value '{value}' (use on/off or true/false)")


def _parse_schedule_mode_set(value: Any) -> int:
    name = _schedule_mode_name(value) or str(value or "").strip().lower()
    if name == "normal":
        return 0
    if name == "smart":
        return 1
    raise ValueError(f"Invalid schedule mode '{value}' (use: normal, smart)")


def _parse_weekend_mode_set(value: Any) -> str:
    name = _weekend_mode_name(value) or str(value or "").strip().lower()
    if name in (SolixScheduleWeekendMode.same.name, SolixScheduleWeekendMode.different.name):
        return name
    raise ValueError(f"Invalid weekend mode '{value}' (use: same, different)")


def _parse_time_set(value: Any) -> str:
    formatted = _format_time(value)
    if formatted and _TIME_RE.match(formatted):
        return formatted
    raise ValueError(f"Invalid time '{value}' (use HH:MM)")


def parse_ev_charger_control_set(
    control_id: str, value: Any, data: dict | None = None
) -> tuple[str, str, Any]:
    """Return (mqtt_command, parameter_name, mqtt_value) for _mqtt_command."""
    from ev_charger_power import (  # noqa: PLC0415
        EV_CHARGER_POWER_CONTROL_IDS,
        parse_ev_charger_power_set,
    )

    if control_id in EV_CHARGER_POWER_CONTROL_IDS:
        return parse_ev_charger_power_set(control_id, value, data)
    if control_id in _EV_CONTROL_SPECS:
        cmd, parm, kind = _EV_CONTROL_SPECS[control_id]
        if kind == "schedule_onoff":
            return cmd, parm, _parse_schedule_switch_set(value)
        if kind == "schedule_mode":
            return cmd, parm, _parse_schedule_mode_set(value)
        if kind == "std_onoff":
            return cmd, parm, _parse_std_switch_set(value)
    if control_id == _WEEKEND_MODE_CONTROL:
        return (
            SolixMqttCommands.ev_charger_schedule_times,
            "set_weekend_mode",
            _parse_weekend_mode_set(value),
        )
    if control_id in _TIME_CONTROLS:
        field = _TIME_CONTROLS[control_id]
        parm = f"set_{field}"
        return SolixMqttCommands.ev_charger_schedule_times, parm, _parse_time_set(value)
    raise ValueError(f"Unknown EV charger control '{control_id}'")


def ev_charger_mqtt_available(data: dict, config: dict | None) -> bool:
    if not (config or {}).get("mqttUsage"):
        return False
    if data.get("is_passive"):
        return False
    return bool(data.get("mqtt_supported") or data.get("mqtt_data"))


def ev_charger_control_supported(
    control_id: str, data: dict, mdev: Any | None = None
) -> bool:
    """True when command exists on MQTT device mapping (and random_delay if required)."""
    from ev_charger_power import (  # noqa: PLC0415
        EV_CHARGER_POWER_CONTROL_IDS,
        ev_charger_power_control_supported,
    )

    if control_id in EV_CHARGER_POWER_CONTROL_IDS:
        return ev_charger_power_control_supported(control_id, data, mdev)
    if control_id == "ev_charger_random_delay_switch":
        features = data.get("device_code_features") or {}
        if features.get("delay_start") is False:
            return False
    if mdev is not None:
        spec = _EV_CONTROL_SPECS.get(control_id)
        if spec:
            return spec[0] in (mdev.controls or {})
        if control_id in _TIME_CONTROLS or control_id == _WEEKEND_MODE_CONTROL:
            return SolixMqttCommands.ev_charger_schedule_times in (mdev.controls or {})
    return control_id in EV_CHARGER_SCHEDULE_CONTROL_IDS


def ev_charger_control_writable(
    control_id: str, data: dict, config: dict | None, mdev: Any | None = None
) -> bool:
    if not ev_charger_mqtt_available(data, config):
        return False
    return ev_charger_control_supported(control_id, data, mdev)


def writable_ev_charger_schedule_controls(
    data: dict, config: dict | None, mdev: Any | None = None
) -> list[str]:
    return [
        cid
        for cid in EV_CHARGER_SCHEDULE_CONTROL_IDS
        if ev_charger_control_writable(cid, data, config, mdev)
    ]


from ev_charger_power import EV_CHARGER_POWER_CONTROL_IDS  # noqa: E402

EV_CHARGER_MQTT_CONTROL_IDS: list[str] = [
    *EV_CHARGER_SCHEDULE_CONTROL_IDS,
    *EV_CHARGER_POWER_CONTROL_IDS,
]
