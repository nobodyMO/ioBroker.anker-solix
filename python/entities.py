"""HA-aligned entity definitions for ioBroker (see ha-anker-solix sensor/switch/number)."""

from __future__ import annotations

from typing import Any

from entity_groups import (  # noqa: E402
    GROUP_CORE,
    enabled_entity_groups,
    entity_spec_enabled,
)
from extended_entities import (  # noqa: E402
    EXTENDED_CONTROL_ENTITIES,
    EXTENDED_ENERGY_STATISTICS,
    EXTENDED_SENSOR_ENTITIES,
    EXTENDED_STATISTICS_LABELS_DE,
)
from solixapi.apitypes import SolarbankUsageMode  # noqa: E402

_CORE = [GROUP_CORE]

SOLARBANK = "solarbank"
SYSTEM = "system"
SITE = "site"
COMBINER = "combiner_box"  # includes Power Dock (same device type in API)
SMARTMETER = "smartmeter"
SMARTPLUG = "smartplug"

_BASE_SENSOR_ENTITIES: list[dict[str, Any]] = [
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
        "keys": ["ac_input_limit", "ac_power_limit", "preset_ac_input_limit"],
        "unit": "W",
        "role": "value.power",
        "types": [SOLARBANK],
    },
    {
        "id": "all_ac_input_limit",
        "keys": ["all_ac_input_limit", "ac_input_power_unit"],
        "unit": "W",
        "role": "value.power",
        "types": [COMBINER, SYSTEM],
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

for _spec in _BASE_SENSOR_ENTITIES:
    _spec.setdefault("groups", _CORE)

SENSOR_ENTITIES: list[dict[str, Any]] = [
    *_BASE_SENSOR_ENTITIES,
    *EXTENDED_SENSOR_ENTITIES,
]

_BASE_CONTROL_ENTITIES: list[dict[str, Any]] = [
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
            "max_load_total",
            "all_power_limit",
            "preset_system_output_power",
            "parallel_home_load",
            "legal_power_limit",
            "max_load",
            "power_limit",
        ],
        "role": "level.power",
        "types": [SOLARBANK, COMBINER, SYSTEM],
        "control": "ac_output_limit",
        "min": 0,
        "max": 5000,  # multisystem/combiner up to ~4800 W (HA PRESET_MAX_MULTISYSTEM)
        # HA select max_load_total: only when multisystem total limit is exposed
        "require_any_keys": ["all_power_limit", "max_load_total"],
        "require_types": [COMBINER, SYSTEM],
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
        "min": 0,  # 0 = off/disabled in API; writes 100–100000 W validated in bridge
        "max": 100000,
    },
    {
        "id": "preset_usage_mode",
        "keys": ["preset_usage_mode", "mode_type", "usage_mode"],
        "role": "value.mode",
        "types": [SOLARBANK, COMBINER],
        "control": "preset_usage_mode",
        "kind": "list",
    },
    {
        "id": "ac_fast_charge_switch",
        "keys": ["ac_fast_charge_switch", "fast_charge_switch"],
        "role": "switch",
        "types": [SOLARBANK],
        "control": "ac_fast_charge_switch",
    },
]

for _spec in _BASE_CONTROL_ENTITIES:
    _spec.setdefault("groups", _CORE)

CONTROL_ENTITIES: list[dict[str, Any]] = [
    *_BASE_CONTROL_ENTITIES,
    *EXTENDED_CONTROL_ENTITIES,
]

STATISTICS_LABELS_DE_EXTRA: dict[str, str] = EXTENDED_STATISTICS_LABELS_DE

# ioBroker state keys → German labels (HA de.json)
USAGE_MODE_STATES: dict[str, str] = {
    SolarbankUsageMode.manual.name: "Benutzerdefiniert",
    SolarbankUsageMode.smartmeter.name: "Eigenverbrauch",
    SolarbankUsageMode.smartplugs.name: "Smarte Steckdosen",
    SolarbankUsageMode.smart.name: "Smart-Modus",
    SolarbankUsageMode.use_time.name: "Zeit-Nutzung",
    SolarbankUsageMode.time_slot.name: "Dynamischer Tarif",
    SolarbankUsageMode.backup.name: "Notstromladung",
}

