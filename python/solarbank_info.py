"""System solarbank_info channel (AnkerSolix2-compatible paths under system.{siteId})."""

from __future__ import annotations

from typing import Any

from entity_groups import GROUP_POWER_FLOWS, GROUP_SYSTEM_OVERVIEW
from entities import SYSTEM, SITE, _parse_power_value

_CHARGE_KEYS = ("bat_charge_power", "battery_charge_power", "charging_power")
_DISCHARGE_KEYS = ("bat_discharge_power", "battery_discharge_power")


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


def _sources_for_bank(item: dict, api: Any | None) -> tuple[dict, dict]:
    sn = str(item.get("device_sn") or "").strip()
    dev = (api.devices.get(sn) if api and sn else None) or {}
    return item, dev if isinstance(dev, dict) else {}


def _sum_positive_power(
    sb_list: list, api: Any | None, keys: tuple[str, ...]
) -> int | None:
    total = 0
    found = False
    for item in sb_list:
        if not isinstance(item, dict):
            continue
        item_src, dev_src = _sources_for_bank(item, api)
        for key in keys:
            val = None
            for src in (item_src, dev_src):
                val = _parse_power_field(src.get(key))
                if val is not None and val > 0:
                    break
            else:
                continue
            total += val
            found = True
            break
    return total if found else None


def _sum_signed_charge_parts(sb_list: list, api: Any | None) -> tuple[int, int]:
    """Split signed charging_power into charge (>=0) and discharge (>=0) totals."""
    charge = 0
    discharge = 0
    for item in sb_list:
        if not isinstance(item, dict):
            continue
        item_src, dev_src = _sources_for_bank(item, api)
        signed = None
        for src in (item_src, dev_src):
            signed = _parse_power_field(src.get("charging_power"))
            if signed is not None:
                break
        if signed is None:
            continue
        if signed > 0:
            charge += signed
        elif signed < 0:
            discharge += abs(signed)
    return charge, discharge


def _resolve_system_power_totals(
    sb_info: dict, api: Any | None
) -> tuple[int, int]:
    """Resolve total charge/discharge W; multisystem cloud totals are often incomplete."""
    sb_list = sb_info.get("solarbank_list") or []
    charge = _parse_power_field(sb_info.get("total_charging_power"))
    discharge = _parse_power_field(sb_info.get("battery_discharge_power"))

    if charge is not None and charge < 0:
        charge = 0
    if discharge is not None and discharge < 0:
        discharge = 0

    if not charge:
        summed = _sum_positive_power(sb_list, api, _CHARGE_KEYS)
        if summed is not None:
            charge = summed

    if not discharge:
        summed = _sum_positive_power(sb_list, api, _DISCHARGE_KEYS)
        if summed is not None:
            discharge = summed

    if not charge and not discharge and sb_list:
        calc_charge, calc_discharge = _sum_signed_charge_parts(sb_list, api)
        if calc_charge:
            charge = calc_charge
        if calc_discharge:
            discharge = calc_discharge

    return int(charge or 0), int(discharge or 0)


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

    charge, discharge = _resolve_system_power_totals(sb_info, api)
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

