"""Tests for max total AC output persistence across poll refreshes."""

import sys
from pathlib import Path
from unittest.mock import MagicMock

PYTHON_DIR = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from entities import COMBINER, pick_max_total_ac_output_value  # noqa: E402
from max_total_ac_cache import (  # noqa: E402
    CUSTOMIZED_MAX_TOTAL_AC,
    reapply_max_total_ac_stamps,
    stamp_device_max_total_ac,
)
from ha_api_client import IoBrokerAnkerApiClient  # noqa: E402


def test_pick_prefers_customized_over_cloud_limit() -> None:
    data = {
        "customized": {CUSTOMIZED_MAX_TOTAL_AC: 3600},
        "all_power_limit": "4800",
        "mqtt_data": {"max_load_total": "4800"},
    }
    assert pick_max_total_ac_output_value(data, COMBINER) == 3600


def test_reapply_restores_after_cloud_overwrite() -> None:
    api = MagicMock()
    api.devices = {
        "COMBINER1": {
            "type": "combiner_box",
            "all_power_limit": "4800",
            "mqtt_data": {"max_load_total": "4800"},
            "mqtt_overlay": False,
        }
    }
    reapply_max_total_ac_stamps(api, {"COMBINER1": 3600})
    dev = api.devices["COMBINER1"]
    assert dev["max_load_total"] == 3600
    assert dev["mqtt_data"]["max_load_total"] == "3600"
    assert dev["mqtt_overlay"] is True
    assert pick_max_total_ac_output_value(dev, COMBINER) == 3600


def test_record_and_reapply_persist_in_poll_state(tmp_path: Path) -> None:
    session = MagicMock()
    logger = MagicMock()
    config = {
        "username": "user@example.com",
        "password": "secret",
        "country": "DE",
        "cacheDir": str(tmp_path),
    }
    client = IoBrokerAnkerApiClient(config, session, logger)
    client.api.devices = {"SN1": {"type": "combiner_box", "device_sn": "SN1"}}
    client.record_max_total_ac_applied(["SN1"], 2400)
    stamp_device_max_total_ac(client.api, "SN1", 2400)

    client2 = IoBrokerAnkerApiClient(config, session, logger)
    client2.api.devices = {
        "SN1": {
            "type": "combiner_box",
            "all_power_limit": "4800",
            "mqtt_data": {"max_load_total": "4800"},
        }
    }
    client2.reapply_max_total_ac_stamps()
    assert pick_max_total_ac_output_value(client2.api.devices["SN1"], COMBINER) == 2400
