"""Tests for API-only battery charge/discharge power picking."""

import sys
from pathlib import Path
from unittest.mock import MagicMock

PYTHON_DIR = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from battery_power_pick import (  # noqa: E402
    enrich_solarbank_scene,
    pick_bat_charge_discharge,
    sum_bank_charge_discharge,
)


def test_charging_power_from_scene_api() -> None:
    data = {
        "type": "solarbank",
        "charging_power": "850",
        "bat_charge_power": "0",
        "bat_discharge_power": "0",
    }
    charge, discharge = pick_bat_charge_discharge(data)
    assert charge == 850
    assert discharge == 0


def test_discharge_from_bat_discharge_api() -> None:
    data = {
        "type": "solarbank",
        "bat_discharge_power": "420",
        "bat_charge_power": "0",
        "charging_power": "-420",
    }
    charge, discharge = pick_bat_charge_discharge(data)
    assert charge == 0
    assert discharge == 420


def test_mqtt_data_is_ignored() -> None:
    data = {
        "type": "solarbank",
        "charging_power": "500",
        "mqtt_data": {"bat_charge_power": "9999", "bat_discharge_power": "9999"},
    }
    charge, discharge = pick_bat_charge_discharge(data)
    assert charge == 500
    assert discharge == 0


def test_enrich_solarbank_from_site_scene() -> None:
    api = MagicMock()
    api.sites = {
        "site1": {
            "solarbank_info": {
                "solarbank_list": [
                    {
                        "device_sn": "SB1",
                        "charging_power": "640",
                        "bat_charge_power": "640",
                        "bat_discharge_power": "0",
                    }
                ]
            }
        }
    }
    ctx = {"type": "solarbank", "device_sn": "SB1", "site_id": "site1"}
    enriched = enrich_solarbank_scene(api, "SB1", ctx)
    charge, discharge = pick_bat_charge_discharge(enriched)
    assert charge == 640
    assert discharge == 0


def test_sum_banks_from_scene_list() -> None:
    api = MagicMock()
    api.devices = {
        "SB1": {
            "type": "solarbank",
            "site_id": "site1",
            "charging_power": "300",
            "bat_charge_power": "300",
        },
        "SB2": {
            "type": "solarbank",
            "site_id": "site1",
            "charging_power": "-200",
            "bat_discharge_power": "200",
        },
    }
    api.sites = {}
    sb_list = [{"device_sn": "SB1"}, {"device_sn": "SB2"}]
    charge, discharge = sum_bank_charge_discharge(sb_list, api, site_id="site1")
    assert charge == 300
    assert discharge == 200


def test_idle_grid_export_not_counted_as_discharge() -> None:
    """bat_discharge_power can mirror PV export while charging_power is 0 (idle pack)."""
    data = {
        "type": "solarbank",
        "photovoltaic_power": "4800",
        "photovoltaic_to_grid_power": "4800",
        "output_power": "4800",
        "charging_power": "0",
        "bat_charge_power": "0",
        "bat_discharge_power": "4800",
    }
    charge, discharge = pick_bat_charge_discharge(data)
    assert charge == 0
    assert discharge == 0


def test_power_flow_fields_when_idle() -> None:
    data = {
        "type": "solarbank",
        "bat_discharge_power": "4800",
        "charging_power": "0",
        "pv_to_battery_power": "0",
        "battery_to_home_power": "0",
        "photovoltaic_to_grid_power": "4800",
    }
    charge, discharge = pick_bat_charge_discharge(data)
    assert charge == 0
    assert discharge == 0


def test_sum_uses_device_cache_when_list_rows_are_sparse() -> None:
    api = MagicMock()
    api.devices = {
        "SB1": {
            "type": "solarbank",
            "site_id": "site1",
            "bat_charge_power": "0",
            "charging_power": "640",
        },
    }
    api.sites = {
        "site1": {
            "solarbank_info": {
                "solarbank_list": [
                    {
                        "device_sn": "SB1",
                        "bat_charge_power": "0",
                        "bat_discharge_power": "0",
                    }
                ]
            }
        }
    }
    charge, discharge = sum_bank_charge_discharge(
        [{"device_sn": "SB1"}], api, site_id="site1"
    )
    assert charge == 640
    assert discharge == 0
