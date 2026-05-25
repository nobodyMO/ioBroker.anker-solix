"""EV charger current, solar & phase controls (HA-aligned, MQTT A5191 step 3)."""

from __future__ import annotations

from typing import Any

from solixapi.mqttcmdmap import SolixMqttCommands

# ioBroker list labels (DE)
SOLAR_EVCHARGE_MODE_STATES_DE: dict[str, str] = {
    "solar_grid": "Solar & Netz",
    "solar_only": "Nur Solar",
}

PHASE_OPERATING_MODE_STATES_DE: dict[str, str] = {
    "automatic": "Automatisch",
    "one_phase": "1-phasig",
}

_DEFAULT_MIN_A = 6
_DEFAULT_MAX_A = 32

# control_id -> (mqtt_command, parameter_name, kind)
# kind: std_onoff, solar_mode, phase_mode, current_a
_EV_POWER_SPECS: dict[str, tuple[str, str, str]] = {
    "ev_charger_max_current": (
        SolixMqttCommands.ev_max_charge_current,
        "set_max_evcharge_current",
        "current_a",
    ),
    "ev_charger_solar_switch": (
        SolixMqttCommands.ev_solar_charging,
        "set_solar_evcharge_switch",
        "std_onoff",
    ),
    "ev_charger_solar_mode": (
        SolixMqttCommands.ev_solar_charging,
        "set_solar_evcharge_mode",
        "solar_mode",
    ),
    "ev_charger_solar_min_current": (
        SolixMqttCommands.ev_solar_charging,
        "set_solar_evcharge_min_current",
        "current_a",
    ),
    "ev_charger_phase_mode": (
        SolixMqttCommands.ev_solar_charging,
        "set_phase_operating_mode?",
        "phase_mode",
    ),
    "ev_charger_auto_phase_switch": (
        SolixMqttCommands.ev_solar_charging,
        "set_auto_phase_switch",
        "std_onoff",
    ),
}

EV_CHARGER_POWER_CONTROL_IDS: list[str] = list(_EV_POWER_SPECS.keys())

# All parameters of CMD_EV_SOLAR_CHARGING (must be sent together).
_SOLAR_CHARGING_PARM_SPECS: list[tuple[str, str, str]] = [
    ("set_solar_evcharge_switch", "solar_evcharge_switch", "std_onoff"),
    ("set_solar_evcharge_mode", "solar_evcharge_mode", "solar_mode"),
    ("set_solar_evcharge_min_current", "solar_evcharge_min_current", "current_a"),
    ("set_phase_operating_mode?", "phase_operating_mode", "phase_mode"),
    ("set_solar_evcharge_monitoring_mode", "solar_evcharge_monitoring_mode", "std_onoff"),
    ("set_auto_phase_switch", "auto_phase_switch", "std_onoff"),
]


def _mqtt_val(data: dict, key: str) -> Any:
    mqtt = data.get("mqtt_data")
    if isinstance(mqtt, dict) and key in mqtt and mqtt[key] not in (None, ""):
        return mqtt[key]
    return data.get(key)


def _std_switch_on(val: Any) -> bool:
    if val is None or val == "":
        return False
    return str(val).strip().lower() in ("1", "true", "on", "yes")


def _mqtt_switch_int(val: Any, *, default: int = 0) -> int:
    if val is None or val == "":
        return default
    if isinstance(val, bool):
        return 1 if val else 0
    try:
        return _parse_std_switch_set(val)
    except ValueError:
        return 1 if _std_switch_on(val) else 0


def _current_from_data(data: dict, key: str) -> int:
    amps = _display_amps(_mqtt_val(data, key))
    if amps is None:
        min_a, _ = _current_limits(data)
        return min_a
    return int(round(amps))


def _merge_mqtt_cache(data: dict, mdev: Any | None = None) -> dict:
    merged = dict(data)
    mqtt = getattr(mdev, "mqttdata", None) if mdev is not None else None
    if isinstance(mqtt, dict):
        for key, val in mqtt.items():
            if val is not None and val != "":
                merged[key] = val
    nested = merged.get("mqtt_data")
    if isinstance(nested, dict):
        for key, val in nested.items():
            if val is not None and val != "":
                merged[key] = val
    return merged


