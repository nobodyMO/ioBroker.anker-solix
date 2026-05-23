"""Unit tests for IoBrokerAnkerApiClient helpers."""

import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

PYTHON_DIR = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from ha_api_client import IoBrokerAnkerApiClient  # noqa: E402


def _minimal_config(**overrides) -> dict:
    base = {
        "username": "user@example.com",
        "password": "secret",
        "country": "DE",
        "cacheDir": str(PYTHON_DIR / "authcache"),
        "enableEnergyStatisticsWeek": True,
        "enableEnergyStatisticsMonth": True,
        "enableEnergyStatisticsYear": True,
    }
    base.update(overrides)
    return base


@pytest.fixture
def client() -> IoBrokerAnkerApiClient:
    session = MagicMock()
    logger = MagicMock()
    return IoBrokerAnkerApiClient(_minimal_config(), session, logger)


def test_client_stores_config(client: IoBrokerAnkerApiClient) -> None:
    assert client.config is not None
    assert client.config.get("username") == "user@example.com"


def test_period_rotation_fetches_one_period_at_a_time(
    client: IoBrokerAnkerApiClient,
) -> None:
    first = client._periods_for_this_refresh()
    second = client._periods_for_this_refresh()
    third = client._periods_for_this_refresh()
    assert len(first) == 1
    assert len(second) == 1
    assert len(third) == 1
    assert first != second != third
