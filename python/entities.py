"""HA-aligned entity definitions for ioBroker (see ha-anker-solix sensor/switch/number)."""

from __future__ import annotations

from typing import Any

SOLARBANK = "solarbank"
SYSTEM = "system"
SITE = "site"
COMBINER = "combiner_box"  # includes Power Dock (same device type in API)
SMARTMETER = "smartmeter"
SMARTPLUG = "smartplug"

SENSOR_ENTITIES: list[dict[str, Any]] = [
    {
        "id": "input_power",
        "keys": ["input_power", "photovoltaic_power"],
        "unit": "W",
        "role": "value.power",
        "types": [SOLARBANK, COMBINER, SYSTEM],
    },
    {
        "id": "total_pv_power",
        "keys": ["total_photovoltaic_power"],
        "unit": "W",
        "role": "value.power",
        "types": [SYSTEM, SITE, COMBINER],
        "nested": True,
    },
    {
        "id": "dc_output_power",
        "keys": ["output_power", "dc_output_power"],
        "unit": "W",
        "role": "value.power",
        "types": [SOLARBANK, COMBINER],
    },
    {
        "id": "output_power_total",
        "keys": ["output_power_total", "parallel_home_load"],
        "unit": "W",
        "role": "value.power",
        "types": [SOLARBANK, SYSTEM, SITE, COMBINER],
    },
    {
        "id": "preset_system_output_power",
        "keys": ["preset_system_output_power", "legal_power_limit"],
        "unit": "W",
        "role": "value.power",
        "types": [SOLARBANK, SYSTEM, COMBINER],
    },
    {
        "id": "battery_power",
        "keys": ["battery_power", "bat_power"],
        "unit": "W",
        "role": "value.power",
        "types": [SOLARBANK, SYSTEM, COMBINER],
    },
    {
        "id": "grid_power",
        "keys": ["grid_power", "grid_import_power"],
        "unit": "W",
        "role": "value.power",
        "types": [SOLARBANK, SYSTEM, SITE],
    },
    {
        "id": "home_power",
        "keys": ["home_load_power", "home_power", "home_usage"],
        "unit": "W",
        "role": "value.power",
        "types": [SOLARBANK, SYSTEM, SITE],
    },
    {
        "id": "state_of_charge",
        "keys": ["battery_soc", "total_soc"],
        "unit": "%",
        "role": "value.battery",
        "types": [SOLARBANK, SYSTEM, COMBINER],
    },
    {
        "id": "set_output_power",
        "keys": ["set_output_power", "set_load_power"],
        "unit": "W",
        "role": "value.power",
        "types": [SOLARBANK, COMBINER],
    },
    {
        "id": "pv_input_limit",
        "keys": ["pv_power_limit", "pv_limit"],
        "unit": "W",
        "role": "value.power",
        "types": [SOLARBANK],
    },
    {
        "id": "ac_charge_limit",
        "keys": ["ac_input_limit", "ac_power_limit"],
        "unit": "W",
        "role": "value.power",
        "types": [SOLARBANK],
    },
    {
        "id": "cloud_state",
        "keys": ["cloud_state", "cloud_status"],
        "role": "indicator",
        "types": [SOLARBANK, SYSTEM, SITE, COMBINER],
    },
    {
        "id": "wifi_state",
        "keys": ["wifi_state", "wifi_online"],
        "role": "indicator",
        "types": [SOLARBANK, SYSTEM, SITE, COMBINER, SMARTMETER],
    },
    # Smart meter (HA)
    {
        "id": "grid_to_home_power",
        "keys": ["grid_to_home_power"],
        "unit": "W",
        "role": "value.power",
        "types": [SMARTMETER, SYSTEM, SITE],
    },
    {
        "id": "grid_status_desc",
        "keys": ["grid_status_desc", "grid_status"],
        "role": "text",
        "types": [SMARTMETER, SYSTEM],
    },
    {
        "id": "grid_import_energy",
        "keys": ["grid_import_energy", "daily_grid_import"],
        "unit": "kWh",
        "role": "value.energy",
        "types": [SMARTMETER, SYSTEM, SITE],
    },
    {
        "id": "grid_export_energy",
        "keys": ["grid_export_energy", "daily_grid_export"],
        "unit": "kWh",
        "role": "value.energy",
        "types": [SMARTMETER, SYSTEM, SITE],
    },
    {
        "id": "daily_grid_import",
        "keys": ["grid_import", "daily_grid_import"],
        "unit": "kWh",
        "role": "value.energy",
        "types": [SMARTMETER, SYSTEM],
    },
    {
        "id": "daily_grid_export",
        "keys": ["grid_export", "daily_grid_export"],
        "unit": "kWh",
        "role": "value.energy",
        "types": [SMARTMETER, SYSTEM],
    },
    {
        "id": "phase",
        "keys": ["phase"],
        "role": "text",
        "types": [SMARTMETER],
    },
    {
        "id": "smartmeter_list",
        "keys": ["smartmeter_list"],
        "role": "value",
        "types": [SYSTEM, SITE],
    },
]

