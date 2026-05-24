#!/usr/bin/env python3
"""Bridge between ioBroker adapter and Anker Solix API (same library as HA integration)."""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
import logging
import sys
from pathlib import Path
from typing import Any

from aiohttp import ClientSession

# solixapi is vendored from https://github.com/thomluther/ha-anker-solix
sys.path.insert(0, str(Path(__file__).parent))

from entity_groups import (
    GROUP_ENERGY_DETAIL,
    GROUP_ENERGY_STATISTICS,
    GROUP_ENERGY_STATISTICS_MONTH,
    GROUP_ENERGY_STATISTICS_WEEK,
    GROUP_ENERGY_STATISTICS_YEAR,
    enabled_entity_groups,
)
from combiner_soc import enrich_combiner_soc
from energy_statistics import (
    build_site_has_combiner,
    device_exposes_energy_statistics,
)
from entities import (  # noqa: E402
    COMBINER,
    SOLARBANK,
    controls_for_type,
    enrich_combiner_station_fields,
    extract_entities,
    max_total_ac_output_options,
    parse_usage_mode_set_value,
    should_include_device,
    usage_mode_name,
    writable_controls_for_device,
)
from ha_api_client import (  # noqa: E402
    DEFAULT_DELAY_TIME,
    DEFAULT_EXCLUDE_CATEGORIES,
    IoBrokerAnkerApiClient,
)
from solixapi.export import AnkerSolixApiExport  # noqa: E402
from solixapi import errors  # noqa: E402
from solixapi.api import AnkerSolixApi  # noqa: E402
from datetime import datetime

from solixapi.apitypes import (  # noqa: E402
    ApiCategories,
    SolixDeviceType,
    SolixParmType,
    Solarbank2Timeslot,
    SolarbankRatePlan,
    SolarbankUsageMode,
)
from solixapi.mqtt_factory import SolixMqttDeviceFactory  # noqa: E402
from solixapi.mqttcmdmap import SolixMqttCommands  # noqa: E402

_LOGGER = logging.getLogger("anker-solix-bridge")

DEFAULT_EXCLUDE = DEFAULT_EXCLUDE_CATEGORIES


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    return str(value)


def device_info(ctx_id: str, data: dict) -> dict[str, str | int]:
    dev_type = str(data.get("type") or data.get("device_type") or "unknown").lower()
    name = (
        data.get("device_name")
        or data.get("site_name")
        or data.get("alias")
        or ctx_id
    )
    generation = data.get("generation")
    return {
        "id": ctx_id,
        "type": dev_type,
        "name": str(name),
        "site_id": str(data.get("site_id") or ""),
        "model": str(data.get("model") or data.get("product_code") or ""),
        "device_pn": str(data.get("device_pn") or data.get("product_code") or ""),
        "station_sn": str(data.get("station_sn") or ""),
        "generation": int(generation) if generation is not None else 0,
    }


def _is_captcha_error(exc: BaseException) -> bool:
    text = str(exc).lower()
    return "100032" in text or "captcha" in text


def _auth_error_message(
    api: AnkerSolixApi, country: str, email: str, *, captcha: bool = False
) -> str:
    if captcha:
        return (
            "Anker cloud requires captcha verification for API login (100032). "
            "Log in with the official Anker/Solix app on the same network, wait a few minutes, "
            "then restart the adapter. Avoid VPN on the ioBroker host. "
            "If Home Assistant (ha-anker-solix) works on the same account, copy its login cache "
            f"file to this instance authcache folder as {email}.json "
            "(HA path: custom_components/anker_solix/solixapi/authcache/ or integration storage). "
            f"Country in config must match the account ({country})."
        )
    resp = getattr(api.apisession, "_login_response", None) or {}
    detail = resp.get("msg") or resp.get("message") or ""
    base = "Authentication failed"
    if detail:
        base = f"{base}: {detail}"
    return (
        f"{base} (country={country}). "
        "Check Anker app e-mail/password and country code in adapter config."
    )


