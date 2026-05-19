#!/usr/bin/env python3
"""Bridge between ioBroker adapter and Anker Solix API (same library as HA integration)."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Any

from aiohttp import ClientSession

# solixapi is vendored from https://github.com/thomluther/ha-anker-solix
sys.path.insert(0, str(Path(__file__).parent))

from entities import (  # noqa: E402
    COMBINER,
    SOLARBANK,
    controls_for_type,
    extract_entities,
    should_include_device,
)
from solixapi.export import AnkerSolixApiExport  # noqa: E402
from solixapi import errors  # noqa: E402
from solixapi.api import AnkerSolixApi  # noqa: E402
from solixapi.apitypes import ApiCategories, SolixDeviceType  # noqa: E402

_LOGGER = logging.getLogger("anker-solix-bridge")

DEFAULT_EXCLUDE = [
    ApiCategories.solarbank_energy,
    ApiCategories.solarbank_pps_energy,
    ApiCategories.smartmeter_energy,
    ApiCategories.solar_energy,
    ApiCategories.smartplug_energy,
    ApiCategories.charger_energy,
    ApiCategories.powerpanel_energy,
    ApiCategories.hes_energy,
]


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    return str(value)


def device_info(ctx_id: str, data: dict) -> dict[str, str]:
    dev_type = str(data.get("type") or data.get("device_type") or "unknown").lower()
    name = (
        data.get("device_name")
        or data.get("site_name")
        or data.get("alias")
        or ctx_id
    )
    return {
        "id": ctx_id,
        "type": dev_type,
        "name": str(name),
        "site_id": str(data.get("site_id") or ""),
        "model": str(data.get("model") or data.get("product_code") or ""),
    }


def _auth_error_message(api: AnkerSolixApi, country: str) -> str:
    resp = getattr(api.apisession, "_login_response", None) or {}
    detail = resp.get("msg") or resp.get("message") or ""
    base = "Authentication failed"
    if detail:
        base = f"{base}: {detail}"
    return (
        f"{base} (country={country}). "
        "Check Anker app e-mail/password and country code in adapter config."
    )


async def _get_api(config: dict) -> tuple[AnkerSolixApi, ClientSession]:
    email = str(config.get("username") or "").strip()
    password = str(config.get("password") or "")
    country = (config.get("country") or "DE").upper()
    if not email or not password:
        raise errors.InvalidCredentialsError("Username or password empty in adapter config")

    cache_dir = Path(config.get("cacheDir") or Path(__file__).parent / "authcache")
    cache_dir.mkdir(parents=True, exist_ok=True)
    session = ClientSession()
    api = AnkerSolixApi(email, password, country, session, _LOGGER)
    api.apisession._authFile = str(cache_dir / f"{email}.json")

    # Cached token may be expired/invalid – retry once with fresh login (like HA integration)
    if not await api.async_authenticate():
        if not await api.async_authenticate(restart=True):
            raise errors.InvalidCredentialsError(_auth_error_message(api, country))
    return api, session


def _control_context(api: AnkerSolixApi, device_id: str) -> tuple[str, str, str, dict]:
    """Resolve site_id, station/control SN, and device cache entry (HA multisystem logic)."""
    device = api.devices.get(device_id) or api.sites.get(device_id) or {}
    site_id = str(device.get("site_id") or device_id)
    dev_type = str(device.get("type") or "").lower()
    station_sn = str(device.get("station_sn") or "")
    if dev_type == COMBINER or dev_type == SolixDeviceType.COMBINER_BOX.value:
        control_sn = device_id
    elif station_sn:
        control_sn = station_sn
    else:
        control_sn = device_id
    return site_id, control_sn, device_id, device


async def _set_min_soc(
    api: AnkerSolixApi,
    site_id: str,
    control_sn: str,
    device_id: str,
    device: dict,
    soc: int,
) -> bool | dict:
    dev_type = str(device.get("type") or "").lower()
    station_sn = device.get("station_sn")
    if dev_type == COMBINER or station_sn:
        return await api.set_station_parm(
            siteId=site_id,
            deviceSn=control_sn,
            socReserve=soc,
        )
    cutoff_data = device.get("power_cutoff_data") or []
    set_id = next(
        (
            item.get("id")
            for item in cutoff_data
            if str(item.get("soc") or item.get("output_cutoff_data") or "") == str(soc)
        ),
        None,
    )
    if set_id is None and cutoff_data:
        set_id = cutoff_data[0].get("id")
    if set_id is None:
        return False
    return await api.set_power_cutoff(deviceSn=device_id, setId=int(set_id))


async def apply_control(api: AnkerSolixApi, device_id: str, control: str, value: Any) -> None:
    site_id, control_sn, device_id, device = _control_context(api, device_id)
    dev_type = str(device.get("type") or "").lower()

    if control == "allow_grid_export":
        # Station/combiner + all related devices via set_power_limit (HA switch.py)
        result = await api.set_power_limit(
            siteId=site_id,
            deviceSn=device_id,
            grid_export=bool(value),
        )
    elif control == "preset_allow_export":
        result = await api.set_home_load(
            siteId=site_id,
            deviceSn=device_id,
            export=bool(value),
        )
    elif control == "set_output_power":
        load = int(value)
        if dev_type == SOLARBANK and int(device.get("generation") or 0) < 2:
            result = await api.set_home_load(
                siteId=site_id,
                deviceSn=device_id,
                preset=load,
            )
        else:
            result = await api.set_sb2_home_load(
                siteId=site_id,
                deviceSn=device_id,
                preset=load,
            )
    elif control == "ac_output_limit":
        result = await api.set_power_limit(
            siteId=site_id,
            deviceSn=control_sn,
            ac_output=int(value),
        )
    elif control == "pv_input_limit":
        result = await api.set_power_limit(
            siteId=site_id,
            deviceSn=device_id,
            pv_input=int(value),
        )
    elif control == "ac_charge_limit":
        result = await api.set_power_limit(
            siteId=site_id,
            deviceSn=device_id,
            ac_input=int(value),
        )
    elif control == "min_soc":
        result = await _set_min_soc(
            api, site_id, control_sn, device_id, device, int(value)
        )
    elif control == "grid_export_limit":
        limit = int(value)
        if limit < 100 or limit > 100000:
            raise ValueError("grid_export_limit must be between 100 and 100000 W")
        result = await api.set_station_parm(
            siteId=site_id,
            deviceSn=control_sn,
            gridExportLimit=limit,
        )
    else:
        raise ValueError(f"Unsupported control: {control}")

    if result is False:
        raise RuntimeError(f"Control '{control}' was rejected by the API")


def build_device_list(api: AnkerSolixApi, caches: dict) -> dict:
    sites: list[dict] = []
    devices: list[dict] = []
    for site_id, site in (api.sites or {}).items():
        if isinstance(site, dict):
            sites.append(
                {
                    "id": str(site_id),
                    "name": str(site.get("site_name") or site_id),
                }
            )
    for ctx_id, ctx_data in caches.items():
        if not isinstance(ctx_data, dict):
            continue
        info = device_info(str(ctx_id), ctx_data)
        if info["type"] in ("site", "system") and ctx_id not in [s["id"] for s in sites]:
            sites.append({"id": info["id"], "name": info["name"]})
        if info["type"] not in ("site", "system", "unknown"):
            devices.append(info)
    return {"sites": sites, "devices": devices}


async def run_list_devices(config: dict) -> dict:
    exclude = config.get("exclude") or DEFAULT_EXCLUDE
    api, session = await _get_api(config)
    try:
        await api.update_sites(exclude=set(exclude))
        await api.update_device_details(exclude=set(exclude))
        caches = api.getCaches()
        listing = build_device_list(api, caches)
        return {"ok": True, **listing, "nickname": api.apisession.nickname}
    finally:
        await session.close()


async def run_service(config: dict) -> dict:
    service = str(config.get("service") or "")
    params = config.get("params") or {}
    device_id = str(params.get("deviceId") or config.get("selectedDeviceId") or "")
    site_id = str(params.get("siteId") or config.get("selectedSiteId") or "")

    api, session = await _get_api(config)
    try:
        await api.update_sites(exclude=set(DEFAULT_EXCLUDE))
        await api.update_device_details(exclude=set(DEFAULT_EXCLUDE))

        if service == "get_schedule":
            device = api.devices.get(device_id) or {}
            site_id = site_id or device.get("site_id") or ""
            schedule = device.get("schedule")
            if not schedule and site_id and device_id:
                schedule = await api.get_device_load(siteId=site_id, deviceSn=device_id)
            return {"ok": True, "schedule": _json_safe(schedule or {})}

        if service == "clear_schedule":
            device = api.devices.get(device_id) or {}
            site_id = site_id or device.get("site_id") or ""
            result = await api.set_home_load(
                siteId=site_id,
                deviceSn=device_id,
                export=False,
                preset=0,
            )
            return {"ok": bool(result), "result": _json_safe(result or {})}

        if service == "export_systems":
            export_dir = Path(config.get("cacheDir") or ".") / "exports"
            export_dir.mkdir(parents=True, exist_ok=True)
            exporter = AnkerSolixApiExport(api, _LOGGER)
            ok = await exporter.export_data(
                export_path=str(export_dir.parent),
                export_folder=export_dir.name,
                randomized=True,
                mqttdata=bool(params.get("includeMqtt", True)),
                zipped=True,
            )
            zip_path = getattr(exporter, "zipfilename", None) or str(export_dir)
            return {"ok": bool(ok), "path": str(zip_path)}

        if service == "get_system_info":
            site = api.sites.get(site_id) or {}
            return {
                "ok": True,
                "system": _json_safe(
                    {
                        "site": site,
                        "devices": {
                            k: v
                            for k, v in api.devices.items()
                            if (v.get("site_id") or "") == site_id or not site_id
                        },
                    }
                ),
            }

        raise ValueError(f"Unknown service: {service}")
    finally:
        await session.close()


async def run_poll(config: dict) -> dict:
    mqtt_usage = bool(config.get("mqttUsage", True))
    exclude = config.get("exclude") or DEFAULT_EXCLUDE
    api, session = await _get_api(config)
    try:
        await api.update_sites(exclude=set(exclude))
        await api.update_device_details(exclude=set(exclude))
        await api.update_site_details(exclude=set(exclude))

        if mqtt_usage:
            try:
                await api.startMqttSession()
            except Exception as mqtt_exc:  # noqa: BLE001
                _LOGGER.warning("MQTT session not started: %s", mqtt_exc)

        caches = api.getCaches()
        devices: list[dict] = []

        for ctx_id, ctx_data in caches.items():
            if not isinstance(ctx_data, dict):
                continue
            info = device_info(str(ctx_id), ctx_data)
            if not should_include_device(str(ctx_id), ctx_data, info, config):
                continue
            entities = extract_entities(ctx_data)
            writable = controls_for_type(info["type"])
            if not entities and not writable:
                continue
            devices.append(
                {
                    "info": info,
                    "entities": _json_safe(entities),
                    "writable": writable,
                }
            )

        return {
            "ok": True,
            "nickname": api.apisession.nickname or config["username"],
            "devices": devices,
        }
    finally:
        await session.close()


async def run_set(config: dict) -> dict:
    api, session = await _get_api(config)
    try:
        await apply_control(
            api,
            str(config["deviceId"]),
            str(config["control"]),
            config["value"],
        )
        return {"ok": True}
    finally:
        await session.close()


async def run_login(config: dict) -> dict:
    api, session = await _get_api(config)
    try:
        nickname = api.apisession.nickname or config["username"]
        return {"ok": True, "nickname": nickname}
    finally:
        await session.close()


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "action",
        choices=["poll", "login", "set", "list_devices", "service"],
    )
    parser.add_argument("config_file", nargs="?", default="-")
    args = parser.parse_args()

    if args.config_file == "-":
        raw = sys.stdin.read()
    else:
        raw = Path(args.config_file).read_text(encoding="utf-8-sig")

    config = json.loads(raw or "{}")
    logging.basicConfig(level=logging.WARNING)

    try:
        if args.action == "login":
            payload = await run_login(config)
        elif args.action == "set":
            payload = await run_set(config)
        elif args.action == "list_devices":
            payload = await run_list_devices(config)
        elif args.action == "service":
            payload = await run_service(config)
        else:
            payload = await run_poll(config)
        print(json.dumps(payload, ensure_ascii=False))
        return 0
    except Exception as exc:  # noqa: BLE001
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": f"{type(exc).__name__}: {exc}",
                },
                ensure_ascii=False,
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
