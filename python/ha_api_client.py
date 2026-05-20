"""HA-aligned API client (ported from homeassistant integration api_client.py)."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from aiohttp import ClientSession

from solixapi.api import AnkerSolixApi
from solixapi.apitypes import ApiCategories, SolixDefaults, SolixDeviceType
from solixapi.mqtt_device import SolixMqttDevice
from solixapi.mqtt_factory import SolixMqttDeviceFactory

# Same defaults as custom_components/anker_solix/api_client.py
MIN_DEVICE_REFRESH: int = 60
DEFAULT_DEVICE_MULTIPLIER: int = 10
DEFAULT_ENDPOINT_LIMIT: int = SolixDefaults.ENDPOINT_LIMIT_DEF
DEFAULT_DELAY_TIME: float = SolixDefaults.REQUEST_DELAY_DEF
DEFAULT_TIMEOUT: int = SolixDefaults.REQUEST_TIMEOUT_DEF

# Non-energy optional excludes (HA optional list subset; no ApiCategories.device_parm).
from entity_groups import build_exclude_categories  # noqa: E402

# Re-export for bridge.py
DEFAULT_EXCLUDE_CATEGORIES: list[str] = []


class IoBrokerAnkerApiClient:
    """Mirrors HA AnkerSolixApiClient refresh logic for polling."""

    def __init__(
        self,
        config: dict,
        session: ClientSession,
        logger: logging.Logger,
    ) -> None:
        email = str(config.get("username") or "").strip()
        password = str(config.get("password") or "")
        country = (config.get("country") or "DE").upper()
        self.api = AnkerSolixApi(email, password, country, session, logger)
        cache_dir = Path(config.get("cacheDir") or Path(__file__).parent / "authcache")
        cache_dir.mkdir(parents=True, exist_ok=True)
        self.api.apisession._authFile = str(cache_dir / f"{email}.json")
        self.api.apisession.nickname = str(config.get("nickname") or email)

        self.api.apisession.requestDelay(
            float(config.get("requestDelay", DEFAULT_DELAY_TIME))
        )
        self.api.apisession.requestTimeout(
            int(config.get("requestTimeout", DEFAULT_TIMEOUT))
        )
        self.api.apisession.endpointLimit(
            int(config.get("endpointLimit", DEFAULT_ENDPOINT_LIMIT))
        )

        self.exclude_categories = build_exclude_categories(config)
        self._deviceintervals = max(
            1, int(config.get("deviceDetailMultiplier", DEFAULT_DEVICE_MULTIPLIER))
        )
        self._intervalcount = 0
        self._mqtt_usage = bool(config.get("mqttUsage", True))
        self._startup = True
        self.deferred_data = False
        self.active_device_refresh = False
        self.mqtt_devices: dict[str, SolixMqttDevice] = {}
        self._state_path = cache_dir / "poll_client_state.json"
        self._logger = logger
        self._load_state()

    def _load_state(self) -> None:
        if not self._state_path.is_file():
            return
        try:
            data = json.loads(self._state_path.read_text(encoding="utf-8"))
            self._intervalcount = int(data.get("intervalcount", 0))
            self._startup = bool(data.get("startup", True))
            self.deferred_data = bool(data.get("deferred_data", False))
        except (OSError, ValueError, TypeError) as exc:
            self._logger.warning("Could not load poll state: %s", exc)

    def _save_state(self) -> None:
        try:
            self._state_path.write_text(
                json.dumps(
                    {
                        "intervalcount": self._intervalcount,
                        "startup": self._startup,
                        "deferred_data": self.deferred_data,
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
        except OSError as exc:
            self._logger.warning("Could not save poll state: %s", exc)

    async def _refresh_power_limits(self) -> None:
        """Fetch site power limits (ac_input_limit per SB, all_ac_input_limit on combiner)."""
        from solixapi import errors  # noqa: PLC0415

        for site_id, site in list(self.api.sites.items()):
            if not site.get("site_admin"):
                continue
            if not (site.get("solarbank_list") or site.get("station_sn")):
                continue
            try:
                await self.api.get_power_limit(siteId=str(site_id))
            except errors.RequestError as exc:
                self._logger.debug(
                    "get_power_limit skipped for site %s: %s", site_id, exc
                )

    async def authenticate(self) -> None:
        import asyncio
        from solixapi import errors  # noqa: PLC0415

        last_exc: Exception | None = None
        for attempt in range(3):
            try:
                if await self.api.async_authenticate():
                    return
                if await self.api.async_authenticate(restart=True):
                    return
                last_exc = RuntimeError("Authentication failed")
            except errors.CaptchaRequiredError:
                raise
            except errors.AnkerSolixError as exc:
                if "100032" in str(exc) or "captcha" in str(exc).lower():
                    raise errors.CaptchaRequiredError(str(exc)) from exc
                raise
            except errors.RequestError as exc:
                last_exc = exc
                if "26161" in str(exc) or "429" in str(exc):
                    delay = 15 * (attempt + 1)
                    self._logger.warning(
                        "Auth rate-limited, retry %s/3 in %ss", attempt + 2, delay
                    )
                    await asyncio.sleep(delay)
                    continue
                raise
        if last_exc:
            raise last_exc
        raise RuntimeError("Authentication failed")

    async def async_get_data(self) -> dict[str, Any]:
        """Same sequence as HA AnkerSolixApiClient.async_get_data (normal poll path)."""
        await self.api.update_sites(exclude=set(self.exclude_categories))

        self._intervalcount -= 1
        refresh_details = False
        if self._intervalcount <= 0:
            refresh_details = True
            self.active_device_refresh = True
            self._logger.debug(
                "Updating device and site details (HA interval, mult=%s)",
                self._deviceintervals,
            )
            await self.api.update_device_details(exclude=set(self.exclude_categories))
            await self.api.update_site_details(exclude=set(self.exclude_categories))
            await self._refresh_power_limits()
            if self._startup:
                self._logger.info("Deferring energy updates on first device refresh")
            else:
                await self.api.update_device_energy(
                    exclude=set(self.exclude_categories)
                )
            self._intervalcount = self._deviceintervals
            self.active_device_refresh = False
            await self.check_mqtt_session()
            if self.api.mqttsession and self.api.mqttsession.is_connected():
                self.api.update_device_mqtt()
        elif self._startup and not self.deferred_data:
            self.active_device_refresh = True
            self._logger.info("Updating deferred energy data")
            await self.api.update_device_energy(exclude=set(self.exclude_categories))
            self.deferred_data = True
            self._startup = False
            self.active_device_refresh = False

        if self._mqtt_usage and self.api.mqttsession and self.api.mqttsession.is_connected():
            self.api.update_device_mqtt()

        self._save_state()
        return {
            "caches": self.api.getCaches(),
            "refreshDetails": refresh_details,
            "intervalcount": self._intervalcount,
            "deviceintervals": self._deviceintervals,
        }

    async def check_mqtt_session(self) -> None:
        """Same as HA check_mqtt_session (live mode, no file poller)."""
        if not self._mqtt_usage:
            return
        if not self.api.mqttsession or not self.api.mqttsession.is_connected():
            self._logger.info("Starting MQTT session")
            if await self.api.startMqttSession():
                mqtt_devs = [
                    dev for dev in self.api.devices.values() if dev.get("mqtt_supported")
                ]
                for dev in mqtt_devs:
                    self.subscribe_device(dev)
                for dev in mqtt_devs:
                    sn = dev.get("device_sn")
                    if sn and (
                        mdev := SolixMqttDeviceFactory(
                            api_instance=self.api, device_sn=sn
                        ).create_device()
                    ):
                        self.mqtt_devices[sn] = mdev
            else:
                self._logger.error("Failed to start MQTT session")
                self.mqtt_devices.clear()
        else:
            for mdev in self.mqtt_devices.values():
                if not mdev.is_subscribed() and not self.subscribe_device(mdev.device):
                    mdev.mqttdata.clear()

    def subscribe_device(self, device_dict: dict) -> bool:
        if not self.api.mqttsession or not self.api.mqttsession.is_connected():
            return False
        topic = f"{self.api.mqttsession.get_topic_prefix(deviceDict=device_dict)}#"
        resp = self.api.mqttsession.subscribe(topic)
        if resp and resp.is_failure:
            self._logger.warning("MQTT subscribe failed for topic: %s", topic)
            return False
        return True

    def get_mqtt_device(self, sn: str) -> SolixMqttDevice | None:
        return self.mqtt_devices.get(sn) if sn else None

    def apply_runtime_config(self, config: dict) -> None:
        """Update poll options without tearing down the persistent session."""
        self.exclude_categories = build_exclude_categories(config)
        self._deviceintervals = max(
            1, int(config.get("deviceDetailMultiplier", self._deviceintervals))
        )
        mqtt_usage = bool(config.get("mqttUsage", self._mqtt_usage))
        if self._mqtt_usage and not mqtt_usage:
            self.api.stopMqttSession()
            self.mqtt_devices.clear()
        self._mqtt_usage = mqtt_usage
        self.api.apisession.requestDelay(
            float(config.get("requestDelay", DEFAULT_DELAY_TIME))
        )
        self.api.apisession.requestTimeout(
            int(config.get("requestTimeout", DEFAULT_TIMEOUT))
        )
        self.api.apisession.endpointLimit(
            int(config.get("endpointLimit", DEFAULT_ENDPOINT_LIMIT))
        )
