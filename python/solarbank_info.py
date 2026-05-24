"""System solarbank_info channel (per-SB battery_energy only; power totals via ioBroker sum)."""

from __future__ import annotations

from typing import Any

from entity_groups import GROUP_POWER_FLOWS, GROUP_SYSTEM_OVERVIEW
from entities import SYSTEM, SITE


def _parse_battery_energy(val: Any) -> int | None:
    if val is None or val == "":
        return None
    try:
        return int(float(val))
    except (TypeError, ValueError):
        return None


def extract_solarbank_info(
    data: dict, api: Any | None = None, config: dict | None = None
) -> dict[str, Any] | None:
    """Build solarbank_info payload for system/site poll (battery_energy per SB only)."""
    from entity_groups import enabled_entity_groups  # noqa: PLC0415

    enabled = enabled_entity_groups(config or {})
    if GROUP_SYSTEM_OVERVIEW not in enabled and GROUP_POWER_FLOWS not in enabled:
        return None
    dev_type = str(data.get("type") or "").lower()
    if dev_type not in (SYSTEM, SITE):
        return None
    site_id = str(data.get("site_id") or "")
    sb_info = data.get("solarbank_info")
    if not isinstance(sb_info, dict) and api and site_id:
        site = (api.sites or {}).get(site_id) or {}
        cached = site.get("solarbank_info")
        if isinstance(cached, dict):
            sb_info = cached
    if not isinstance(sb_info, dict):
        return None

    banks: dict[str, dict[str, Any]] = {}
    for item in sb_info.get("solarbank_list") or []:
        if not isinstance(item, dict):
            continue
        sn = str(item.get("device_sn") or "").strip()
        if not sn:
            continue
        energy = _parse_battery_energy(item.get("battery_energy"))
        if energy is None and api:
            dev = (api.devices or {}).get(sn) or {}
            energy = _parse_battery_energy(dev.get("battery_energy"))
            if energy is None:
                cap = dev.get("battery_capacity")
                soc = dev.get("battery_soc") or item.get("battery_power")
                if cap is not None and soc is not None:
                    try:
                        energy = int(int(cap) * int(float(soc)) / 100)
                    except (TypeError, ValueError):
                        energy = None
        entry: dict[str, Any] = {}
        if energy is not None:
            entry["battery_energy"] = energy
        if entry:
            banks[sn] = entry
    if not banks:
        return None
    return {"solarbank_list": banks}
