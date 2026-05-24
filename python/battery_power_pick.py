"""Battery charge/discharge power (W) from Anker cloud/scene API (no MQTT)."""

from __future__ import annotations

from typing import Any

from entities import _parse_power_value


def _parse_signed(val: Any) -> int | None:
    if val is None or val == "":
        return None
    parsed = _parse_power_value(val)
    if isinstance(parsed, int):
        return parsed
    try:
        return int(float(val))
    except (TypeError, ValueError):
        return None


def _max_positive(*values: int | None) -> int:
    nums = [v for v in values if isinstance(v, int) and v > 0]
    return max(nums) if nums else 0


def pick_bat_charge_discharge(data: dict) -> tuple[int, int]:
    """Return (charge_W, discharge_W) from cloud cache only (scene info / device API)."""
    charge = _max_positive(
        _parse_signed(data.get("bat_charge_power")),
        _parse_signed(data.get("battery_charge_power")),
    )
    discharge = _max_positive(
        _parse_signed(data.get("bat_discharge_power")),
        _parse_signed(data.get("battery_discharge_power")),
    )

    signed = _parse_signed(data.get("charging_power"))
    if signed is not None:
        if signed > 0:
            charge = max(charge, signed)
        elif signed < 0:
            discharge = max(discharge, abs(signed))

    if charge or discharge:
        return charge, discharge

    pv = _parse_signed(data.get("photovoltaic_power")) or _parse_signed(
        data.get("input_power")
    )
    out = _parse_signed(data.get("output_power")) or _parse_signed(
        data.get("dc_output_power")
    )
    grid = _parse_signed(data.get("grid_to_battery_power")) or 0
    if pv is not None and out is not None:
        calc = pv + grid - out
        if calc > 0:
            return calc, 0
        if calc < 0:
            return 0, abs(calc)

    return 0, 0


def scene_bank_entry(api: Any | None, site_id: str, sn: str) -> dict:
    """Solarbank row from site solarbank_info (AnkerSolix2 / scene API)."""
    if not api or not site_id or not sn:
        return {}
    site = (api.sites or {}).get(site_id) or {}
    for item in ((site.get("solarbank_info") or {}).get("solarbank_list") or []):
        if isinstance(item, dict) and str(item.get("device_sn") or "") == sn:
            return dict(item)
    return {}


def merge_bank_cache(item: dict, api: Any | None, site_id: str = "") -> dict:
    """Merge scene list row with device API cache; ignore MQTT."""
    sn = str(item.get("device_sn") or "").strip()
    dev = (api.devices.get(sn) if api and sn else None) or {}
    if not isinstance(dev, dict):
        dev = {}
    merged: dict[str, Any] = {}
    for src in (dev, item):
        if not isinstance(src, dict):
            continue
        for key, val in src.items():
            if key in ("mqtt_data", "mqtt_overlay", "mqtt_supported"):
                continue
            if val is not None and val != "":
                merged[key] = val
    if not site_id:
        site_id = str(merged.get("site_id") or dev.get("site_id") or "")
    scene = scene_bank_entry(api, site_id, sn)
    for key, val in scene.items():
        if val is not None and val != "":
            merged[key] = val
    if sn:
        merged["device_sn"] = sn
    return merged


def enrich_solarbank_scene(api: Any, sn: str, ctx_data: dict) -> dict:
    """Overlay latest scene-API solarbank fields onto device poll cache."""
    site_id = str(ctx_data.get("site_id") or "")
    scene = scene_bank_entry(api, site_id, sn)
    if not scene:
        return ctx_data
    out = dict(ctx_data)
    for key, val in scene.items():
        if val is not None and val != "":
            out[key] = val
    return out


def sum_bank_charge_discharge(
    sb_list: list, api: Any | None, site_id: str = ""
) -> tuple[int, int]:
    charge = 0
    discharge = 0
    for item in sb_list:
        if not isinstance(item, dict):
            continue
        c, d = pick_bat_charge_discharge(
            merge_bank_cache(item, api, site_id=site_id)
        )
        charge += c
        discharge += d
    return charge, discharge
