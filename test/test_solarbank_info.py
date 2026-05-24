"""Tests for system solarbank_info channel extraction."""

import sys
from pathlib import Path
from unittest.mock import MagicMock

PYTHON_DIR = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from solarbank_info import extract_solarbank_info  # noqa: E402


def test_extract_system_totals_and_per_bank_energy() -> None:
    api = MagicMock()
    api.devices = {
        "APCDJQD0F25100213": {
            "battery_capacity": "5000",
            "battery_soc": "80",
        }
    }
    data = {
        "type": "system",
        "solarbank_info": {
            "battery_discharge_power": "1200",
            "total_charging_power": "800",
            "solarbank_list": [
                {"device_sn": "APCDJQD0F25100213", "battery_power": "80"},
            ],
        },
    }
    config = {"enableCoreEntities": True, "enableSystemOverview": True}
    result = extract_solarbank_info(data, api, config)
    assert result is not None
    assert result["battery_discharge_power"] == 1200
    assert result["total_charging_power"] == 800
    assert result["solarbank_list"]["APCDJQD0F25100213"]["battery_energy"] == 4000


def test_extract_multisystem_fallback_sums_per_bank() -> None:
    api = MagicMock()
    api.devices = {}
    data = {
        "type": "system",
        "site_id": "site1",
        "solarbank_info": {
            "total_charging_power": "0",
            "solarbank_list": [
                {
                    "device_sn": "SB1",
                    "bat_discharge_power": "350",
                    "charging_power": "-350",
                },
                {
                    "device_sn": "SB2",
                    "bat_discharge_power": "420",
                    "charging_power": "-420",
                },
            ],
        },
    }
    config = {"enableCoreEntities": True, "enablePowerFlows": True}
    result = extract_solarbank_info(data, api, config)
    assert result is not None
    assert result["total_charging_power"] == 0
    assert result["battery_discharge_power"] == 770


def test_extract_negative_cloud_charge_clamped_and_discharge_from_banks() -> None:
    data = {
        "type": "system",
        "solarbank_info": {
            "total_charging_power": "-600",
            "solarbank_list": [
                {"device_sn": "SB1", "bat_discharge_power": "600"},
            ],
        },
    }
    result = extract_solarbank_info(data, None, {"enableSystemOverview": True})
    assert result is not None
    assert result["total_charging_power"] == 0
    assert result["battery_discharge_power"] == 600


def test_extract_disabled_without_overview_or_power_flows() -> None:
    data = {
        "type": "system",
        "solarbank_info": {"total_charging_power": "100"},
    }
    assert extract_solarbank_info(data, None, {"enableCoreEntities": True}) is None
