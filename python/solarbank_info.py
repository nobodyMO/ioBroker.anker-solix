"""System solarbank_info channel (AnkerSolix2-compatible paths under system.{siteId})."""

from __future__ import annotations

from typing import Any

from battery_power_pick import sum_bank_charge_discharge
from entity_groups import GROUP_POWER_FLOWS, GROUP_SYSTEM_OVERVIEW
from entities import SYSTEM, SITE, _parse_power_value


def _parse_power_field(val: Any) -> int | None:
    if val is None or val == "":
        return None
    parsed = _parse_power_value(val)
    if isinstance(parsed, int):
        return parsed
    try:
        return int(float(val))
    except (TypeError, ValueError):
        return None


def _parse_battery_energy(val: Any) -> int | None:
    if val is None or val == "":
        return None
    try:
        return int(float(val))
    except (TypeError, ValueError):
        return None


def _resolve_system_power_totals(
    sb_info: dict, api: Any | None, site_id: str = ""
) -> tuple[int, int]:
    """Resolve total charge/discharge W; cloud totals are often 0 on multisystem."""
    sb_list = sb_info.get("solarbank_list") or []
    charge = _parse_power_field(sb_info.get("total_charging_power")) or 0
    discharge = _parse_power_field(sb_info.get("battery_discharge_power")) or 0
    if charge < 0:
        charge = 0
    if discharge < 0:
        discharge = 0

    bank_charge, bank_discharge = sum_bank_charge_discharge(
        sb_list, api, site_id=site_id
    )
    if bank_charge > charge:
        charge = bank_charge
    if bank_discharge > discharge:
        discharge = bank_discharge
    return charge, discharge


def extract_solarbank_info(
    data: dict, api: Any | None = None, config: dict | None = None
) -> dict[str, Any] | None:
    """Build solarbank_info payload for system/site poll (scene info, every poll)."""
    from entity_groups import enabled_entity_groups  # noqa: PLC0415

    enabled = enabled_entity_groups(config or {})
    if GROUP_SYSTEM_OVERVIEW not in enabled and GROUP_POWER_FLOWS not in enabled:
        return None
    dev_type = str(data.get("type") or "").lower()
    if dev_type not in (SYSTEM, SITE):
        return None
    sb_info = data.get("solarbank_info")
    if not isinstance(sb_info, dict):
        return None

    charge, discharge = _resolve_system_power_totals(
        sb_info, api, site_id=str(data.get("site_id") or "")
    )
    out: dict[str, Any] = {
        "battery_discharge_power": discharge,
        "total_charging_power": charge,
    }

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
    if banks:
        out["solarbank_list"] = banks
    return out
