"""Unit tests for energy period helpers."""

from datetime import datetime

from energy_period import period_label, period_start_day, pick_period_value


def test_period_start_month():
    start = period_start_day("month", datetime(2026, 5, 19, 12, 0))
    assert start == datetime(2026, 5, 1, 0, 0, 0)


def test_period_label_week():
    start = period_start_day("week", datetime(2026, 5, 19))
    assert period_label("week", start).startswith("2026-W")


def test_pick_period_value():
    data = {
        "energy_details": {
            "month": {"date": "2026-05", "solar_production": "42.5", "home_usage": "30"},
        }
    }
    spec = {"keys": ["solar_production"], "period": "month"}
    assert pick_period_value(data, spec) == 42.5
