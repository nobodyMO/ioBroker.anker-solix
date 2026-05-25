"""Shared authentication helpers (avoid wiping authcache → captcha on ioBroker hosts)."""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import shutil
from pathlib import Path

from solixapi.api import AnkerSolixApi
from solixapi import errors


def auth_backup_path(auth_path: Path) -> Path:
    return auth_path.parent / "backup" / auth_path.name


def _is_valid_auth_file(auth_path: Path) -> bool:
    if not auth_path.is_file():
        return False
    try:
        data = json.loads(auth_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    return bool(data.get("user_id") and data.get("auth_token"))


def backup_auth_cache_once(auth_path: Path, logger: logging.Logger) -> bool:
    """Copy login cache to authcache/backup/ after first successful login only."""
    if not _is_valid_auth_file(auth_path):
        return False
    backup = auth_backup_path(auth_path)
    if backup.is_file():
        return False
    backup.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(auth_path, backup)
    logger.info("Anker login cache backed up to %s", backup)
    return True


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
            await api.async_authenticate()
            if api.apisession._token and api.apisession._gtoken:
                api.apisession._loggedIn = True
                backup_auth_cache_once(auth_path, logger)
                return
            if auth_path.is_file():
                api.apisession._authFileTime = 0
                await api.async_authenticate()
                if api.apisession._token and api.apisession._gtoken:
                    api.apisession._loggedIn = True
                    backup_auth_cache_once(auth_path, logger)
                    return
                raise errors.InvalidCredentialsError(
                    "Cached Anker login is invalid or expired. "
                    "Copy a fresh authcache/<email>.json from a working Anker/Solix setup "
                    "(e.g. ha-anker-solix), or use Admin “Load devices” after re-entering the password."
                )
            if await api.async_authenticate(restart=True):
                backup_auth_cache_once(auth_path, logger)
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
