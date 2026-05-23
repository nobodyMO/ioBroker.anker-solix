"""Where to expose site-level energy statistics (avoid duplicate ioBroker channels)."""

from __future__ import annotations

from typing import Any

COMBINER = "combiner_box"
SOLARBANK = "solarbank"
SMARTMETER = "smartmeter"
SYSTEM = "system"
SITE = "site"


def build_site_has_combiner(caches: dict[str, Any]) -> dict[str, bool]:
    """site_id -> True when a combiner_box device exists for that site."""
    found: dict[str, bool] = {}
    for ctx_id, ctx_data in caches.items():
        if not isinstance(ctx_data, dict):
            continue
        dev_type = str(ctx_data.get("type") or ctx_data.get("device_type") or "").lower()
        site_id = str(ctx_data.get("site_id") or "")
        if dev_type == COMBINER and site_id:
            found[site_id] = True
            continue
        if dev_type == SYSTEM:
            sid = site_id or str(ctx_id)
            cb_info = ctx_data.get("combiner_box_info") or {}
            if cb_info.get("combiner_box_list"):
                found[sid] = True
    return found


def statistics_device_types(site_has_combiner: bool) -> frozenset[str]:
    """
    Device types that receive site-level energy_details as statistics states.

    Combiner site: only combiner_box (not system, not each solarbank).
    Standalone: solarbank + smartmeter (grid metrics when present).
    """
    if site_has_combiner:
        return frozenset({COMBINER})
    return frozenset({SOLARBANK, SMARTMETER})


def device_exposes_energy_statistics(
    dev_type: str,
    site_has_combiner: bool,
    *,
    enable_stats: bool,
) -> bool:
    if not enable_stats:
        return False
    if dev_type in (SYSTEM, SITE):
        return False
    return dev_type in statistics_device_types(site_has_combiner)
