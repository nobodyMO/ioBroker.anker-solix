"""HA-aligned API client (ported from homeassistant integration api_client.py)."""

from __future__ import annotations

import json
import logging
import time
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
from auth_helpers import purge_invalid_auth_cache, safe_authenticate  # noqa: E402
from entity_groups import build_exclude_categories, needs_daily_energy_poll  # noqa: E402
from energy_period import (  # noqa: E402
    PERIOD_MONTH,
    PERIOD_WEEK,
    PERIOD_YEAR,
    enabled_periods,
    update_site_energy_periods,
)

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
        self.config = config
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
        purge_invalid_auth_cache(self.api, logger)

        self.exclude_categories = build_exclude_categories(config)
        self._deviceintervals = max(
            1, int(config.get("deviceDetailMultiplier", DEFAULT_DEVICE_MULTIPLIER))
        )
        self._intervalcount = 0
        self._period_rotate = 0
        self._period_detail_count = 0
        self._period_backoff_until = 0.0
        self._last_period_energy_updated: list[str] = []
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
            self._period_rotate = int(data.get("period_rotate", 0))
            self._period_detail_count = int(data.get("period_detail_count", 0))
            self._period_backoff_until = float(data.get("period_backoff_until", 0))
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
                        "period_rotate": self._period_rotate,
                        "period_detail_count": self._period_detail_count,
                        "period_backoff_until": self._period_backoff_until,
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
        await safe_authenticate(self.api, self._logger)

    async def async_get_data(self) -> dict[str, Any]:
        """Same sequence as HA AnkerSolixApiClient.async_get_data (normal poll path)."""
        self._last_period_energy_updated = []
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
                if needs_daily_energy_poll(self.config):
                    self._logger.info("Deferring energy updates on first device refresh")
                else:
                    updated = await self._update_energy_periods()
                    if updated:
                        self.deferred_data = True
                        self._startup = False
            else:
                if needs_daily_energy_poll(self.config):
                    await self.api.update_device_energy(
                        exclude=set(self.exclude_categories)
                    )
                await self._update_energy_periods()
            self._intervalcount = self._deviceintervals
            self.active_device_refresh = False
            await self.check_mqtt_session()
            if self.api.mqttsession and self.api.mqttsession.is_connected():
                self.api.update_device_mqtt()
        elif self._startup and not self.deferred_data:
            self.active_device_refresh = True
            self._logger.info("Updating deferred energy data")
            if needs_daily_energy_poll(self.config):
                await self.api.update_device_energy(
                    exclude=set(self.exclude_categories)
                )
            await self._update_energy_periods()
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
            "periodEnergyUpdated": list(self._last_period_energy_updated),
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

    def _period_detail_interval(self) -> int:
        """Detail refreshes between period energy_analysis batches (year = slowest)."""
        periods = set(enabled_periods(self.config))
        if not periods:
            return 99
        if periods == {PERIOD_YEAR}:
            return 6
        if PERIOD_YEAR in periods and PERIOD_MONTH not in periods and PERIOD_WEEK not in periods:
            return 6
        if periods == {PERIOD_WEEK}:
            return 1
        if PERIOD_WEEK in periods and PERIOD_MONTH not in periods:
            return 1
        if PERIOD_MONTH in periods and PERIOD_WEEK not in periods:
            return 2
        if PERIOD_YEAR in periods:
            return 4
        if PERIOD_MONTH in periods:
            return 2
        if PERIOD_WEEK in periods:
            return 1
        return 2

    def _periods_for_this_refresh(self) -> list[str]:
        """At most one enabled period per detail refresh."""
        periods = enabled_periods(self.config)
        if not periods:
            return []
        if len(periods) == 1:
            return periods
        idx = self._period_rotate % len(periods)
        self._period_rotate += 1
        return [periods[idx]]

    def _periods_due(self) -> bool:
        if time.time() < self._period_backoff_until:
            return False
        if not enabled_periods(self.config):
            return False
        self._period_detail_count += 1
        if self._period_detail_count < self._period_detail_interval():
            return False
        self._period_detail_count = 0
        return True

    async def _update_energy_periods(self) -> bool:
        if not self._periods_due():
            self._last_period_energy_updated = []
            return False
        periods = self._periods_for_this_refresh()
        if not periods:
            self._last_period_energy_updated = []
            return False
        from solixapi import errors  # noqa: PLC0415

        try:
            await update_site_energy_periods(
                self.api, self.config, periods=periods
            )
            self._last_period_energy_updated = list(periods)
            self._logger.info(
                "Period energy updated for %s (next in ~%s detail refresh cycles)",
                ", ".join(periods),
                self._period_detail_interval(),
            )
            return True
        except errors.RequestLimitError as exc:
            self._period_backoff_until = time.time() + 1800
            self._last_period_energy_updated = []
            self._logger.warning(
                "Period energy skipped for 30 min (rate limit): %s", exc
            )
        except Exception as exc:  # noqa: BLE001
            self._last_period_energy_updated = []
            self._logger.warning("Period energy update failed: %s", exc)
        return False

    def apply_runtime_config(self, config: dict) -> None:
        """Update poll options without tearing down the persistent session."""
        self.config = config
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
