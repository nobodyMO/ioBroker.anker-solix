"""Tests for system solarbank_info channel (battery_energy per SB only)."""

import sys
from pathlib import Path
from unittest.mock import MagicMock

PYTHON_DIR = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from solarbank_info import extract_solarbank_info  # noqa: E402


def test_extract_per_bank_energy_only() -> None:
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
            "solarbank_list": [
                {"device_sn": "APCDJQD0F25100213", "battery_power": "80"},
            ],
        },
    }
    config = {"enableCoreEntities": True, "enableSystemOverview": True}
    result = extract_solarbank_info(data, api, config)
    assert result is not None
    assert "battery_discharge_power" not in result
    assert "total_charging_power" not in result
    assert result["solarbank_list"]["APCDJQD0F25100213"]["battery_energy"] == 4000


def test_extract_uses_site_cache_when_solarbank_info_missing_on_data() -> None:
    api = MagicMock()
    api.devices = {}
    api.sites = {
        "site1": {
            "solarbank_info": {
                "solarbank_list": [
                    {"device_sn": "SB1", "battery_energy": "1200"},
                ]
            }
        }
    }
    data = {"type": "system", "site_id": "site1"}
    result = extract_solarbank_info(data, api, {"enablePowerFlows": True})
    assert result is not None
    assert result["solarbank_list"]["SB1"]["battery_energy"] == 1200


def test_extract_disabled_without_overview_or_power_flows() -> None:
    data = {
        "type": "system",
        "solarbank_info": {"solarbank_list": [{"device_sn": "SB1"}]},
    }
    assert extract_solarbank_info(data, None, {"enableCoreEntities": True}) is None
