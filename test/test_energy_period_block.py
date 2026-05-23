"""Tests for period block helpers."""

import sys
from pathlib import Path

PYTHON_DIR = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from datetime import datetime

from energy_period import (  # noqa: E402
    PERIOD_MONTH,
    PERIOD_WEEK,
    _aggregate_daily_energy_table,
    period_block_has_values,
    period_num_days,
    period_start_day,
    site_energy_query_types,
)
from solixapi.apitypes import SolixDeviceType  # noqa: E402


def test_period_block_has_values() -> None:
    assert not period_block_has_values({"date": "2026-W21", "period_label": "2026-W21"})
    assert period_block_has_values(
        {"date": "2026-W21", "solar_production": 12.5, "home_usage": 8.0}
    )


def test_aggregate_daily_energy_table() -> None:
    start = period_start_day(PERIOD_WEEK, datetime(2026, 5, 19, 12, 0, 0))
    table = {
        "2026-05-19": {"date": "2026-05-19", "solar_production": 5.0, "home_usage": 3.0},
        "2026-05-20": {"date": "2026-05-20", "solar_production": 7.5, "home_usage": 4.0},
    }
    block = _aggregate_daily_energy_table(table, PERIOD_WEEK, start)
    assert block.get("solar_production") == 12.5
    assert block.get("home_usage") == 7.0


def test_period_num_days() -> None:
    now = datetime(2026, 5, 24, 10, 0, 0)
    start = period_start_day(PERIOD_WEEK, now)
    assert period_num_days(PERIOD_WEEK, now) == (now.date() - start.date()).days + 1
    assert period_num_days(PERIOD_MONTH, now) == 24


def test_site_energy_query_types_uses_empty_device_sn() -> None:
    class FakeApi:
        devices = {}

    site = {
        "solarbank_info": {"solarbank_list": [{"device_sn": "SB1", "device_pn": "A17C5"}]},
        "combiner_box_info": {"combiner_box_list": [{"device_sn": "COMBINER1"}]},
    }
    types, sn = site_energy_query_types(FakeApi(), "site-1", site, set())
    assert SolixDeviceType.SOLARBANK.value in types
    assert sn == ""
