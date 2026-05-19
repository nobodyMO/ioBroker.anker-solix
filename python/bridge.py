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

from solixapi import errors  # noqa: E402
from solixapi.api import AnkerSolixApi  # noqa: E402
from solixapi.apitypes import ApiCategories, SolixDefaults  # noqa: E402

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

# Keys commonly used for energy monitoring (HA integration sensor names)
PRIORITY_KEYS = {
    "solar_power",
    "output_power",
    "battery_power",
    "grid_power",
    "home_power",
    "battery_soc",
    "total_soc",
    "charge_power",
    "discharge_power",
    "cloud_state",
    "wifi_state",
    "device_name",
    "device_type",
    "model",
    "site_name",
    "nickname",
}


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    return str(value)


def flatten_states(
    data: dict,
    *,
    prefix: str = "",
    max_depth: int = 5,
    depth: int = 0,
) -> dict[str, Any]:
    """Flatten nested cache dict to ioBroker-friendly primitive states."""
    states: dict[str, Any] = {}
    if depth > max_depth or not isinstance(data, dict):
        return states

    for key, value in data.items():
        if key in ("customized", "raw", "mqtt_cache"):
            continue
        path = f"{prefix}.{key}" if prefix else str(key)
        if isinstance(value, dict):
            if depth < max_depth:
                states.update(
                    flatten_states(value, prefix=path, max_depth=max_depth, depth=depth + 1)
                )
            if path.split(".")[-1] in PRIORITY_KEYS or any(
                pk in path for pk in PRIORITY_KEYS
            ):
                states[f"{path}__json"] = json.dumps(_json_safe(value), ensure_ascii=False)
        elif isinstance(value, list):
            if len(value) < 20:
                states[path] = json.dumps(_json_safe(value), ensure_ascii=False)
        elif value is not None:
            states[path] = value

    return states


def context_meta(data: dict) -> dict[str, str]:
    meta: dict[str, str] = {}
    for field in ("device_type", "type", "site_type", "model", "device_name", "site_name"):
        if data.get(field):
            meta[field] = str(data[field])
    if data.get("sn"):
        meta["serial"] = str(data["sn"])
    if data.get("site_id"):
        meta["site_id"] = str(data["site_id"])
    return meta


async def run_poll(config: dict) -> dict:
    email = config["username"]
    password = config["password"]
    country = (config.get("country") or "DE").upper()
    mqtt_usage = bool(config.get("mqttUsage", True))
    exclude = config.get("exclude") or DEFAULT_EXCLUDE
    cache_dir = Path(config.get("cacheDir") or Path(__file__).parent / "authcache")
    cache_dir.mkdir(parents=True, exist_ok=True)

    async with ClientSession() as session:
        api = AnkerSolixApi(email, password, country, session, _LOGGER)
        api.apisession._authFile = str(cache_dir / f"{email}.json")

        if not await api.async_authenticate():
            raise errors.InvalidCredentialsError("Authentication failed")

        await api.update_sites(exclude=set(exclude))
        await api.update_device_details(exclude=set(exclude))
        await api.update_site_details(exclude=set(exclude))

        if mqtt_usage:
            try:
                await api.startMqttSession()
            except Exception as mqtt_exc:  # noqa: BLE001
                _LOGGER.warning("MQTT session not started: %s", mqtt_exc)

        caches = api.getCaches()
        contexts: dict[str, dict] = {}

        for ctx_id, ctx_data in caches.items():
            if not isinstance(ctx_data, dict):
                continue
            states = flatten_states(ctx_data)
            contexts[str(ctx_id)] = {
                "meta": context_meta(ctx_data),
                "states": _json_safe(states),
            }

        return {
            "ok": True,
            "nickname": api.apisession.nickname or email,
            "contexts": contexts,
        }


async def run_login(config: dict) -> dict:
    result = await run_poll({**config, "mqttUsage": False})
    return {"ok": True, "nickname": result.get("nickname")}


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["poll", "login"])
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
    finally:
        # stop mqtt if started
        pass


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
