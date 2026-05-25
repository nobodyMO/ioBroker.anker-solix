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


def _has_battery_flow_fields(data: dict) -> bool:
    """True when a battery-related flow sensor reports active power (W > 0)."""
    keys = (
        "pv_to_battery_power",
        "solar_to_battery_power",
        "battery_to_home_power",
        "bat_to_home_power",
        "grid_to_battery_power",
        "battery_to_grid_power",
    )
    return any(
        (parsed := _parse_signed(data.get(k))) is not None and parsed > 0 for k in keys
    )


def _pick_from_power_flows(data: dict) -> tuple[int, int]:
    """Charge/discharge from flow sensors only (no cloud bat_* totals)."""
    charge = _max_positive(
        _parse_signed(data.get("pv_to_battery_power")),
        _parse_signed(data.get("solar_to_battery_power")),
        _parse_signed(data.get("grid_to_battery_power")),
    )
    discharge = _max_positive(
        _parse_signed(data.get("battery_to_home_power")),
        _parse_signed(data.get("bat_to_home_power")),
        _parse_signed(data.get("battery_to_grid_power")),
    )
    return charge, discharge


def _looks_like_export_not_battery_discharge(data: dict, discharge_w: int) -> bool:
    """Cloud bat_discharge_power often mirrors PV→grid when the pack is idle."""
    if discharge_w <= 0:
        return False
    pv = _parse_signed(data.get("photovoltaic_power")) or _parse_signed(
        data.get("input_power")
    )
    if pv is None:
        return False
    pv_grid = _parse_signed(data.get("photovoltaic_to_grid_power"))
    if isinstance(pv_grid, int) and pv_grid > 0 and abs(discharge_w - pv_grid) <= max(
        150, int(pv * 0.08)
    ):
        return True
    out = _parse_signed(data.get("output_power")) or _parse_signed(
        data.get("dc_output_power")
    )
    if isinstance(out, int) and out > 0 and abs(discharge_w - out) <= max(150, int(pv * 0.08)):
        return True
    return abs(discharge_w - pv) <= max(150, int(pv * 0.08))


def _pick_from_api_totals(data: dict) -> tuple[int, int]:
    """Charge/discharge from bat_* / charging_power (cloud scene API)."""
    charge_api = _max_positive(
        _parse_signed(data.get("bat_charge_power")),
        _parse_signed(data.get("battery_charge_power")),
    )
    discharge_api = _max_positive(
        _parse_signed(data.get("bat_discharge_power")),
        _parse_signed(data.get("battery_discharge_power")),
    )

    signed = _parse_signed(data.get("charging_power"))
    if signed is not None:
        if signed > 0:
            return max(charge_api, signed), 0
        if signed < 0:
            return 0, max(discharge_api, abs(signed))
        # signed == 0: pack idle — ignore bat_discharge mirroring inverter export
        if charge_api > 0:
            return charge_api, 0
        return 0, 0

    if charge_api or discharge_api:
        if discharge_api > 0 and charge_api == 0 and _looks_like_export_not_battery_discharge(
            data, discharge_api
        ):
            return 0, 0
        return charge_api, discharge_api

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
            discharge = abs(calc)
            if _looks_like_export_not_battery_discharge(data, discharge):
                return 0, 0
            return 0, discharge

    return 0, 0


def pick_bat_charge_discharge(data: dict) -> tuple[int, int]:
    """Return (charge_W, discharge_W) from cloud cache only (scene info / device API)."""
    charge, discharge = _pick_from_api_totals(data)

    if _has_battery_flow_fields(data):
        flow_charge, flow_discharge = _pick_from_power_flows(data)
        charge = max(charge, flow_charge)
        discharge = max(discharge, flow_discharge)

    if (
        discharge > 0
        and charge == 0
        and _looks_like_export_not_battery_discharge(data, discharge)
    ):
        return 0, 0

    return charge, discharge


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


def _site_solarbank_sns(
    sb_list: list, api: Any | None, site_id: str
) -> list[str]:
    """Device SNs for site banks (scene list + device cache)."""
    seen: set[str] = set()
    for item in sb_list or []:
        if isinstance(item, dict):
            sn = str(item.get("device_sn") or "").strip()
            if sn:
                seen.add(sn)
    if api and site_id:
        for sn, dev in (api.devices or {}).items():
            if not isinstance(dev, dict):
                continue
            if str(dev.get("site_id") or "") != site_id:
                continue
            dtype = str(dev.get("type") or dev.get("device_type") or "").lower()
            if dtype in ("solarbank", "solarbank_pps"):
                seen.add(str(sn))
    return sorted(seen)


def sum_bank_charge_discharge(
    sb_list: list, api: Any | None, site_id: str = ""
) -> tuple[int, int]:
    """Sum charge/discharge W — same source path as per-solarbank sensors."""
    charge = 0
    discharge = 0
    if not api:
        for item in sb_list or []:
            if not isinstance(item, dict):
                continue
            c, d = pick_bat_charge_discharge(item)
            charge += c
            discharge += d
        return charge, discharge

    for sn in _site_solarbank_sns(sb_list, api, site_id):
        dev = (api.devices or {}).get(sn) or {}
        if not isinstance(dev, dict):
            continue
        ctx = dict(dev)
        if site_id:
            ctx["site_id"] = site_id
        data = enrich_solarbank_scene(api, sn, ctx)
        c, d = pick_bat_charge_discharge(data)
        charge += c
        discharge += d
    return charge, discharge