def _purge_invalid_auth_cache(api: AnkerSolixApi) -> None:
    """Remove login cache if it cannot yield a valid session (forces clean re-login)."""
    auth_path = Path(getattr(api.apisession, "_authFile", "") or "")
    if not auth_path.is_file():
        return
    try:
        data = json.loads(auth_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        data = {}
    if data.get("user_id") and data.get("auth_token"):
        return
    with contextlib.suppress(OSError):
        auth_path.unlink()
    _LOGGER.warning("Removed invalid Anker login cache: %s", auth_path)


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
    api.apisession.requestDelay(float(config.get("requestDelay") or DEFAULT_DELAY_TIME))

    _purge_invalid_auth_cache(api)
    try:
        if not await api.async_authenticate():
            if not await api.async_authenticate(restart=True):
                raise errors.InvalidCredentialsError(
                    _auth_error_message(api, country, email)
                )
    except errors.CaptchaRequiredError:
        raise errors.CaptchaRequiredError(
            _auth_error_message(api, country, email, captcha=True)
        ) from None
    except errors.AnkerSolixError as exc:
        if _is_captcha_error(exc):
            raise errors.CaptchaRequiredError(
                _auth_error_message(api, country, email, captcha=True)
            ) from exc
        raise
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


def _seed_device_context(api: AnkerSolixApi, device_id: str, config: dict) -> None:
    """Populate API device cache from adapter poll context (avoids extra site refresh on set)."""
    meta = config.get("deviceContext") or {}
    if not meta:
        return
    dev_type = str(meta.get("type") or "").lower()
    entry = {
        "device_sn": device_id,
        "type": dev_type,
        "site_id": meta.get("site_id") or "",
        "device_pn": meta.get("device_pn") or "",
        "product_code": meta.get("device_pn") or "",
        "station_sn": meta.get("station_sn") or "",
        "generation": int(meta.get("generation") or 0),
        "mqtt_supported": True,
    }
    if dev_type == COMBINER:
        cached = api.devices.get(device_id) or {}
        for key in ("all_power_limit", "max_load_total", "power_limit_option"):
            if key in cached:
                entry[key] = cached[key]
    api.devices[device_id] = {**(api.devices.get(device_id) or {}), **entry}
    site_id = entry.get("site_id")
    if site_id and site_id not in api.sites:
        api.sites[site_id] = {"site_id": site_id}


async def _ensure_mqtt(api: AnkerSolixApi) -> bool:
    try:
        session = await api.startMqttSession()
        return session is not None and session.is_connected()
    except Exception as exc:  # noqa: BLE001
        _LOGGER.warning("MQTT session unavailable for control: %s", exc)
        return False


async def _mqtt_command(
    api: AnkerSolixApi,
    device_sn: str,
    cmd: str,
    value: int,
    parm: str,
    ha_client: IoBrokerAnkerApiClient | None = None,
    parm_map: dict[str, Any] | None = None,
) -> bool:
    mdev = (ha_client.get_mqtt_device(device_sn) if ha_client else None) or (
        SolixMqttDeviceFactory(api, device_sn).create_device()
    )
    if not mdev or cmd not in (mdev.controls or {}):
        return False
    if ha_client:
        if not api.mqttsession or not api.mqttsession.is_connected():
            await ha_client.check_mqtt_session()
    elif not await _ensure_mqtt(api):
        return False
    resp = await mdev.run_command(
        cmd=cmd,
        value=value,
        parm=parm,
        parm_map=parm_map,
    )
    return bool(resp)


# Combiner parallel max load via MQTT (discrete steps only; arbitrary watts need schedule API).
_DEFAULT_PARALLEL_MQTT_OPTIONS = [1200, 2400, 3600, 4800]


def _schedule_device_candidates(
    api: AnkerSolixApi, site_id: str, device_id: str, device: dict
) -> list[str]:
    """Device SNs to try for param_type 6 (manual preset); combiner first, then main solarbank."""
    seen: set[str] = set()
    order: list[str] = []

    def add(sn: str | None) -> None:
        if sn and sn not in seen:
            seen.add(sn)
            order.append(sn)

    add(device_id)
    dev_type = str(device.get("type") or "").lower()
    if dev_type == COMBINER or dev_type == SolixDeviceType.COMBINER_BOX.value:
        station_sn = str(device.get("station_sn") or "")
        add(station_sn if station_sn else None)
        for sn, dev in api.devices.items():
            if (dev.get("site_id") or "") != site_id:
                continue
            if str(dev.get("type") or "").lower() != SOLARBANK:
                continue
            if int(dev.get("generation") or 0) < 2:
                continue
            sb_station = str(dev.get("station_sn") or "")
            if not sb_station or sb_station == sn:
                add(sn)
    return order


async def _ensure_device_schedule(
    api: AnkerSolixApi, site_id: str, device_sn: str
) -> None:
    """Load schedule into API cache before set_sb2_home_load (avoids invalid param_data / 10004)."""
    dev = api.devices.get(device_sn) or {}
    if dev.get("schedule"):
        return
    try:
        await api.get_device_parm(
            siteId=site_id,
            paramType=SolixParmType.SOLARBANK_2_SCHEDULE.value,
            deviceSn=device_sn,
        )
    except errors.RequestError:
        pass
    if not (api.devices.get(device_sn) or {}).get("schedule"):
        with contextlib.suppress(errors.RequestError):
            await api.get_device_load(siteId=site_id, deviceSn=device_sn)


def _parallel_mqtt_options(api: AnkerSolixApi, control_sn: str, device: dict) -> list[int]:
    dev = api.devices.get(control_sn) or device
    raw = dev.get("max_load_parallel_options")
    if isinstance(raw, list) and raw:
        opts = sorted({int(x) for x in raw if str(x).isdigit()})
        if opts:
            return opts
    return list(_DEFAULT_PARALLEL_MQTT_OPTIONS)


async def _set_ac_output_via_schedule(
    api: AnkerSolixApi,
    site_id: str,
    device_id: str,
    device: dict,
    limit: int,
    *,
    with_manual_mode: bool = True,
) -> bool:
    """Manual schedule export (param_type 6) — arbitrary W without MQTT (AnkerSolix2 / set_output_power)."""
    for sn in _schedule_device_candidates(api, site_id, device_id, device):
        await _ensure_device_schedule(api, site_id, sn)
        cached = (api.devices.get(sn) or {}).get("schedule") or {}
        has_plan = bool(
            cached.get(SolarbankRatePlan.manual) or cached.get("custom_rate_plan")
        )
        kwargs: dict[str, Any] = {"siteId": site_id, "deviceSn": sn}
        if with_manual_mode:
            kwargs["usage_mode"] = SolarbankUsageMode.manual.value
        if not has_plan:
            kwargs["set_slot"] = Solarbank2Timeslot(
                start_time=datetime.strptime("00:00", "%H:%M"),
                end_time=datetime.strptime("23:59", "%H:%M"),
                appliance_load=limit,
            )
        else:
            kwargs["preset"] = limit
        try:
            resp = await api.set_sb2_home_load(**kwargs)
            if isinstance(resp, dict):
                _LOGGER.info(
                    "ac_output_limit %sW via schedule API (device_sn=%s)",
                    limit,
                    sn,
                )
                return True
        except errors.ItemNotFoundError:
            continue
        _LOGGER.debug(
            "set_sb2_home_load preset=%sW rejected for device_sn=%s",
            limit,
            sn,
        )
    return False


def _stamp_max_total_ac_output_cache(
    api: AnkerSolixApi,
    site_id: str,
    device_id: str,
    device: dict,
    limit: int,
    ha_client: IoBrokerAnkerApiClient | None = None,
) -> list[str]:
    """Persist MQTT-applied grid max AC in bridge cache (cloud all_power_limit may differ)."""
    from max_total_ac_cache import stamp_max_total_ac_for_site  # noqa: PLC0415

    sns = stamp_max_total_ac_for_site(api, site_id, device_id, device, limit)
    if ha_client:
        ha_client.record_max_total_ac_applied(sns, limit)
    return sns


async def _refresh_max_load_mqtt_status(
    api: AnkerSolixApi,
    ha_client: IoBrokerAnkerApiClient | None,
    device_sns: list[str],
) -> None:
    """Ask devices for fresh MQTT status after max-load change."""
    if not ha_client:
        return
    for sn in device_sns:
        mdev = ha_client.get_mqtt_device(sn)
        if not mdev:
            continue
        with contextlib.suppress(Exception):
            await mdev.status_request()
    with contextlib.suppress(Exception):
        api.update_device_mqtt()
    if ha_client:
        ha_client.reapply_max_total_ac_stamps()


async def _mqtt_max_load_parallel(
    api: AnkerSolixApi,
    site_id: str,
    limit: int,
    primary_sn: str,
    ha_client: IoBrokerAnkerApiClient | None = None,
) -> bool:
    """HA max_load_total: parallel max load on combiner or any site solarbank."""
    if await _mqtt_command(
        api,
        primary_sn,
        SolixMqttCommands.sb_max_load_parallel,
        limit,
        "set_max_load",
        ha_client=ha_client,
    ):
        return True
    for sn, dev in api.devices.items():
        if (dev.get("site_id") or "") != site_id:
            continue
        if str(dev.get("type") or "").lower() != SOLARBANK:
            continue
        if sn == primary_sn:
            continue
        if await _mqtt_command(
            api,
            sn,
            SolixMqttCommands.sb_max_load_parallel,
            limit,
            "set_max_load",
            ha_client=ha_client,
        ):
            return True
    return False


async def _api_set_ac_output_only(
    api: AnkerSolixApi,
    site_id: str,
    device_sn: str,
    limit: int,
    device: dict,
) -> bool:
    """Apply AC output limit without follow-up get_power_limit (avoids 10004 on some sites)."""
    dev = api.devices.get(device_sn, {}) | device
    dev_type = str(dev.get("type") or "").lower()
    use_parm = (
        dev_type in (COMBINER, SolixDeviceType.COMBINER_BOX.value)
        or dev.get("station_sn")
        or int(dev.get("generation") or 0) >= 3
    )
    try:
        if use_parm:
            resp = await api.set_device_parm(
                siteId=site_id,
                paramType=SolixParmType.SOLARBANK_POWER_LIMIT.value,
                paramData={
                    "power_limit": {"limit": limit, "limit_real": limit},
                },
                deviceSn=device_sn,
            )
            return isinstance(resp, dict)
        resp = await api.set_device_attributes(
            deviceSn=device_sn,
            attributes={"power_limit": limit},
        )
        return isinstance(resp, dict)
    except errors.ItemNotFoundError:
        return False


async def _set_ac_output_limit(
    api: AnkerSolixApi,
    site_id: str,
    control_sn: str,
    device_id: str,
    device: dict,
    limit: int,
    ha_client: IoBrokerAnkerApiClient | None = None,
    api_only: bool = False,
) -> Any:
    """Set AC export/output limit via schedule API (arbitrary W). Never uses MQTT max total AC."""
    dev_type = str(device.get("type") or "").lower()
    station_sn = device.get("station_sn")
    generation = int(device.get("generation") or 0)
    multisystem = dev_type == COMBINER or "all_power_limit" in device
    use_schedule_api = (
        multisystem or bool(station_sn) or generation >= 3
    )
    schedule_ok = False

    if use_schedule_api and not api_only:
        schedule_ok = await _set_ac_output_via_schedule(
            api, site_id, device_id, device, limit, with_manual_mode=True
        )

    api_ok = False
    if not schedule_ok and not api_only:
        api_sn = (
            control_sn
            if multisystem or station_sn or generation >= 3
            else device_id
        )
        api_ok = await _api_set_ac_output_only(api, site_id, api_sn, limit, device)

    if api_only and api_ok:
        return {"api": True, "curtailment_api_only": True}
    if schedule_ok:
        return {"schedule": True, "preset": limit, "api": api_ok}
    if api_ok:
        return {"api": True}
    hint = (
        "schedule/API failed for ac_output_limit"
        if use_schedule_api
        else "ac_output_limit rejected (check device online)"
    )
    raise RuntimeError(hint)


async def _api_set_ac_input_only(
    api: AnkerSolixApi,
    device_sn: str,
    limit: int,
) -> bool:
    """Set AC charge limit via device attributes only (no get_power_limit refresh)."""
    try:
        resp = await api.set_device_attributes(
            deviceSn=device_sn,
            attributes={"ac_power_limit": limit},
        )
        return isinstance(resp, dict)
    except errors.ItemNotFoundError:
        return False


async def _set_ac_charge_limit(
    api: AnkerSolixApi,
    site_id: str,
    device_id: str,
    limit: int,
    ha_client: IoBrokerAnkerApiClient | None = None,
) -> Any:
    """HA preset_ac_input_limit: sb_ac_input_limit (SB2/3) or ac_charge_limit MQTT, then API."""
    device = api.devices.get(device_id) or {}
    if str(device.get("type") or "").lower() == COMBINER:
        try:
            resp = await api.set_power_limit(
                siteId=site_id,
                deviceSn=device_id,
                ac_input=limit,
            )
            if resp is not False:
                return resp
        except errors.ItemNotFoundError:
            pass
    mqtt_cmds = (
        (SolixMqttCommands.sb_ac_input_limit, "set_ac_input_limit"),
        (SolixMqttCommands.ac_charge_limit, "set_ac_input_limit"),
    )
    for cmd, parm in mqtt_cmds:
        if await _mqtt_command(
            api, device_id, cmd, limit, parm, ha_client=ha_client
        ):
            await _api_set_ac_input_only(api, device_id, limit)
            return {"mqtt": True, "cmd": cmd}
    api_ok = await _api_set_ac_input_only(api, device_id, limit)
    if api_ok:
        return {"api": True}
    try:
        resp = await api.set_power_limit(
            siteId=site_id,
            deviceSn=device_id,
            ac_input=limit,
        )
        if resp is not False:
            return resp
    except errors.ItemNotFoundError:
        pass
    raise RuntimeError(
        "ac_charge_limit rejected (MQTT/API failed; ensure MQTT is on and device is online)"
    )


async def _set_preset_usage_mode(
    api: AnkerSolixApi,
    site_id: str,
    device_id: str,
    device: dict,
    value: Any,
) -> Any:
    """HA preset_usage_mode via set_sb2_home_load (combiner or main solarbank)."""
    mode_name = parse_usage_mode_set_value(value)
    usage_mode = getattr(SolarbankUsageMode, mode_name, None)
    if usage_mode is None:
        raise ValueError(f"Unsupported usage mode: {mode_name}")
    options = api.solarbank_usage_mode_options(deviceSn=device_id)
    if mode_name not in options and mode_name != SolarbankUsageMode.manual.name:
        raise ValueError(
            f"Usage mode '{mode_name}' not available for this system (options: {sorted(options)})"
        )
    if usage_mode == SolarbankUsageMode.backup:
        return await api.set_sb2_ac_charge(
            siteId=site_id,
            deviceSn=device_id,
            backup_switch=True,
        )
    current = usage_mode_name(device.get("preset_usage_mode")) or usage_mode_name(
        (device.get("schedule") or {}).get("mode_type")
    )
    if current == SolarbankUsageMode.backup.name:
        await api.set_sb2_ac_charge(
            siteId=site_id,
            deviceSn=device_id,
            backup_switch=False,
            test_schedule=device.get("schedule") or {},
        )
    return await api.set_sb2_home_load(
        siteId=site_id,
        deviceSn=device_id,
        usage_mode=usage_mode.value,
    )


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


async def apply_control(
    api: AnkerSolixApi,
    device_id: str,
    control: str,
    value: Any,
    ha_client: IoBrokerAnkerApiClient | None = None,
    config: dict | None = None,
) -> None:
    config = config or {}
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
        result = await _set_ac_output_limit(
            api,
            site_id,
            control_sn,
            device_id,
            device,
            int(value),
            ha_client=ha_client,
            api_only=bool(config.get("acOutputApiOnly")),
        )
    elif control == "max_total_ac_output":
        limit = int(value)
        multisystem = dev_type == COMBINER or "all_power_limit" in device
        if multisystem:
            opts = _parallel_mqtt_options(api, control_sn, device)
            if limit not in opts:
                raise ValueError(f"max_total_ac_output must be one of {opts}")
            mqtt_ok = await _mqtt_max_load_parallel(
                api, site_id, limit, control_sn, ha_client=ha_client
            )
            if not mqtt_ok:
                raise RuntimeError(
                    "max_total_ac_output rejected (enable MQTT in adapter settings)"
                )
            stamped = _stamp_max_total_ac_output_cache(
                api, site_id, device_id, device, limit, ha_client=ha_client
            )
            await _refresh_max_load_mqtt_status(api, ha_client, stamped)
            _LOGGER.info(
                "max_total_ac_output %sW applied via MQTT (cloud all_power_limit may still show app limit)",
                limit,
            )
            result = {"mqtt": True, "max_total_ac_output": limit}
        elif dev_type == SOLARBANK:
            opts = max_total_ac_output_options(device, SOLARBANK, api, device_id)
            if limit not in opts:
                raise ValueError(f"max_total_ac_output must be one of {opts}")
            mqtt_ok = await _mqtt_command(
                api,
                device_id,
                SolixMqttCommands.sb_max_load,
                limit,
                "set_max_load",
                ha_client=ha_client,
            )
            if not mqtt_ok:
                raise RuntimeError(
                    "max_total_ac_output rejected (enable MQTT in adapter settings)"
                )
            stamped = _stamp_max_total_ac_output_cache(
                api, site_id, device_id, device, limit, ha_client=ha_client
            )
            await _refresh_max_load_mqtt_status(api, ha_client, stamped)
            _LOGGER.info("max_total_ac_output %sW applied via MQTT on solarbank", limit)
            result = {"mqtt": True, "max_total_ac_output": limit}
        else:
            raise ValueError("max_total_ac_output not supported for this device type")
    elif control == "pv_input_limit":
        result = await api.set_power_limit(
            siteId=site_id,
            deviceSn=device_id,
            pv_input=int(value),
        )
    elif control == "ac_charge_limit":
        result = await _set_ac_charge_limit(
            api,
            site_id,
            device_id,
            int(value),
            ha_client=ha_client,
        )
    elif control == "preset_usage_mode":
        result = await _set_preset_usage_mode(
            api, site_id, device_id, device, value
        )
    elif control == "ac_fast_charge_switch":
        enabled = bool(value)
        mqtt_ok = await _mqtt_command(
            api,
            device_id,
            SolixMqttCommands.ac_fast_charge_switch,
            1 if enabled else 0,
            "set_ac_fast_charge_switch",
            ha_client=ha_client,
        )
        if mqtt_ok:
            result = {"mqtt": True}
        else:
            raise RuntimeError("ac_fast_charge_switch rejected (MQTT control failed)")
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


async def run_list_devices_with_client(
    client: IoBrokerAnkerApiClient, config: dict
) -> dict:
    exclude = set(config.get("exclude") or DEFAULT_EXCLUDE)
    await client.api.update_sites(exclude=exclude)
    await client.api.update_device_details(exclude=exclude)
    caches = client.api.getCaches()
    listing = build_device_list(client.api, caches)
    return {"ok": True, **listing, "nickname": client.api.apisession.nickname}


async def run_list_devices(config: dict) -> dict:
    session = ClientSession()
    client = IoBrokerAnkerApiClient(config, session, _LOGGER)
    try:
        await client.authenticate()
        return await run_list_devices_with_client(client, config)
    finally:
        await session.close()


async def run_service_with_client(
    client: IoBrokerAnkerApiClient, config: dict
) -> dict:
    service = str(config.get("service") or "")
    params = config.get("params") or {}
    device_id = str(params.get("deviceId") or config.get("selectedDeviceId") or "")
    site_id = str(params.get("siteId") or config.get("selectedSiteId") or "")

    api = client.api
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


async def run_service(config: dict) -> dict:
    session = ClientSession()
    client = IoBrokerAnkerApiClient(config, session, _LOGGER)
    try:
        await client.authenticate()
        return await run_service_with_client(client, config)
    finally:
        await session.close()


def _enrich_cache_entry(
    client: IoBrokerAnkerApiClient,
    ctx_id: str,
    ctx_data: dict,
    info: dict,
    *,
    site_has_combiner: bool,
    enable_stats: bool,
) -> dict:
    """Attach site-level energy_details only to the statistics holder device(s)."""
    site_id = str(ctx_data.get("site_id") or "")
    if info["type"] in ("site", "system") and not site_id:
        site_id = str(ctx_id)
    if site_id and info["type"] in ("site", "system"):
        site = client.api.sites.get(site_id) or {}
        stats = site.get("statistics")
        if stats is not None:
            ctx_data = {**ctx_data, "statistics": stats}
    if not site_id:
        return ctx_data
    if not device_exposes_energy_statistics(
        str(info.get("type") or ""),
        site_has_combiner,
        enable_stats=enable_stats,
    ):
        return ctx_data
    site = client.api.sites.get(site_id) or {}
    energy = site.get("energy_details")
    if energy and not ctx_data.get("energy_details"):
        return {**ctx_data, "energy_details": energy}
    return ctx_data


def _devices_from_caches(
    client: IoBrokerAnkerApiClient, config: dict, caches: dict
) -> list[dict]:
    devices: list[dict] = []
    site_has_combiner = build_site_has_combiner(caches)
    _enabled = enabled_entity_groups(config)
    enable_stats = (
        GROUP_ENERGY_STATISTICS in _enabled
        or GROUP_ENERGY_DETAIL in _enabled
        or GROUP_ENERGY_STATISTICS_WEEK in _enabled
        or GROUP_ENERGY_STATISTICS_MONTH in _enabled
        or GROUP_ENERGY_STATISTICS_YEAR in _enabled
    )
    for ctx_id, ctx_data in caches.items():
        if not isinstance(ctx_data, dict):
            continue
        info = device_info(str(ctx_id), ctx_data)
        if not should_include_device(str(ctx_id), ctx_data, info, config):
            continue
        site_id = str(info.get("site_id") or "")
        if info["type"] in ("site", "system") and not site_id:
            site_id = str(ctx_id)
        combiner_site = site_has_combiner.get(site_id, False)
        ctx_data = _enrich_cache_entry(
            client,
            str(ctx_id),
            ctx_data,
            info,
            site_has_combiner=combiner_site,
            enable_stats=enable_stats,
        )
        if info["type"] == "combiner_box":
            ctx_data = enrich_combiner_soc(client.api, str(ctx_id), ctx_data)
            ctx_data = enrich_combiner_station_fields(client.api, str(ctx_id), ctx_data)
        elif info["type"] == "solarbank":
            from battery_power_pick import enrich_solarbank_scene  # noqa: PLC0415

            ctx_data = enrich_solarbank_scene(client.api, str(ctx_id), ctx_data)
        entities = extract_entities(ctx_data, config)
        writable = writable_controls_for_device(ctx_data, info["type"], config)
        if not entities and not writable:
            continue
        usage_opts = sorted(
            client.api.solarbank_usage_mode_options(deviceSn=str(ctx_id))
        )
        max_ac_opts = max_total_ac_output_options(
            ctx_data, str(info.get("type") or ""), client.api, str(ctx_id)
        )
        has_statistics = device_exposes_energy_statistics(
            str(info.get("type") or ""),
            combiner_site,
            enable_stats=enable_stats,
        )
        solarbank_info = None
        if info["type"] in ("system", "site"):
            from solarbank_info import extract_solarbank_info  # noqa: PLC0415

            solarbank_info = extract_solarbank_info(
                ctx_data, client.api, config
            )
        devices.append(
            {
                "info": info,
                "entities": _json_safe(entities),
                "writable": writable,
                "usage_mode_options": usage_opts,
                "max_total_ac_output_options": max_ac_opts,
                "hasStatistics": has_statistics,
                "solarbankInfo": solarbank_info,
            }
        )
    return devices


async def run_poll_with_client(
    client: IoBrokerAnkerApiClient, config: dict
) -> dict:
    poll_result = await client.async_get_data()
    caches = poll_result["caches"]
    devices = _devices_from_caches(client, config, caches)
    return {
        "ok": True,
        "nickname": client.api.apisession.nickname or config.get("username"),
        "devices": devices,
        "refreshDetails": poll_result.get("refreshDetails", False),
        "intervalcount": poll_result.get("intervalcount"),
        "deviceintervals": poll_result.get("deviceintervals"),
        "periodEnergyUpdated": poll_result.get("periodEnergyUpdated") or [],
        "persistent": True,
    }


async def run_poll(config: dict) -> dict:
    session = ClientSession()
    client = IoBrokerAnkerApiClient(config, session, _LOGGER)
    try:
        await client.authenticate()
        return await run_poll_with_client(client, config)
    finally:
        await session.close()


async def run_set_with_client(client: IoBrokerAnkerApiClient, config: dict) -> dict:
    device_id = str(config["deviceId"])
    _seed_device_context(client.api, device_id, config)
    site_id, _, _, device = _control_context(client.api, device_id)
    if site_id and site_id not in client.api.sites:
        await client.api.update_sites(exclude=set(config.get("exclude") or DEFAULT_EXCLUDE))
    control = str(config.get("control") or "")
    if control in ("ac_output_limit", "preset_usage_mode", "set_output_power"):
        for sn in _schedule_device_candidates(client.api, site_id, device_id, device):
            await _ensure_device_schedule(client.api, site_id, sn)
    if client._mqtt_usage:
        await client.check_mqtt_session()
    await apply_control(
        client.api,
        device_id,
        str(config["control"]),
        config["value"],
        ha_client=client,
        config=config,
    )
    return {"ok": True, "persistent": True}


async def run_set(config: dict) -> dict:
    session = ClientSession()
    client = IoBrokerAnkerApiClient(config, session, _LOGGER)
    try:
        await client.authenticate()
        return await run_set_with_client(client, config)
    finally:
        await session.close()


async def run_login_with_client(
    client: IoBrokerAnkerApiClient, config: dict
) -> dict:
    nickname = client.api.apisession.nickname or config.get("username")
    return {"ok": True, "nickname": nickname, "persistent": True}


async def run_login(config: dict) -> dict:
    session = ClientSession()
    client = IoBrokerAnkerApiClient(config, session, _LOGGER)
    try:
        await client.authenticate()
        return await run_login_with_client(client, config)
    finally:
        await session.close()


async def run_serve() -> None:
    """Read JSON lines from stdin, keep API/MQTT session alive (HA-style)."""
    from bridge_runtime import BridgeRuntime  # noqa: PLC0415

    runtime = BridgeRuntime()
    loop = asyncio.get_running_loop()
    _LOGGER.info("Bridge daemon ready (persistent HA session)")
    print(json.dumps({"ok": True, "ready": True}), flush=True)

    while True:
        line = await loop.run_in_executor(None, sys.stdin.readline)
        if not line:
            break
        line = line.strip()
        if not line:
            continue
        req_id = None
        try:
            request = json.loads(line)
            req_id = request.get("id")
            payload = await runtime.dispatch(request)
            payload["id"] = req_id
            print(json.dumps(payload, ensure_ascii=False), flush=True)
        except Exception as exc:  # noqa: BLE001
            err = {
                "id": req_id,
                "ok": False,
                "error": f"{type(exc).__name__}: {exc}",
            }
            print(json.dumps(err, ensure_ascii=False), flush=True)

    await runtime.close()


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "action",
        choices=["poll", "login", "set", "list_devices", "service", "serve"],
    )
    parser.add_argument("config_file", nargs="?", default="-")
    args = parser.parse_args()

    logging.basicConfig(level=logging.WARNING)

    if args.action == "serve":
        await run_serve()
        return 0

    if args.config_file == "-":
        raw = sys.stdin.read()
    else:
        raw = Path(args.config_file).read_text(encoding="utf-8-sig")

    config = json.loads(raw or "{}")
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
