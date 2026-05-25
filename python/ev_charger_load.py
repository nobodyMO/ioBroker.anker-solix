"""EV charger load balancing & main breaker (HA-aligned, MQTT A5191 step 4)."""

from __future__ import annotations

from typing import Any

from ev_charger_power import _merge_mqtt_cache, _mqtt_switch_int, _parse_std_switch_set
from solixapi.mqttcmdmap import SolixMqttCommands

_DEFAULT_MAIN_BREAKER_A = 63
_MAIN_BREAKER_MIN = 10
_MAIN_BREAKER_MAX = 500

# control_id -> (mqtt_command, parameter_name, kind)
# kind: std_onoff, main_breaker_a, monitor_sn
_EV_LOAD_SPECS: dict[str, tuple[str, str, str]] = {
    "ev_charger_load_balance_switch": (
        SolixMqttCommands.ev_load_balancing,
        "set_load_balance_switch",
        "std_onoff",
    ),
    "ev_charger_load_balance_monitor_device": (
        SolixMqttCommands.ev_load_balancing,
        "set_load_balance_monitor_device",
        "monitor_sn",
    ),
    "ev_charger_main_breaker_limit": (
        SolixMqttCommands.main_breaker_limit,
        "set_main_breaker_limit",
        "main_breaker_a",
    ),
}

# All parameters of CMD_EV_LOAD_BALANCING (must be sent together).
_LOAD_BALANCING_PARM_SPECS: list[tuple[str, str, str]] = [
    ("set_load_balance_switch", "load_balance_switch", "std_onoff"),
    ("set_load_balance_setting_d5", "load_balance_setting_d5", "std_onoff"),
    ("set_load_balance_setting_d6", "load_balance_setting_d6", "std_onoff"),
]

EV_CHARGER_LOAD_CONTROL_IDS: list[str] = list(_EV_LOAD_SPECS.keys())


def _mqtt_val(data: dict, key: str) -> Any:
    mqtt = data.get("mqtt_data")
    if isinstance(mqtt, dict) and key in mqtt and mqtt[key] not in (None, ""):
        return mqtt[key]
    return data.get(key)


def _encode_load_parm_value(state_key: str, kind: str, data: dict) -> Any:
    if kind == "std_onoff":
        return _mqtt_switch_int(_mqtt_val(data, state_key))
    raise ValueError(f"Unknown load balancing parameter kind '{kind}'")


def build_ev_load_balancing_parm_map(
    target_parm: str,
    target_value: Any,
    data: dict,
    mdev: Any | None = None,
) -> dict[str, Any]:
    """Build full parm_map for ev_load_balancing (all fields required by encoder)."""
    cache = _merge_mqtt_cache(data, mdev)
    parm_map: dict[str, Any] = {}
    for parm, state_key, kind in _LOAD_BALANCING_PARM_SPECS:
        if parm == target_parm:
            parm_map[parm] = target_value
        else:
            parm_map[parm] = _encode_load_parm_value(state_key, kind, cache)
    monitor = str(_mqtt_val(cache, "load_balance_monitor_device") or "").strip()
    parm_map["set_load_balance_monitor_device"] = monitor
    return parm_map


def is_ev_load_balancing_command(cmd: str) -> bool:
    return cmd == SolixMqttCommands.ev_load_balancing


def _parse_main_breaker_set(value: Any) -> int:
    try:
        amps = int(round(float(value)))
    except (TypeError, ValueError):
        raise ValueError(
            f"Invalid main breaker limit '{value}' (use {_MAIN_BREAKER_MIN}-{_MAIN_BREAKER_MAX} A)"
        ) from None
    if amps < _MAIN_BREAKER_MIN or amps > _MAIN_BREAKER_MAX:
        raise ValueError(
            f"Invalid main breaker limit '{value}' (allowed: {_MAIN_BREAKER_MIN}-{_MAIN_BREAKER_MAX} A)"
        )
    return amps


def extract_ev_charger_load_value(control_id: str, data: dict) -> Any:
    if control_id == "ev_charger_load_balance_switch":
        return _mqtt_switch_int(_mqtt_val(data, "load_balance_switch")) == 1
    if control_id == "ev_charger_main_breaker_limit":
        raw = _mqtt_val(data, "main_breaker_limit")
        if raw in (None, ""):
            return None
        try:
            return int(float(raw))
        except (TypeError, ValueError):
            return None
    if control_id == "ev_charger_load_balance_monitor_device":
        sn = str(_mqtt_val(data, "load_balance_monitor_device") or "").strip()
        return sn or None
    return None


def parse_ev_charger_load_set(
    control_id: str, value: Any, data: dict | None = None
) -> tuple[str, str, Any]:
    if control_id not in _EV_LOAD_SPECS:
        raise ValueError(f"Unknown EV charger load control '{control_id}'")
    cmd, parm, kind = _EV_LOAD_SPECS[control_id]
    if kind == "std_onoff":
        return cmd, parm, _parse_std_switch_set(value)
    if kind == "main_breaker_a":
        return cmd, parm, _parse_main_breaker_set(value)
    if kind == "monitor_sn":
        sn = str(value or "").strip()
        if not sn:
            raise ValueError("Invalid monitor device SN (non-empty string required)")
        return cmd, parm, sn
    raise ValueError(f"Unsupported load control kind '{kind}'")


def ev_charger_load_control_supported(
    control_id: str, data: dict, mdev: Any | None = None
) -> bool:
    spec = _EV_LOAD_SPECS.get(control_id)
    if not spec:
        return False
    if mdev is not None:
        cmd, parm, _kind = spec
        ctrl = (mdev.controls or {}).get(cmd) or {}
        params = ctrl.get("parameters") or {}
        if parm in params or cmd in (mdev.controls or {}):
            return True
        return cmd in (mdev.controls or {})
    return control_id in EV_CHARGER_LOAD_CONTROL_IDS


def ev_charger_load_control_writable(
    control_id: str, data: dict, config: dict | None, mdev: Any | None = None
) -> bool:
    from ev_charger_schedule import ev_charger_mqtt_available  # noqa: PLC0415

    if not ev_charger_mqtt_available(data, config):
        return False
    return ev_charger_load_control_supported(control_id, data, mdev)
