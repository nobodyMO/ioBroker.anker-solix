"""Lifetime site totals from Anker scene/energy API (statistics array types 1/2/3)."""

from __future__ import annotations

from typing import Any

from entity_groups import GROUP_ENERGY_STATISTICS, GROUP_SYSTEM_OVERVIEW

SYSTEM = "system"
SITE = "site"

# Anker API: type 1=energy (kWh), 2=CO₂ (kg), 3=money saved (account currency)
LIFETIME_STATISTICS_ENTITIES: list[dict[str, Any]] = [
    {
        "id": "total_energy",
        "stat_type": "1",
        "unit": "kWh",
        "types": [SYSTEM, SITE],
        "groups": [GROUP_SYSTEM_OVERVIEW, GROUP_ENERGY_STATISTICS],
    },
    {
        "id": "total_co2_savings",
        "stat_type": "2",
        "unit": "kg",
        "types": [SYSTEM, SITE],
        "groups": [GROUP_SYSTEM_OVERVIEW, GROUP_ENERGY_STATISTICS],
    },
    {
        "id": "total_money_savings",
        "stat_type": "3",
        "unit": "",
        "types": [SYSTEM, SITE],
        "groups": [GROUP_SYSTEM_OVERVIEW, GROUP_ENERGY_STATISTICS],
    },
]


def normalize_statistics_list(data: dict) -> list[dict]:
    """Return statistics rows from site/scene cache (list from scene_info API)."""
    stats = data.get("statistics")
    if isinstance(stats, list):
        return [item for item in stats if isinstance(item, dict)]
    if isinstance(stats, dict):
        rows: list[dict] = []
        for key in ("1", "2", "3", "energy", "co2", "money"):
            item = stats.get(key)
            if isinstance(item, dict):
                rows.append(item)
        if rows:
            return rows
        return [item for item in stats.values() if isinstance(item, dict)]
    return []


def pick_scene_statistics_total(data: dict, stat_type: str) -> float | None:
    """Read lifetime total from site statistics[] (HA: filter by type)."""
    for item in normalize_statistics_list(data):
        if not isinstance(item, dict):
            continue
        if str(item.get("type")) != str(stat_type):
            continue
        total = item.get("total")
        if total is None or total == "":
            return None
        try:
            return round(float(total), 3)
        except (TypeError, ValueError):
            return None
    return None


def extract_lifetime_statistics_entities(
    data: dict, dev_type: str, config: dict | None = None
) -> dict[str, Any]:
    from entity_groups import enabled_entity_groups, entity_spec_enabled  # noqa: PLC0415

    enabled = enabled_entity_groups(config or {})
    entities: dict[str, Any] = {}
    for spec in LIFETIME_STATISTICS_ENTITIES:
        if not entity_spec_enabled(spec, enabled):
            continue
        if dev_type and dev_type not in spec.get("types", []):
            continue
        val = pick_scene_statistics_total(data, str(spec["stat_type"]))
        if val is not None:
            entities[spec["id"]] = val
    return entities