CONTROL_ENTITIES: list[dict[str, Any]] = [
    {
        "id": "allow_grid_export",
        "keys": ["allow_grid_export", "switch_0w", "grid_export_disabled"],
        "role": "switch",
        "types": [SOLARBANK, COMBINER, SYSTEM],
        "control": "allow_grid_export",
    },
    {
        "id": "preset_allow_export",
        "keys": ["preset_allow_export"],
        "role": "switch",
        "types": [SOLARBANK],
        "control": "preset_allow_export",
    },
    {
        "id": "set_output_power",
        "keys": ["set_output_power", "set_load_power"],
        "role": "level.power",
        "types": [SOLARBANK, COMBINER],
        "control": "set_output_power",
        "min": 0,
        "max": 1200,
    },
    {
        "id": "ac_output_limit",
        "keys": [
            "preset_system_output_power",
            "parallel_home_load",
            "legal_power_limit",
            "max_load",
        ],
        "role": "level.power",
        "types": [SOLARBANK, COMBINER, SYSTEM],
        "control": "ac_output_limit",
        "min": 0,
        "max": 800,
    },
    {
        "id": "min_soc",
        "keys": ["min_soc", "soc_reserve", "power_cutoff"],
        "role": "level.battery",
        "types": [SOLARBANK, COMBINER, SYSTEM],
        "control": "min_soc",
        "min": 0,
        "max": 100,
    },
    {
        "id": "pv_input_limit",
        "keys": ["pv_power_limit", "pv_limit"],
        "role": "level.power",
        "types": [SOLARBANK],
        "control": "pv_input_limit",
        "min": 0,
        "max": 4000,
    },
    {
        "id": "ac_charge_limit",
        "keys": ["ac_input_limit", "ac_power_limit"],
        "role": "level.power",
        "types": [SOLARBANK],
        "control": "ac_charge_limit",
        "min": 0,
        "max": 4000,
    },
    {
        "id": "grid_export_limit",
        "keys": ["grid_export_limit", "feed-in_power_limit"],
        "role": "level.power",
        "types": [SOLARBANK, COMBINER, SYSTEM],
        "control": "grid_export_limit",
        "min": 100,
        "max": 100000,
    },
]

_NESTED_KEYS = ("solarbank_info", "solarbank_pps_info", "average_power")


def _nested_get(data: dict, key: str, nested: bool = False) -> Any:
    if key in data:
        return data.get(key)
    avg = data.get("average_power")
    if isinstance(avg, dict) and key in avg:
        return avg.get(key)
    if nested:
        for nested_key in _NESTED_KEYS:
            sub = data.get(nested_key)
            if isinstance(sub, dict) and key in sub:
                return sub.get(key)
    schedule = data.get("schedule")
    if isinstance(schedule, dict) and key in schedule:
        return schedule.get(key)
    return None


def pick_value(data: dict, keys: list[str], nested: bool = False) -> Any:
    for key in keys:
        val = _nested_get(data, key, nested=nested)
        if val is not None and val != "":
            if key in ("set_output_power", "preset_system_output_power") and isinstance(
                val, str
            ):
                cleaned = val.replace("W", "").strip()
                return int(cleaned) if cleaned.isdigit() else val
            if key in ("allow_grid_export", "switch_0w", "grid_export_disabled"):
                if key == "switch_0w":
                    return not bool(int(val) if str(val).isdigit() else val)
                if key == "grid_export_disabled":
                    return not bool(val)
                return bool(val) if not isinstance(val, str) else val.lower() in (
                    "1",
                    "true",
                    "on",
                    "yes",
                )
            return val
    return None


def should_include_device(
    ctx_id: str,
    data: dict,
    info: dict[str, str],
    config: dict,
) -> bool:
    if config.get("enableAllDevices", True):
        return True
    selected = set(config.get("selectedDeviceIds") or [])
    site_id = config.get("selectedSiteId") or ""
    if site_id and info.get("site_id") and info.get("site_id") != site_id:
        if ctx_id != site_id:
            return False
    if not selected:
        return True
    return ctx_id in selected or info.get("site_id") in selected


def controls_for_type(dev_type: str) -> list[str]:
    if not dev_type:
        return []
    return [
        spec["id"]
        for spec in CONTROL_ENTITIES
        if dev_type in spec.get("types", [])
    ]


def extract_entities(data: dict) -> dict[str, Any]:
    dev_type = str(data.get("type") or data.get("device_type") or "").lower()
    if not dev_type:
        if data.get("site_id") and not data.get("device_sn"):
            dev_type = SITE
        elif data.get("solarbank_list") or data.get("site_name"):
            dev_type = SYSTEM
    entities: dict[str, Any] = {}
    for spec in SENSOR_ENTITIES:
        if dev_type and dev_type not in spec.get("types", []):
            continue
        val = pick_value(data, spec["keys"], nested=bool(spec.get("nested")))
        if val is not None:
            entities[spec["id"]] = val
    for spec in CONTROL_ENTITIES:
        if dev_type and dev_type not in spec.get("types", []):
            continue
        val = pick_value(data, spec["keys"])
        if val is not None:
            entities[spec["id"]] = val
    return entities
