"""Daily energy statistics (HA sensor.py energy_details.today / last_period)."""

from __future__ import annotations

from typing import Any

from entity_groups import GROUP_ENERGY_STATISTICS

SOLARBANK = "solarbank"
SYSTEM = "system"
SITE = "site"
COMBINER = "combiner_box"
SMARTMETER = "smartmeter"

_SITE_TYPES = [SYSTEM, SITE, SOLARBANK, COMBINER]

ENERGY_STATISTICS_ENTITIES: list[dict[str, Any]] = [
    {
        "id": "energy_statistics_date",
        "keys": ["date"],
        "role": "value.date",
        "types": _SITE_TYPES,
        "period": "today",
    },
    {
        "id": "daily_solar_production",
        "keys": ["solar_production"],
        "unit": "kWh",
        "types": _SITE_TYPES,
    },
    {
        "id": "daily_charge_energy",
        "keys": ["battery_charge", "solarbank_charge"],
        "unit": "kWh",
        "types": _SITE_TYPES,
    },
    {
        "id": "daily_discharge_energy",
        "keys": ["battery_discharge", "solarbank_discharge"],
        "unit": "kWh",
        "types": _SITE_TYPES,
    },
    {
        "id": "daily_home_usage",
        "keys": ["home_usage"],
        "unit": "kWh",
        "types": _SITE_TYPES,
    },
    {
        "id": "daily_solar_to_home",
        "keys": ["solar_to_home"],
        "unit": "kWh",
        "types": _SITE_TYPES,
    },
    {
        "id": "daily_solar_to_battery",
        "keys": ["solar_to_battery"],
        "unit": "kWh",
        "types": _SITE_TYPES,
    },
    {
        "id": "daily_battery_to_home",
        "keys": ["battery_to_home"],
        "unit": "kWh",
        "types": _SITE_TYPES,
    },
    {
        "id": "daily_grid_to_home",
        "keys": ["grid_to_home"],
        "unit": "kWh",
        "types": _SITE_TYPES,
    },
    {
        "id": "daily_grid_to_battery",
        "keys": ["grid_to_battery"],
        "unit": "kWh",
        "types": _SITE_TYPES,
    },
    {
        "id": "daily_3rd_party_pv_to_bat",
        "keys": ["3rd_party_pv_to_bat"],
        "unit": "kWh",
        "types": _SITE_TYPES,
    },
    {
        "id": "daily_ev_charge",
        "keys": ["ev_charge"],
        "unit": "kWh",
        "types": _SITE_TYPES,
    },
    {
        "id": "daily_grid_import",
        "keys": ["grid_import"],
        "unit": "kWh",
        "types": [SMARTMETER, SYSTEM, SITE],
        "smartmeter_only": True,
    },
    {
        "id": "daily_grid_export",
        "keys": ["solar_to_grid", "grid_export"],
        "unit": "kWh",
        "types": [SMARTMETER, SYSTEM, SITE],
        "smartmeter_only": True,
    },
    {
        "id": "yesterday_solar_production",
        "keys": ["solar_production"],
        "unit": "kWh",
        "types": _SITE_TYPES,
        "period": "last_period",
    },
    {
        "id": "yesterday_charge_energy",
        "keys": ["battery_charge", "solarbank_charge"],
        "unit": "kWh",
        "types": _SITE_TYPES,
        "period": "last_period",
    },
    {
        "id": "yesterday_discharge_energy",
        "keys": ["battery_discharge", "solarbank_discharge"],
        "unit": "kWh",
        "types": _SITE_TYPES,
        "period": "last_period",
    },
    {
        "id": "yesterday_home_usage",
        "keys": ["home_usage"],
        "unit": "kWh",
        "types": _SITE_TYPES,
        "period": "last_period",
    },
]

for _spec in ENERGY_STATISTICS_ENTITIES:
    _spec.setdefault("groups", [GROUP_ENERGY_STATISTICS])

STATISTICS_LABELS_DE: dict[str, str] = {
    "energy_statistics_date": "Statistik-Datum",
    "daily_solar_production": "Solarertrag (heute)",
    "daily_charge_energy": "Batterieladung (heute)",
    "daily_discharge_energy": "Batterieentladung (heute)",
    "daily_home_usage": "Hausverbrauch (heute)",
    "daily_solar_to_home": "Solar → Haus (heute)",
    "daily_solar_to_battery": "Solar → Batterie (heute)",
    "daily_battery_to_home": "Batterie → Haus (heute)",
    "daily_grid_to_home": "Netz → Haus (heute)",
    "daily_grid_to_battery": "Netz → Batterie (heute)",
    "daily_3rd_party_pv_to_bat": "3rd-Party PV → Batterie (heute)",
    "daily_ev_charge": "EV-Ladung (heute)",
    "daily_grid_import": "Netzbezug (heute)",
    "daily_grid_export": "Netzeinspeisung (heute)",
    "yesterday_solar_production": "Solarertrag (gestern)",
    "yesterday_charge_energy": "Batterieladung (gestern)",
    "yesterday_discharge_energy": "Batterieentladung (gestern)",
    "yesterday_home_usage": "Hausverbrauch (gestern)",
}


def parse_energy_value(value: Any) -> float | str | None:
    if value is None or value == "":
        return None
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return str(value)


def pick_energy_value(
    data: dict, spec: dict[str, Any], period: str | None = None
) -> Any:
    block_key = period or spec.get("period") or "today"
    block = (data.get("energy_details") or {}).get(block_key) or {}
    if not isinstance(block, dict):
        return None
    for key in spec.get("keys") or []:
        if (val := block.get(key)) is not None and val != "":
            if key == "date":
                return str(val)
            return parse_energy_value(val)
    return None
