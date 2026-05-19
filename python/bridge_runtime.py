"""Long-lived HA-style API runtime (persistent session + MQTT)."""

from __future__ import annotations

import logging
from typing import Any

from aiohttp import ClientSession

from ha_api_client import IoBrokerAnkerApiClient

_LOGGER = logging.getLogger("anker-solix-bridge")


class BridgeRuntime:
    """Keeps aiohttp session, API client and MQTT alive across polls (like HA coordinator)."""

    def __init__(self) -> None:
        self.client: IoBrokerAnkerApiClient | None = None
        self.session: ClientSession | None = None
        self._credentials: tuple[str, str, str] | None = None

    async def close(self) -> None:
        if self.client:
            self.client.api.stopMqttSession()
            self.client.mqtt_devices.clear()
        self.client = None
        if self.session and not self.session.closed:
            await self.session.close()
        self.session = None
        self._credentials = None

    def _credential_key(self, config: dict) -> tuple[str, str, str]:
        return (
            str(config.get("username") or "").strip(),
            str(config.get("password") or ""),
            str(config.get("country") or "DE").upper(),
        )

    async def ensure_client(self, config: dict) -> IoBrokerAnkerApiClient:
        cred = self._credential_key(config)
        if self.client and self._credentials == cred:
            self.client.apply_runtime_config(config)
            return self.client
        await self.close()
        self.session = ClientSession()
        self.client = IoBrokerAnkerApiClient(config, self.session, _LOGGER)
        await self.client.authenticate()
        self._credentials = cred
        _LOGGER.info("Persistent API/MQTT session started for %s", cred[0])
        return self.client

    async def dispatch(self, request: dict[str, Any]) -> dict[str, Any]:
        action = str(request.get("action") or "")
        config = request.get("config") or {}

        if action == "shutdown":
            await self.close()
            return {"ok": True}

        if action == "configure":
            await self.ensure_client(config)
            return {"ok": True, "persistent": True}

        # Lazy import avoids circular dependency
        from bridge import (  # noqa: PLC0415
            run_list_devices_with_client,
            run_login_with_client,
            run_poll_with_client,
            run_service_with_client,
            run_set_with_client,
        )

        client = await self.ensure_client(config)

        if action == "poll":
            return await run_poll_with_client(client, config)
        if action == "set":
            return await run_set_with_client(client, config)
        if action == "login":
            return await run_login_with_client(client, config)
        if action == "list_devices":
            return await run_list_devices_with_client(client, config)
        if action == "service":
            return await run_service_with_client(client, config)

        raise ValueError(f"Unknown action: {action}")
