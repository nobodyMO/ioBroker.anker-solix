"""Compute multisystem / combiner total battery SOC for ioBroker."""

from __future__ import annotations

from typing import Any

SOLARBANK = "solarbank"
COMBINER = "combiner_box"


def normalize_soc_percent(raw: Any) -> float | None:
    """Normalize API/MQTT SOC values to 0–100 %."""
    if raw is None:
        return None
    text = str(raw).strip().replace("%", "")
    if not text.replace(".", "", 1).isdigit():
        return None
    value = float(text)
    if 0 <= value <= 1:
        value *= 100
    elif value > 100:
        # Some totals use centi-percent (e.g. 8550 → 85.5 %)
        if value <= 10000:
            value /= 100
        else:
            return None
    if 0 <= value <= 100:
        return round(value, 1)
    return None


def _parse_capacity_wh(raw: Any) -> int:
    if raw is None:
        return 0
    text = str(raw).strip().replace("Wh", "").replace("wh", "").replace("kWh", "").strip()
    if not text.replace(".", "", 1).isdigit():
        return 0
    value = float(text)
    # Heuristic: capacities below 50 are usually kWh
    if value < 50:
        value *= 1000
    return max(0, int(round(value)))


def _site_solarbank_rows(api: Any, site_id: str) -> list[dict[str, Any]]:
    site = (api.sites or {}).get(site_id) or {}
    sb_info = site.get("solarbank_info") or {}
    rows: list[dict[str, Any]] = []
    for sb in sb_info.get("solarbank_list") or []:
        if not isinstance(sb, dict):
            continue
        sn = str(sb.get("device_sn") or "").strip()
        dev = (api.devices or {}).get(sn) or {}
        merged = {**sb, **dev}
        soc = normalize_soc_percent(
            merged.get("battery_soc")
            or merged.get("state_of_charge")
            or merged.get("battery_power")
        )
        if soc is None:
            continue
        rows.append(
            {
                "device_sn": sn,
                "soc_percent": soc,
                "capacity_wh": _parse_capacity_wh(merged.get("battery_capacity")),
            }
        )
    if rows:
        return rows
    # Fallback: all solarbanks cached for this site
    for sn, dev in (api.devices or {}).items():
        if str(dev.get("site_id") or "") != site_id:
            continue
        if str(dev.get("type") or "").lower() not in (SOLARBANK, "solarbank"):
            continue
        soc = normalize_soc_percent(dev.get("battery_soc") or dev.get("state_of_charge"))
        if soc is None:
            continue
        rows.append(
            {
                "device_sn": str(sn),
                "soc_percent": soc,
                "capacity_wh": _parse_capacity_wh(dev.get("battery_capacity")),
            }
        )
    return rows


def _aggregate_soc(rows: list[dict[str, Any]]) -> tuple[float, str]:
    if len(rows) == 1:
        return float(rows[0]["soc_percent"]), "solarbank"
    caps = [r for r in rows if int(r.get("capacity_wh") or 0) > 0]
    if caps and len(caps) == len(rows):
        total_cap = sum(int(r["capacity_wh"]) for r in caps)
        weighted = sum(float(r["soc_percent"]) * int(r["capacity_wh"]) for r in caps) / total_cap
        return round(weighted, 1), "solarbanks_weighted"
    avg = sum(float(r["soc_percent"]) for r in rows) / len(rows)
    return round(avg, 1), "solarbanks_average"


def compute_combiner_total_soc(
    api: Any, combiner_sn: str, site_id: str
) -> dict[str, Any] | None:
    """Return total SOC for a combiner site: prefer cloud total, else aggregate solarbanks."""
    combiner = (api.devices or {}).get(combiner_sn) or {}
    for key in ("total_soc", "battery_soc", "battery_soc_total", "state_of_charge"):
        soc = normalize_soc_percent(combiner.get(key))
        if soc is not None:
            return {
                "total_soc_percent": soc,
                "source": "combiner",
                "bank_count": 0,
            }

    if site_id:
        site = (api.sites or {}).get(site_id) or {}
        sb_info = site.get("solarbank_info") or {}
        site_total = normalize_soc_percent(sb_info.get("total_battery_power"))
        if site_total is not None:
            rows = _site_solarbank_rows(api, site_id)
            return {
                "total_soc_percent": site_total,
                "source": "site_total",
                "bank_count": len(rows),
            }

        rows = _site_solarbank_rows(api, site_id)
        if rows:
            soc, source = _aggregate_soc(rows)
            return {
                "total_soc_percent": soc,
                "source": source,
                "bank_count": len(rows),
            }

    return None


def enrich_combiner_soc(api: Any, combiner_sn: str, ctx_data: dict[str, Any]) -> dict[str, Any]:
    """Inject computed total SOC into combiner poll cache (entities + curtailment)."""
    site_id = str(ctx_data.get("site_id") or "")
    result = compute_combiner_total_soc(api, combiner_sn, site_id)
    if not result:
        return ctx_data
    soc = result["total_soc_percent"]
    return {
        **ctx_data,
        "total_soc": soc,
        "computed_total_soc": soc,
        "total_state_of_charge": soc,
        "total_soc_source": result.get("source"),
        "total_soc_bank_count": result.get("bank_count"),
    }
