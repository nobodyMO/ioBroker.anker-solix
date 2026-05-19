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

from entities import CONTROL_ENTITIES, extract_entities, should_include_device  # noqa: E402
from solixapi.export import AnkerSolixApiExport  # noqa: E402
from solixapi import errors  # noqa: E402
from solixapi.api import AnkerSolixApi  # noqa: E402
from solixapi.apitypes import ApiCategories  # noqa: E402

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


async def _get_api(config: dict) -> tuple[AnkerSolixApi, ClientSession]:
    email = config["username"]
    password = config["password"]
    country = (config.get("country") or "DE").upper()
    cache_dir = Path(config.get("cacheDir") or Path(__file__).parent / "authcache")
    cache_dir.mkdir(parents=True, exist_ok=True)
    session = ClientSession()
    api = AnkerSolixApi(email, password, country, session, _LOGGER)
    api.apisession._authFile = str(cache_dir / f"{email}.json")
    if not await api.async_authenticate():
        raise errors.InvalidCredentialsError("Authentication failed")
    return api, session


async def apply_control(api: AnkerSolixApi, device_id: str, control: str, value: Any) -> None:
    device = api.devices.get(device_id) or api.sites.get(device_id) or {}
    site_id = device.get("site_id") or device_id
    dev_type = str(device.get("type") or "").lower()

    if control == "allow_grid_export":
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
        if dev_type in ("solarbank",):
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
    elif control == "min_soc":
        result = await api.set_station_parm(
            siteId=site_id,
            deviceSn=device_id,
            socReserve=int(value),
        )
    elif control == "grid_export_limit":
        result = await api.set_station_parm(
            siteId=site_id,
            deviceSn=device_id,
            gridExportLimit=int(value),
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
            entities = extract_entities(ctx_data)
            if not entities:
                continue
            info = device_info(str(ctx_id), ctx_data)
            if not should_include_device(str(ctx_id), ctx_data, info, config):
                continue
            writable = [
                spec["id"]
                for spec in CONTROL_ENTITIES
                if spec["id"] in entities
                and (not info["type"] or info["type"] in spec.get("types", []))
            ]
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
