"""Tests for EV charger load balancing controls."""

import sys
from pathlib import Path

PYTHON_DIR = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from ev_charger_load import (  # noqa: E402
    build_ev_load_balancing_parm_map,
    extract_ev_charger_load_value,
    parse_ev_charger_load_set,
)
from ev_charger_schedule import parse_ev_charger_control_set  # noqa: E402


def test_load_balance_parm_map_fills_switch() -> None:
    data = {
        "load_balance_switch": "1",
        "load_balance_setting_d5": "1",
        "load_balance_setting_d6": "0",
        "load_balance_monitor_device": "APCDJQD0F25100236",
    }
    parm_map = build_ev_load_balancing_parm_map(
        "set_load_balance_setting_d6", 1, data
    )
    assert parm_map["set_load_balance_switch"] == 1
    assert parm_map["set_load_balance_setting_d6"] == 1


def test_parse_main_breaker() -> None:
    _, parm, val = parse_ev_charger_control_set("ev_charger_main_breaker_limit", 63)
    assert parm == "set_main_breaker_limit"
    assert val == 63


def test_extract_load_balance_switch() -> None:
    assert extract_ev_charger_load_value(
        "ev_charger_load_balance_switch", {"load_balance_switch": "1"}
    )
