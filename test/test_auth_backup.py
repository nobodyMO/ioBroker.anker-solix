"""Tests for auth cache backup helpers."""

import json
import sys
from pathlib import Path

PYTHON_DIR = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from auth_helpers import auth_backup_path, backup_auth_cache_once  # noqa: E402


def test_backup_auth_cache_once_creates_backup(tmp_path):
    auth = tmp_path / "user@example.com.json"
    auth.write_text(
        json.dumps({"user_id": "u1", "auth_token": "tok"}),
        encoding="utf-8",
    )
    logger = type("L", (), {"info": lambda *a, **k: None})()

    assert backup_auth_cache_once(auth, logger) is True
    backup = auth_backup_path(auth)
    assert backup.is_file()
    data = json.loads(backup.read_text(encoding="utf-8"))
    assert data["auth_token"] == "tok"

    assert backup_auth_cache_once(auth, logger) is False


def test_backup_skips_invalid_cache(tmp_path):
    auth = tmp_path / "bad.json"
    auth.write_text("{}", encoding="utf-8")
    logger = type("L", (), {"info": lambda *a, **k: None})()
    assert backup_auth_cache_once(auth, logger) is False
    assert not auth_backup_path(auth).exists()
