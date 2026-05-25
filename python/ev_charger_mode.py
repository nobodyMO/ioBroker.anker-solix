"""EV charger operational mode (HA-aligned, MQTT control via ev_charger_mode_select)."""

from __future__ import annotations

from typing import Any

from solixapi.apitypes import SolixEvChargerMode, SolixEvChargerStatus
from solixapi.helpers import get_enum_name

EV_CHARGER = "ev_charger"

# ioBroker list labels (DE)
EV_CHARGER_MODE_LABELS_DE: dict[str, str] = {
    "start_charge": "Laden starten",
    "stop_charge": "Laden stoppen",
    "skip_delay": "Verzögerung überspringen",
    "boost_charge": "Boost",
    "wait_plug": "Warte auf Stecker",
    "wait_start": "Warte auf Start",
}

# Actionable modes only (MQTT values 1–4)
_ACTION_MODES: dict[str, int] = {
    SolixEvChargerMode.start_charge.name: int(SolixEvChargerMode.start_charge.value),
    SolixEvChargerMode.stop_charge.name: int(SolixEvChargerMode.stop_charge.value),
    SolixEvChargerMode.skip_delay.name: int(SolixEvChargerMode.skip_delay.value),
    SolixEvChargerMode.boost_charge.name: int(SolixEvChargerMode.boost_charge.value),
}


def _status_name(data: dict) -> str:
    status = data.get("ev_charger_status")
    if status is None:
        return SolixEvChargerStatus.unknown.name
    return get_enum_name(SolixEvChargerStatus, str(status), SolixEvChargerStatus.unknown.name)


def current_ev_charger_mode(data: dict) -> str | None:
    """Current mode for display (matches SolixMqttDeviceCharger.ev_charger_mode_state)."""
    if data.get("ev_charger_status") is None and not data.get("boost_status"):
        return None
    if bool(data.get("boost_status")):
        return SolixEvChargerMode.boost_charge.name
    state = _status_name(data)
    if state == SolixEvChargerStatus.preparing.name:
        if int(data.get("plug_countdown_seconds") or 0) > 0:
            return SolixEvChargerMode.wait_plug.name
        if int(data.get("start_countdown_seconds") or 0) > 0:
            return SolixEvChargerMode.wait_start.name
        return SolixEvChargerMode.start_charge.name
    if state in (
        SolixEvChargerStatus.charging.name,
        SolixEvChargerStatus.charger_paused.name,
        SolixEvChargerStatus.vehicle_paused.name,
    ):
        return SolixEvChargerMode.start_charge.name
    if state == SolixEvChargerStatus.standby.name:
        return SolixEvChargerMode.stop_charge.name
    return SolixEvChargerMode.stop_charge.name


def ev_charger_mode_options(data: dict) -> list[str]:
    """Allowed next commands (HA SolixMqttDeviceCharger.ev_charger_mode_options)."""
    options: set[str] = set()
    status = _status_name(data)
    current = current_ev_charger_mode(data)
    if current:
        options.add(current)
        if current in (
            SolixEvChargerMode.wait_plug.name,
            SolixEvChargerMode.wait_start.name,
            SolixEvChargerMode.start_charge.name,
        ):
            options.add(SolixEvChargerMode.stop_charge.name)
            if current == SolixEvChargerMode.wait_start.name:
                options.add(SolixEvChargerMode.skip_delay.name)
            elif current == SolixEvChargerMode.start_charge.name:
                options.add(SolixEvChargerMode.boost_charge.name)
        elif current == SolixEvChargerMode.boost_charge.name:
            options.add(SolixEvChargerMode.stop_charge.name)
        elif status == SolixEvChargerStatus.standby.name:
            options.add(SolixEvChargerMode.start_charge.name)
    return sorted(options)


def parse_ev_charger_mode_set(value: Any) -> int:
    """Map ioBroker list value to MQTT command value (1–4)."""
    key = str(value or "").strip().lower()
    if key in _ACTION_MODES:
        return _ACTION_MODES[key]
    raise ValueError(
        f"Invalid ev_charger_mode '{value}' (use: {', '.join(sorted(_ACTION_MODES))})"
    )


def ev_charger_mode_writable(data: dict, config: dict | None) -> bool:
    """True when MQTT mode control is available for this device cache entry."""
    if not (config or {}).get("mqttUsage"):
        return False
    if not (data.get("mqtt_supported") or data.get("mqtt_data")):
        return False
    return bool(ev_charger_mode_options(data))
