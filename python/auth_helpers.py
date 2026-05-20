"""Shared authentication helpers (avoid wiping authcache → captcha on ioBroker hosts)."""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from pathlib import Path

from solixapi.api import AnkerSolixApi
from solixapi import errors


def purge_invalid_auth_cache(api: AnkerSolixApi, logger: logging.Logger) -> None:
    """Remove login cache only when it cannot yield a session (empty/partial file)."""
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
    logger.warning("Removed invalid Anker login cache: %s", auth_path)


def _is_captcha_error(exc: BaseException) -> bool:
    text = str(exc).lower()
    return "100032" in text or "captcha" in text


async def safe_authenticate(api: AnkerSolixApi, logger: logging.Logger) -> None:
    """
    Authenticate using cached credentials when possible.

    Avoids async_authenticate(restart=True) when a cache file exists — restart deletes
    the cache and forces a new cloud login, which often returns captcha (100032) on
    server/VPN IPs after adapter restarts (e.g. enabling entity groups).
    """
    auth_path = Path(getattr(api.apisession, "_authFile", "") or "")
    purge_invalid_auth_cache(api, logger)

    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            if await api.async_authenticate():
                return
            if auth_path.is_file():
                # Force re-read (HA or another instance may have refreshed the file)
                api.apisession._authFileTime = 0
                if await api.async_authenticate():
                    return
                raise errors.InvalidCredentialsError(
                    "Cached Anker login is invalid (expired or replaced by the mobile app). "
                    "Anker allows only one active API token per account. "
                    "Copy a fresh authcache/<email>.json from Home Assistant (ha-anker-solix), "
                    "or log out the Anker app briefly, then restart the adapter. "
                    "Do not use “Clear login cache” unless you plan a new API login."
                )
            if await api.async_authenticate(restart=True):
                return
            last_exc = RuntimeError("Authentication failed")
        except errors.CaptchaRequiredError:
            raise
        except errors.AnkerSolixError as exc:
            if _is_captcha_error(exc):
                raise errors.CaptchaRequiredError(str(exc)) from exc
            raise
        except errors.RequestError as exc:
            last_exc = exc
            if "26161" in str(exc) or "429" in str(exc):
                delay = 15 * (attempt + 1)
                logger.warning("Auth rate-limited, retry %s/3 in %ss", attempt + 2, delay)
                await asyncio.sleep(delay)
                continue
            raise
    if last_exc:
        raise last_exc
    raise RuntimeError("Authentication failed")