def _encode_solar_parm_value(state_key: str, kind: str, data: dict) -> Any:
    if kind == "std_onoff":
        return _mqtt_switch_int(_mqtt_val(data, state_key))
    if kind == "solar_mode":
        name = _solar_mode_name(_mqtt_val(data, state_key)) or "solar_grid"
        return _parse_solar_mode_set(name)
    if kind == "phase_mode":
        name = _phase_mode_name(_mqtt_val(data, state_key)) or "automatic"
        return _parse_phase_mode_set(name)
    if kind == "current_a":
        return _current_from_data(data, state_key)
    raise ValueError(f"Unknown solar charging parameter kind '{kind}'")


def build_ev_solar_charging_parm_map(
    target_parm: str,
    target_value: Any,
    data: dict,
    mdev: Any | None = None,
) -> dict[str, Any]:
    """Build full parm_map for ev_solar_charging (all fields required by encoder)."""
    cache = _merge_mqtt_cache(data, mdev)
    parm_map: dict[str, Any] = {}
    for parm, state_key, kind in _SOLAR_CHARGING_PARM_SPECS:
        if parm == target_parm:
            parm_map[parm] = target_value
        else:
            parm_map[parm] = _encode_solar_parm_value(state_key, kind, cache)
    monitor = str(_mqtt_val(cache, "solar_evcharge_monitor_device") or "").strip()
    parm_map["set_solar_evcharge_monitor_device"] = monitor
    return parm_map


def is_ev_solar_charging_command(cmd: str) -> bool:
    return cmd == SolixMqttCommands.ev_solar_charging


def _parse_std_switch_set(value: Any) -> int:
    if isinstance(value, bool):
        return 1 if value else 0
    s = str(value or "").strip().lower()
    if s in ("1", "true", "on", "yes"):
        return 1
    if s in ("0", "false", "off", "no", "2"):
        return 0
    raise ValueError(f"Invalid switch value '{value}' (use on/off or true/false)")


def _current_limits(data: dict | None) -> tuple[int, int]:
    data = data or {}
    min_raw = _mqtt_val(data, "min_current_limit")
    max_raw = _mqtt_val(data, "max_current_limit")
    try:
        min_a = int(float(min_raw)) if min_raw not in (None, "") else _DEFAULT_MIN_A
    except (TypeError, ValueError):
        min_a = _DEFAULT_MIN_A
    try:
        max_a = int(float(max_raw)) if max_raw not in (None, "") else _DEFAULT_MAX_A
    except (TypeError, ValueError):
        max_a = _DEFAULT_MAX_A
    if min_a > max_a:
        min_a, max_a = max_a, min_a
    return min_a, max_a


def _display_amps(val: Any) -> float | None:
    if val is None or val == "":
        return None
    try:
        amps = float(val)
    except (TypeError, ValueError):
        return None
    if amps > 40:
        amps *= 0.1
    return round(amps, 1) if amps % 1 else float(int(amps))


def _solar_mode_name(val: Any) -> str | None:
    if val is None or val == "":
        return None
    s = str(val).strip().lower()
    if s in ("0", "solar_grid", "solar & grid"):
        return "solar_grid"
    if s in ("1", "solar_only", "solar only"):
        return "solar_only"
    return s if s in SOLAR_EVCHARGE_MODE_STATES_DE else None


def _phase_mode_name(val: Any) -> str | None:
    if val is None or val == "":
        return None
    s = str(val).strip().lower()
    if s in ("0", "automatic", "auto"):
        return "automatic"
    if s in ("1", "one_phase", "one", "one phase"):
        return "one_phase"
    return s if s in PHASE_OPERATING_MODE_STATES_DE else None


