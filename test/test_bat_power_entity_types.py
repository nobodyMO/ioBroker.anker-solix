"""Tests for API-only battery charge/discharge power picking (solarbank only)."""

import sys
from pathlib import Path
from unittest.mock import patch

PYTHON_DIR = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from entities import extract_entities  # noqa: E402

_CFG = {"enablePowerFlows": True}
_PATCH = (
    patch("entities.extract_statistics_entities", return_value={}),
    patch("lifetime_statistics.extract_lifetime_statistics_entities", return_value={}),
)


def _extract(data: dict) -> dict:
    with _PATCH[0], _PATCH[1]:
        return extract_entities(data, _CFG)


def test_solarbank_bat_power_is_string() -> None:
    data = {
        "type": "solarbank",
        "charging_power": "640",
        "bat_charge_power": "0",
        "bat_discharge_power": "0",
    }
    entities = _extract(data)
    assert entities["bat_charge_power"] == "640"
    assert isinstance(entities["bat_charge_power"], str)


def test_system_has_no_bat_power_entities() -> None:
    data = {
        "type": "system",
        "charging_power": "1200",
        "bat_charge_power": "0",
    }
    entities = _extract(data)
    assert "bat_charge_power" not in entities
    assert "bat_discharge_power" not in entities