_USAGE_MODE_ALIASES: dict[str, str] = {}
for _mode_key, _mode_label in USAGE_MODE_STATES.items():
    _USAGE_MODE_ALIASES[_mode_key] = _mode_key
    _USAGE_MODE_ALIASES[_mode_key.lower()] = _mode_key
    _USAGE_MODE_ALIASES[_mode_label.lower()] = _mode_key


def usage_mode_name(value: Any) -> str | None:
    """Normalize API/MQTT usage mode to SolarbankUsageMode name."""
    if value is None or value == "":
        return None
    if isinstance(value, str):
        key = value.strip().lower().replace(" ", "_")
        if key in _USAGE_MODE_ALIASES:
            return _USAGE_MODE_ALIASES[key]
        if value in SolarbankUsageMode.__members__:
            return value
        return None
    if isinstance(value, int | float):
        try:
            return SolarbankUsageMode(int(value)).name
        except (ValueError, KeyError):
            return None
    return None


def parse_usage_mode_set_value(value: Any) -> str:
    """Accept enum name or German label from ioBroker."""
    name = usage_mode_name(value)
    if not name:
        raise ValueError(f"Unknown usage mode: {value!r}")
    return name

_NESTED_KEYS = ("solarbank_info", "solarbank_pps_info", "average_power")
_POWER_KEYS = frozenset(
    {
        "ac_input_limit",
        "ac_power_limit",
        "all_ac_input_limit",
        "ac_input_power_unit",
        "all_power_limit",
        "max_load_total",
        "preset_ac_input_limit",
    }
)


def _parse_power_value(val: Any) -> Any:
    if isinstance(val, (int, float)):
        return int(val)
    if isinstance(val, str):
        cleaned = val.replace("W", "").replace("w", "").strip()
        if cleaned.isdigit():
            return int(cleaned)
    return val


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
    mqtt = data.get("mqtt_data")
    if isinstance(mqtt, dict):
        for key in keys:
            val = mqtt.get(key)
            if val is not None and val != "":
                if key in ("set_output_power", "preset_system_output_power") and isinstance(
                    val, str
                ):
                    cleaned = val.replace("W", "").strip()
                    return int(cleaned) if cleaned.isdigit() else val
                if key in (
                "allow_grid_export",
                "switch_0w",
                "grid_export_disabled",
                "ac_fast_charge_switch",
                "fast_charge_switch",
            ):
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
                if key in _POWER_KEYS:
                    return _parse_power_value(val)
                return val
    for key in keys:
        val = _nested_get(data, key, nested=nested)
        if val is not None and val != "":
            if key in _POWER_KEYS or key in (
                "set_output_power",
                "preset_system_output_power",
            ):
                parsed = _parse_power_value(val)
                if isinstance(parsed, int):
                    return parsed
            if key in ("set_output_power", "preset_system_output_power") and isinstance(
                val, str
            ):
                cleaned = val.replace("W", "").strip()
                return int(cleaned) if cleaned.isdigit() else val
            if key in (
                "allow_grid_export",
                "switch_0w",
                "grid_export_disabled",
                "ac_fast_charge_switch",
                "fast_charge_switch",
            ):
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


def controls_for_type(dev_type: str, config: dict | None = None) -> list[str]:
    if not dev_type:
        return []
    enabled = enabled_entity_groups(config or {})
    return [
        spec["id"]
        for spec in CONTROL_ENTITIES
        if dev_type in spec.get("types", []) and entity_spec_enabled(spec, enabled)
    ]


def _is_main_usage_mode_device(data: dict, dev_type: str) -> bool:
    """HA: usage mode only on main device (combiner or standalone SB)."""
    station_sn = str(data.get("station_sn") or "")
    device_sn = str(data.get("device_sn") or "")
    if dev_type == COMBINER:
        return True
    if dev_type == SOLARBANK and int(data.get("generation") or 0) >= 2:
        return not station_sn or station_sn == device_sn
    return False


