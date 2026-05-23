"""Weekly / monthly / yearly site energy totals via energy_analysis API."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any

from entity_groups import (
    GROUP_ENERGY_STATISTICS_MONTH,
    GROUP_ENERGY_STATISTICS_WEEK,
    GROUP_ENERGY_STATISTICS_YEAR,
    build_exclude_categories,
    enabled_entity_groups,
)
from energy_entities import parse_energy_value
from solixapi.apitypes import ApiCategories, SolixDeviceType
from solixapi.helpers import convertToKwh

if True:  # TYPE_CHECKING block without import cycle
    from solixapi.api import AnkerSolixApi

PERIOD_WEEK = "week"
PERIOD_MONTH = "month"
PERIOD_YEAR = "year"

# Pause between energy_analysis calls (HA poll_device_energy uses request_delay; bursts → 10003).
PERIOD_ANALYSIS_DELAY_SEC = 2.5

_PERIOD_GROUPS: dict[str, str] = {
    PERIOD_WEEK: GROUP_ENERGY_STATISTICS_WEEK,
    PERIOD_MONTH: GROUP_ENERGY_STATISTICS_MONTH,
    PERIOD_YEAR: GROUP_ENERGY_STATISTICS_YEAR,
}

# Same metrics as daily statistics (energy_entities keys)
_PERIOD_METRIC_SPECS: list[dict[str, Any]] = [
    {"keys": ["solar_production"], "id": "solar_production"},
    {"keys": ["battery_charge", "solarbank_charge"], "id": "charge_energy"},
    {"keys": ["battery_discharge", "solarbank_discharge"], "id": "discharge_energy"},
    {"keys": ["home_usage"], "id": "home_usage"},
    {"keys": ["solar_to_home"], "id": "solar_to_home"},
    {"keys": ["solar_to_battery"], "id": "solar_to_battery"},
    {"keys": ["battery_to_home"], "id": "battery_to_home"},
    {"keys": ["grid_to_home"], "id": "grid_to_home"},
    {"keys": ["grid_to_battery"], "id": "grid_to_battery"},
    {"keys": ["3rd_party_pv_to_bat"], "id": "3rd_party_pv_to_bat"},
    {"keys": ["ev_charge"], "id": "ev_charge"},
    {"keys": ["grid_import"], "id": "grid_import", "smartmeter": True},
    {"keys": ["solar_to_grid", "grid_export"], "id": "grid_export", "smartmeter": True},
]


def _period_entity_specs(period: str) -> list[dict[str, Any]]:
    group = _PERIOD_GROUPS[period]
    prefix = period
    specs: list[dict[str, Any]] = [
        {
            "id": f"{prefix}_energy_period",
            "keys": ["date", "period_label"],
            "role": "value.date",
            "types": ["system", "site", "solarbank", "combiner_box"],
            "period": period,
            "groups": [group],
        },
    ]
    for metric in _PERIOD_METRIC_SPECS:
        specs.append(
            {
                "id": f"{prefix}_{metric['id']}",
                "keys": metric["keys"],
                "unit": "kWh",
                "types": ["system", "site", "solarbank", "combiner_box"],
                "period": period,
                "smartmeter_only": metric.get("smartmeter"),
                "groups": [group],
            }
        )
    return specs


ENERGY_PERIOD_ENTITIES: list[dict[str, Any]] = [
    *(_period_entity_specs(PERIOD_WEEK)),
    *(_period_entity_specs(PERIOD_MONTH)),
    *(_period_entity_specs(PERIOD_YEAR)),
]

PERIOD_LABELS_DE: dict[str, str] = {
    "week_energy_period": "Kalenderwoche",
    "week_solar_production": "Solarertrag (Woche)",
    "week_charge_energy": "Batterieladung (Woche)",
    "week_discharge_energy": "Batterieentladung (Woche)",
    "week_home_usage": "Hausverbrauch (Woche)",
    "week_solar_to_home": "Solar → Haus (Woche)",
    "week_solar_to_battery": "Solar → Batterie (Woche)",
    "week_battery_to_home": "Batterie → Haus (Woche)",
    "week_grid_to_home": "Netz → Haus (Woche)",
    "week_grid_to_battery": "Netz → Batterie (Woche)",
    "week_3rd_party_pv_to_bat": "3rd-Party PV → Batterie (Woche)",
    "week_ev_charge": "EV-Ladung (Woche)",
    "week_grid_import": "Netzbezug (Woche)",
    "week_grid_export": "Netzeinspeisung (Woche)",
    "month_energy_period": "Monat",
    "month_solar_production": "Solarertrag (Monat)",
    "month_charge_energy": "Batterieladung (Monat)",
    "month_discharge_energy": "Batterieentladung (Monat)",
    "month_home_usage": "Hausverbrauch (Monat)",
    "month_solar_to_home": "Solar → Haus (Monat)",
    "month_solar_to_battery": "Solar → Batterie (Monat)",
    "month_battery_to_home": "Batterie → Haus (Monat)",
    "month_grid_to_home": "Netz → Haus (Monat)",
    "month_grid_to_battery": "Netz → Batterie (Monat)",
    "month_3rd_party_pv_to_bat": "3rd-Party PV → Batterie (Monat)",
    "month_ev_charge": "EV-Ladung (Monat)",
    "month_grid_import": "Netzbezug (Monat)",
    "month_grid_export": "Netzeinspeisung (Monat)",
    "year_energy_period": "Jahr",
    "year_solar_production": "Solarertrag (Jahr)",
    "year_charge_energy": "Batterieladung (Jahr)",
    "year_discharge_energy": "Batterieentladung (Jahr)",
    "year_home_usage": "Hausverbrauch (Jahr)",
    "year_solar_to_home": "Solar → Haus (Jahr)",
    "year_solar_to_battery": "Solar → Batterie (Jahr)",
    "year_battery_to_home": "Batterie → Haus (Jahr)",
    "year_grid_to_home": "Netz → Haus (Jahr)",
    "year_grid_to_battery": "Netz → Batterie (Jahr)",
    "year_3rd_party_pv_to_bat": "3rd-Party PV → Batterie (Jahr)",
    "year_ev_charge": "EV-Ladung (Jahr)",
    "year_grid_import": "Netzbezug (Jahr)",
    "year_grid_export": "Netzeinspeisung (Jahr)",
}


def period_start_day(period: str, now: datetime | None = None) -> datetime:
    """Start of current calendar week / month / year (local time)."""
    now = now or datetime.now()
    if period == PERIOD_YEAR:
        return now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    if period == PERIOD_MONTH:
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    # week: Monday of current ISO week
    weekday = now.weekday()
    return (now - timedelta(days=weekday)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )


def period_label(period: str, start: datetime) -> str:
    if period == PERIOD_YEAR:
        return start.strftime("%Y")
    if period == PERIOD_MONTH:
        return start.strftime("%Y-%m")
    iso = start.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def _sum_power_kwh(resp: dict) -> float | None:
    total = 0.0
    found = False
    for item in resp.get("power") or []:
        val = convertToKwh(val=item.get("value"), unit="kwh")
        if val is not None:
            total += float(val)
            found = True
    return round(total, 2) if found else None


def _total_kwh(resp: dict, *keys: str) -> float | None:
    unit = resp.get("total_energy_unit") or resp.get("charge_unit") or "kwh"
    for key in keys:
        if (raw := resp.get(key)) not in (None, ""):
            val = convertToKwh(val=raw, unit=unit)
            if val is not None:
                return round(float(val), 2)
    return None


def _merge_entry(entry: dict, updates: dict[str, Any]) -> None:
    for key, val in updates.items():
        if val is not None and val != "":
            entry[key] = val


def period_num_days(period: str, now: datetime | None = None) -> int:
    """Days to aggregate for current calendar week / month (inclusive)."""
    now = now or datetime.now()
    start = period_start_day(period, now)
    if period == PERIOD_YEAR:
        return (now.date() - start.date()).days + 1
    if period == PERIOD_MONTH:
        return now.day
    return (now.date() - start.date()).days + 1


def _aggregate_daily_energy_table(
    table: dict[str, Any], period: str, start: datetime
) -> dict[str, Any]:
    """Sum daily energy_daily rows into one week/month block (HA-style site totals)."""
    skip = {"date", "statistics", "smartplug_list"}
    sums: dict[str, float] = {}
    for day_entry in table.values():
        if not isinstance(day_entry, dict):
            continue
        for key, raw in day_entry.items():
            if key in skip:
                continue
            val = parse_energy_value(raw)
            if val is None:
                continue
            sums[key] = sums.get(key, 0.0) + float(val)
    entry: dict[str, Any] = {
        "date": period_label(period, start),
        "period_label": period_label(period, start),
    }
    for key, total in sums.items():
        if total > 0:
            entry[key] = round(total, 2)
    return entry if period_block_has_values(entry) else {}


def period_block_has_values(block: dict[str, Any]) -> bool:
    """True if block has at least one kWh metric (not only date labels)."""
    skip = {"date", "period_label"}
    return any(
        block.get(k) not in (None, "")
        for k in block
        if k not in skip
    )


def site_energy_query_types(
    api: AnkerSolixApi, site_id: str, site: dict, exclude: set[str]
) -> tuple[set[str], str]:
    """Mirror poll_device_energy query_types for balcony power sites."""
    from solixapi.apitypes import SolixDeviceType as DT  # noqa: N811

    query_types: set[str] = set()
    if site.get("site_type", "") == DT.SOLARBANK_PPS.value:
        query_types.add(DT.SOLARBANK_PPS.value)
        return query_types, ""

    parallel_sbs = [
        item.get("device_sn")
        for item in (site.get("solarbank_info") or {}).get("solarbank_list") or []
        if item.get("device_pn") != "A17C0"
    ]
    if (dev_list := site.get("solar_list") or []) and (sn := dev_list[0].get("device_sn")):
        query_types.add(DT.INVERTER.value)

    if (dev_list := (site.get("grid_info") or {}).get("grid_list") or []) and dev_list[0].get(
        "device_sn"
    ):
        query_types.discard(DT.INVERTER.value)
        if {DT.SMARTMETER.value, ApiCategories.smartmeter_energy} - exclude:
            query_types.add(DT.SMARTMETER.value)

    if (dev_list := (site.get("smart_plug_info") or {}).get("smartplug_list") or []) and dev_list[
        0
    ].get("device_sn"):
        query_types.discard(DT.INVERTER.value)
        if {DT.SMARTPLUG.value, ApiCategories.smartplug_energy} - exclude:
            query_types.add(DT.SMARTPLUG.value)

    if (dev_list := (site.get("charging_pile_info") or {}).get("charging_pile_list") or []) and (
        dev_list[0].get("device_sn")
    ):
        query_types.discard(DT.INVERTER.value)
        if {DT.EV_CHARGER.value, ApiCategories.charger_energy} - exclude:
            query_types.add(DT.EV_CHARGER.value)

    if (dev_list := (site.get("solarbank_info") or {}).get("solarbank_list") or []) and dev_list[
        0
    ].get("device_sn"):
        query_types.discard(DT.INVERTER.value)
        if {DT.SOLARBANK.value, ApiCategories.solarbank_energy} - exclude:
            query_types.add(DT.SOLARBANK.value)
            if {ApiCategories.solar_energy} - exclude and len(parallel_sbs) == 1:
                query_types.add(DT.INVERTER.value)

    # HA poll_device_energy: empty device_sn → site-level totals (combiner SN → 10003).
    return query_types, ""


async def _energy_analysis_safe(
    api: AnkerSolixApi,
    *,
    site_id: str,
    device_sn: str,
    range_type: str,
    start: datetime,
    dev_type: str,
    logger: logging.Logger,
    end: datetime | None = None,
) -> dict[str, Any] | None:
    """Single energy_analysis call with retries on transient Anker errors."""
    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            return await api.energy_analysis(
                siteId=site_id,
                deviceSn=device_sn,
                rangeType=range_type,
                startDay=start,
                endDay=end,
                devType=dev_type,
            )
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            msg = str(exc)
            if attempt < 2 and ("10003" in msg or "Failed to request" in msg):
                await asyncio.sleep(4 + attempt * 2)
                continue
            logger.warning(
                "energy_analysis %s (%s) failed for site %s: %s",
                dev_type,
                range_type,
                site_id,
                exc,
            )
            return None
    if last_exc:
        logger.warning(
            "energy_analysis %s (%s) failed for site %s: %s",
            dev_type,
            range_type,
            site_id,
            last_exc,
        )
    return None


async def _pause_between_period_calls() -> None:
    await asyncio.sleep(PERIOD_ANALYSIS_DELAY_SEC)


async def fetch_energy_period_block_from_daily(
    api: AnkerSolixApi,
    site_id: str,
    query_types: set[str],
    period: str,
) -> dict[str, Any]:
    """Week/month totals via energy_daily (same path as HA poll_device_energy)."""
    if period not in (PERIOD_WEEK, PERIOD_MONTH):
        return {}
    start = period_start_day(period)
    num_days = period_num_days(period)
    if num_days <= 0:
        return {}
    log = api._logger
    log.debug(
        "Period %s for site %s: energy_daily from %s (%s days, device_sn empty)",
        period,
        site_id,
        start.strftime("%Y-%m-%d"),
        num_days,
    )
    try:
        table = await api.energy_daily(
            siteId=site_id,
            deviceSn="",
            startDay=start,
            numDays=num_days,
            dayTotals=True,
            devTypes=query_types,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("energy_daily (%s) failed for site %s: %s", period, site_id, exc)
        return {}
    return _aggregate_daily_energy_table(table, period, start)


async def fetch_energy_period_block_from_analysis(
    api: AnkerSolixApi,
    site_id: str,
    device_sn: str,
    query_types: set[str],
    period: str,
) -> dict[str, Any]:
    """Year (and fallback): calendar period via energy_analysis type week/month/year."""
    site = api.sites.get(site_id) or {}
    other_pv = bool(
        ((site.get("feature_switch") or {}).get("show_third_party_pv_panel"))
    )
    sb2s = [
        d
        for d in api.devices.values()
        if d.get("site_id") == site_id
        and d.get("type") == SolixDeviceType.SOLARBANK.value
        and int(d.get("generation") or 0) >= 2
    ]
    start = period_start_day(period)
    range_type = period if period in ("week", "month", "year") else "week"
    end = datetime.now() if range_type == "week" else None
    entry: dict[str, Any] = {
        "date": period_label(period, start),
        "period_label": period_label(period, start),
    }
    log = api._logger

    if SolixDeviceType.SOLARBANK.value in query_types:
        resp = await _energy_analysis_safe(
            api,
            site_id=site_id,
            device_sn=device_sn,
            range_type=range_type,
            start=start,
            end=end,
            dev_type="solarbank",
            logger=log,
        )
        if resp:
            discharge = _sum_power_kwh(resp) or _total_kwh(
                resp, "discharge_total", "battery_discharging_total"
            )
            _merge_entry(
                entry,
                {
                    "battery_discharge": discharge,
                    "solarbank_discharge": discharge,
                    "grid_to_battery": _total_kwh(resp, "grid_to_battery_total"),
                    "battery_to_home": _total_kwh(resp, "battery_to_home_total"),
                    "3rd_party_pv_to_bat": _total_kwh(resp, "third_party_pv_to_bat")
                    if other_pv
                    else None,
                    "ac_socket": _total_kwh(resp, "ac_out_put_total"),
                },
            )
        await _pause_between_period_calls()

    if (SolixDeviceType.SOLARBANK.value in query_types and sb2s) or (
        {
            SolixDeviceType.SMARTMETER.value,
            SolixDeviceType.SMARTPLUG.value,
            SolixDeviceType.SOLARBANK_PPS.value,
        }
        & query_types
    ):
        resp = await _energy_analysis_safe(
            api,
            site_id=site_id,
            device_sn=device_sn,
            range_type=range_type,
            start=start,
            end=end,
            dev_type="home_usage",
            logger=log,
        )
        if resp:
            _merge_entry(
                entry,
                {
                    "home_usage": _sum_power_kwh(resp)
                    or _total_kwh(resp, "home_usage_total"),
                    "grid_to_home": _total_kwh(resp, "grid_to_home_total"),
                    "battery_to_home": entry.get("battery_to_home")
                    or _total_kwh(resp, "battery_to_home_total"),
                    "grid_import": _total_kwh(
                        resp, "grid_imported_total", "grid_import_total"
                    ),
                },
            )
        await _pause_between_period_calls()

    if SolixDeviceType.SMARTMETER.value in query_types and (
        SolixDeviceType.SOLARBANK.value not in query_types or other_pv
    ):
        resp = await _energy_analysis_safe(
            api,
            site_id=site_id,
            device_sn=device_sn,
            range_type=range_type,
            start=start,
            end=end,
            dev_type="grid",
            logger=log,
        )
        if resp:
            export = _sum_power_kwh(resp)
            if export is not None:
                export = abs(export)
            _merge_entry(
                entry,
                {
                    "solar_to_grid": export or _total_kwh(resp, "solar_to_grid_total"),
                    "grid_export": export or _total_kwh(resp, "solar_to_grid_total"),
                    "grid_to_home": entry.get("grid_to_home")
                    or _total_kwh(resp, "grid_to_home_total"),
                },
            )
        await _pause_between_period_calls()

    if SolixDeviceType.EV_CHARGER.value in query_types:
        resp = await _energy_analysis_safe(
            api,
            site_id=site_id,
            device_sn=device_sn,
            range_type=range_type,
            start=start,
            end=end,
            dev_type="ev_charger",
            logger=log,
        )
        if resp:
            _merge_entry(entry, {"ev_charge": _sum_power_kwh(resp)})
        await _pause_between_period_calls()

    if SolixDeviceType.SOLARBANK_PPS.value not in query_types:
        resp = await _energy_analysis_safe(
            api,
            site_id=site_id,
            device_sn=device_sn,
            range_type=range_type,
            start=start,
            end=end,
            dev_type="solar_production",
            logger=log,
        )
        if resp:
            _merge_entry(
                entry,
                {
                    "solar_production": _sum_power_kwh(resp)
                    or _total_kwh(resp, "solar_total", "charge_total"),
                    "battery_charge": _total_kwh(resp, "charge_total"),
                    "solarbank_charge": _total_kwh(resp, "charge_total"),
                    "solar_to_grid": entry.get("solar_to_grid")
                    or _total_kwh(resp, "solar_to_grid_total"),
                    "solar_to_battery": _total_kwh(resp, "solar_to_battery_total"),
                    "solar_to_home": _total_kwh(resp, "solar_to_home_total"),
                },
            )

    return entry if period_block_has_values(entry) else {}


async def fetch_energy_period_block(
    api: AnkerSolixApi,
    site_id: str,
    device_sn: str,
    query_types: set[str],
    period: str,
) -> dict[str, Any]:
    """Fetch one period block (week/month/year) for a site."""
    sn = (device_sn or "").strip()
    if period in (PERIOD_WEEK, PERIOD_MONTH):
        block = await fetch_energy_period_block_from_daily(
            api, site_id, query_types, period
        )
        if block:
            return block
        api._logger.info(
            "Period %s for site %s: energy_daily empty, trying energy_analysis",
            period,
            site_id,
        )
    block = await fetch_energy_period_block_from_analysis(
        api, site_id, sn, query_types, period
    )
    if block or period == PERIOD_YEAR:
        return block
    return await fetch_energy_period_block_from_daily(api, site_id, query_types, period)


def enabled_periods(config: dict) -> list[str]:
    enabled = enabled_entity_groups(config)
    periods: list[str] = []
    if GROUP_ENERGY_STATISTICS_WEEK in enabled:
        periods.append(PERIOD_WEEK)
    if GROUP_ENERGY_STATISTICS_MONTH in enabled:
        periods.append(PERIOD_MONTH)
    if GROUP_ENERGY_STATISTICS_YEAR in enabled:
        periods.append(PERIOD_YEAR)
    return periods


async def update_site_energy_periods(
    api: AnkerSolixApi,
    config: dict,
    *,
    periods: list[str] | None = None,
) -> list[str]:
    """Query week/month/year totals for all sites. Returns periods that got data on any site."""
    periods = periods if periods is not None else enabled_periods(config)
    if not periods:
        return []
    exclude = set(build_exclude_categories(config))
    updated_periods: set[str] = set()
    for site_id, site in list(api.sites.items()):
        if site_id.startswith(SolixDeviceType.VIRTUAL.value):
            continue
        if api.powerpanelApi and site_id in (api.powerpanelApi.sites or {}):
            continue
        if api.hesApi and site_id in (api.hesApi.sites or {}):
            continue
        query_types, query_sn = site_energy_query_types(api, site_id, site, exclude)
        if not query_types:
            continue
        energy = dict(site.get("energy_details") or {})
        for period in periods:
            block = await fetch_energy_period_block(
                api, site_id, query_sn, query_types, period
            )
            if block:
                energy[period] = block
                updated_periods.add(period)
            else:
                api._logger.warning(
                    "Energy period %s: no data for site %s (API errors or empty response)",
                    period,
                    site_id,
                )
        site["energy_details"] = energy
        api.sites[site_id] = site
    return sorted(updated_periods)


def pick_period_value(
    data: dict, spec: dict[str, Any], period: str | None = None
) -> Any:
    block_key = period or spec.get("period") or PERIOD_WEEK
    block = (data.get("energy_details") or {}).get(block_key) or {}
    if not isinstance(block, dict):
        return None
    for key in spec.get("keys") or []:
        if key in ("date", "period_label"):
            return str(block.get("date") or block.get("period_label") or "")
        if (val := block.get(key)) is not None and val != "":
            return parse_energy_value(val)
    return None