def extract_ev_charger_power_value(control_id: str, data: dict) -> Any:
    """Map device/MQTT cache to ioBroker state value."""
    if control_id == "ev_charger_max_current":
        amps = _display_amps(_mqtt_val(data, "max_evcharge_current"))
        return amps
    if control_id == "ev_charger_solar_switch":
        return _std_switch_on(_mqtt_val(data, "solar_evcharge_switch"))
    if control_id == "ev_charger_solar_mode":
        return _solar_mode_name(_mqtt_val(data, "solar_evcharge_mode"))
    if control_id == "ev_charger_solar_min_current":
        amps = _display_amps(_mqtt_val(data, "solar_evcharge_min_current"))
        return amps
    if control_id == "ev_charger_phase_mode":
        return _phase_mode_name(_mqtt_val(data, "phase_operating_mode"))
    if control_id == "ev_charger_auto_phase_switch":
        return _std_switch_on(_mqtt_val(data, "auto_phase_switch"))
    return None


def _parse_current_set(value: Any, data: dict | None) -> int:
    try:
        amps = int(round(float(value)))
    except (TypeError, ValueError):
        raise ValueError(f"Invalid current '{value}' (use amperes, e.g. 6-32)") from None
    min_a, max_a = _current_limits(data)
    if amps < min_a or amps > max_a:
        raise ValueError(f"Invalid current '{value}' (allowed: {min_a}-{max_a} A)")
    return amps


def _parse_solar_mode_set(value: Any) -> int:
    name = _solar_mode_name(value) or str(value or "").strip().lower()
    if name == "solar_grid":
        return 0
    if name == "solar_only":
        return 1
    raise ValueError(f"Invalid solar mode '{value}' (use: solar_grid, solar_only)")


def _parse_phase_mode_set(value: Any) -> int:
    name = _phase_mode_name(value) or str(value or "").strip().lower()
    if name == "automatic":
        return 0
    if name == "one_phase":
        return 1
    raise ValueError(f"Invalid phase mode '{value}' (use: automatic, one_phase)")


def parse_ev_charger_power_set(
    control_id: str, value: Any, data: dict | None = None
) -> tuple[str, str, Any]:
    """Return (mqtt_command, parameter_name, mqtt_value) for _mqtt_command."""
    if control_id not in _EV_POWER_SPECS:
        raise ValueError(f"Unknown EV charger power control '{control_id}'")
    cmd, parm, kind = _EV_POWER_SPECS[control_id]
    if kind == "std_onoff":
        return cmd, parm, _parse_std_switch_set(value)
    if kind == "solar_mode":
        return cmd, parm, _parse_solar_mode_set(value)
    if kind == "phase_mode":
        return cmd, parm, _parse_phase_mode_set(value)
    if kind == "current_a":
        return cmd, parm, _parse_current_set(value, data)
    raise ValueError(f"Unsupported power control kind '{kind}'")


def ev_charger_power_control_supported(
    control_id: str, data: dict, mdev: Any | None = None
) -> bool:
    if control_id == "ev_charger_auto_phase_switch":
        features = data.get("device_code_features") or {}
        if features.get("phase") == "single":
            return False
    spec = _EV_POWER_SPECS.get(control_id)
    if not spec:
        return False
    if mdev is not None:
        cmd = spec[0]
        parm = spec[1]
        ctrl = (mdev.controls or {}).get(cmd) or {}
        params = ctrl.get("parameters") or {}
        if parm not in params:
            return cmd in (mdev.controls or {})
        param = params.get(parm) or {}
        if control_id == "ev_charger_auto_phase_switch":
            options = param.get("value_options") or param.get("VALUE_OPTIONS") or {}
            if not options and param.get("is_switch") is False:
                return False
        return True
    return control_id in EV_CHARGER_POWER_CONTROL_IDS


def ev_charger_power_control_writable(
    control_id: str, data: dict, config: dict | None, mdev: Any | None = None
) -> bool:
    from ev_charger_schedule import ev_charger_mqtt_available  # noqa: PLC0415

    if not ev_charger_mqtt_available(data, config):
        return False
    return ev_charger_power_control_supported(control_id, data, mdev)
