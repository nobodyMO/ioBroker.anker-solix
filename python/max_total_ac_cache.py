"""Persist MQTT-applied max total AC (grid cap) across cloud/MQTT poll refreshes."""

from __future__ import annotations

from typing import Any

from entities import COMBINER, MAX_TOTAL_AC_OUTPUT_APPLIED, SOLARBANK

CUSTOMIZED_MAX_TOTAL_AC = "max_total_ac_output"


def stamp_device_max_total_ac(api: Any, sn: str, limit: int) -> None:
    """Write adapter-applied grid max AC onto device cache (in-place, survives poll merge)."""
    dev = api.devices.get(sn)
    if not isinstance(dev, dict):
        dev = {"device_sn": sn}
        api.devices[sn] = dev
    dev[MAX_TOTAL_AC_OUTPUT_APPLIED] = limit
    dev["max_load_total"] = limit
    if str(dev.get("type") or "").lower() == SOLARBANK:
        dev["max_load"] = limit
    dev["mqtt_overlay"] = True
    mqtt_data = dict(dev.get("mqtt_data") or {})
    mqtt_data["max_load_total"] = str(limit)
    if str(dev.get("type") or "").lower() == SOLARBANK:
        mqtt_data["max_load"] = str(limit)
    dev["mqtt_data"] = mqtt_data
    if hasattr(api, "customizeCacheId"):
        api.customizeCacheId(sn, CUSTOMIZED_MAX_TOTAL_AC, limit)


def stamp_max_total_ac_for_site(
    api: Any,
    site_id: str,
    device_id: str,
    device: dict,
    limit: int,
) -> list[str]:
    """Stamp combiner + site solarbanks (same as MQTT parallel max load targets)."""
    dev_type = str(device.get("type") or "").lower()
    sns = [device_id]
    if dev_type == COMBINER:
        for sn, dev in list(api.devices.items()):
            if (dev.get("site_id") or "") != site_id:
                continue
            if str(dev.get("type") or "").lower() != SOLARBANK:
                continue
            if sn not in sns:
                sns.append(sn)
    for sn in sns:
        stamp_device_max_total_ac(api, sn, limit)
    return sns


def reapply_max_total_ac_stamps(api: Any, applied: dict[str, int]) -> None:
    """Re-apply persisted limits after cloud/MQTT cache refresh overwrote mqtt_data."""
    for sn, limit in applied.items():
        if limit is None:
            continue
        try:
            value = int(limit)
        except (TypeError, ValueError):
            continue
        if value <= 0:
            continue
        stamp_device_max_total_ac(api, sn, value)


def read_applied_from_device(data: dict) -> int | None:
    """Resolve persisted/applied limit from device cache entry."""
    customized = (data.get("customized") or {}).get(CUSTOMIZED_MAX_TOTAL_AC)
    if customized is not None:
        try:
            return int(float(customized))
        except (TypeError, ValueError):
            pass
    applied = data.get(MAX_TOTAL_AC_OUTPUT_APPLIED)
    if applied is not None:
        try:
            return int(float(applied))
        except (TypeError, ValueError):
            pass
    return None