def writable_controls_for_device(
    data: dict, dev_type: str, config: dict | None = None
) -> list[str]:
    """HA-aligned writable controls per device capabilities."""
    enabled = enabled_entity_groups(config or {})
    controls = controls_for_type(dev_type, config)
    # Advanced / PPS controls: read-only until explicit bridge set support
    _read_only_controls = {
        "preset_discharge_priority",
        "preset_backup_option",
        "preset_charge_priority",
        "preset_device_output_power",
        "max_soc",
        "backup_soc",
        "auto_upgrade",
        "ac_output_power_switch",
        "ac_fast_charge_switch_pps",
    }
    controls = [c for c in controls if c not in _read_only_controls or False]
    if dev_type == SOLARBANK and "ac_charge_limit" in controls:
        if not (
            data.get("mqtt_data")
            or data.get("mqtt_supported")
            or pick_value(data, ["ac_input_limit", "ac_power_limit"]) is not None
        ):
            controls = [c for c in controls if c != "ac_charge_limit"]
    if "preset_usage_mode" in controls and not _is_main_usage_mode_device(
        data, dev_type
    ):
        controls = [c for c in controls if c != "preset_usage_mode"]
    if "ac_fast_charge_switch" in controls:
        if dev_type != SOLARBANK or int(data.get("generation") or 0) < 2:
            controls = [c for c in controls if c != "ac_fast_charge_switch"]
    return controls


def extract_statistics_entities(
    data: dict, dev_type: str, config: dict | None = None
) -> dict[str, Any]:
    from energy_entities import ENERGY_STATISTICS_ENTITIES, pick_energy_value  # noqa: PLC0415

    enabled = enabled_entity_groups(config or {})
    entities: dict[str, Any] = {}
    if not (data.get("energy_details") or {}).get("today"):
        return entities
    all_stats = [*ENERGY_STATISTICS_ENTITIES, *EXTENDED_ENERGY_STATISTICS]
    for spec in all_stats:
        if not entity_spec_enabled(spec, enabled):
            continue
        if dev_type and dev_type not in spec.get("types", []):
            continue
        if spec.get("smartmeter_only") and dev_type != SMARTMETER:
            continue
        val = pick_energy_value(data, spec)
        if val is not None:
            entities[spec["id"]] = val
    return entities


def extract_entities(data: dict, config: dict | None = None) -> dict[str, Any]:
    dev_type = str(data.get("type") or data.get("device_type") or "").lower()
    if not dev_type:
        if data.get("site_id") and not data.get("device_sn"):
            dev_type = SITE
        elif data.get("solarbank_list") or data.get("site_name"):
            dev_type = SYSTEM
    enabled = enabled_entity_groups(config or {})
    entities: dict[str, Any] = {}
    for spec in SENSOR_ENTITIES:
        if not entity_spec_enabled(spec, enabled):
            continue
        if dev_type and dev_type not in spec.get("types", []):
            continue
        val = pick_value(data, spec["keys"], nested=bool(spec.get("nested")))
        if val is not None:
            if spec.get("kind") == "boolean":
                entities[spec["id"]] = bool(val) if not isinstance(val, str) else val.lower() in (
                    "1",
                    "true",
                    "on",
                    "yes",
                    "connected",
                )
            else:
                entities[spec["id"]] = val
    for spec in CONTROL_ENTITIES:
        if not entity_spec_enabled(spec, enabled):
            continue
        if dev_type and dev_type not in spec.get("types", []):
            continue
        req_types = spec.get("require_types") or []
        req_keys = spec.get("require_any_keys") or []
        if req_types and dev_type in req_types and req_keys:
            if not any(
                pick_value(data, [key]) is not None for key in req_keys
            ):
                continue
        # HA max_load: per-SB only without station; multisystem uses combiner max_load_total
        if spec["id"] == "ac_output_limit" and dev_type == SOLARBANK:
            if data.get("station_sn") or "all_power_limit" in data:
                continue
        if spec.get("kind") == "list" and spec["id"] == "preset_usage_mode":
            val = usage_mode_name(
                pick_value(data, spec["keys"])
                or (data.get("schedule") or {}).get("mode_type")
            )
        else:
            val = pick_value(data, spec["keys"])
        if val is not None:
            entities[spec["id"]] = val
    entities.update(extract_statistics_entities(data, dev_type, config))
    return entities
