"""bat_charge/discharge entity value types per device kind."""

import sys
from pathlib import Path
from unittest.mock import patch

PYTHON_DIR = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from entities import extract_entities  # noqa: E402

_CFG = {"enablePowerFlows": True}


def _extract(data: dict) -> dict:
    with patch("entities.extract_statistics_entities", return_value={}), patch(
        "lifetime_statistics.extract_lifetime_statistics_entities", return_value={}
    ):
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


def test_system_bat_power_is_number() -> None:
    data = {
        "type": "system",
        "charging_power": "1200",
        "bat_charge_power": "0",
    }
    entities = _extract(data)
    assert entities["bat_charge_power"] == 1200
    assert isinstance(entities["bat_charge_power"], int)


def test_combiner_bat_power_is_number() -> None:
    data = {
        "type": "combiner_box",
        "bat_discharge_power": "800",
        "charging_power": "-800",
    }
    entities = _extract(data)
    assert entities["bat_discharge_power"] == 800
    assert isinstance(entities["bat_discharge_power"], int)
