"""Tests for daily period fetch schedule (Europe/Berlin)."""

import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

PYTHON_DIR = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from energy_period import (  # noqa: E402
    BERLIN_TZ,
    PERIOD_MONTH,
    PERIOD_WEEK,
    PERIOD_YEAR,
    period_schedule_label,
    periods_due_for_fetch,
)

BERLIN = BERLIN_TZ


def test_period_schedule_labels() -> None:
    assert period_schedule_label(PERIOD_WEEK) == "23:00"
    assert period_schedule_label(PERIOD_MONTH) == "23:15"
    assert period_schedule_label(PERIOD_YEAR) == "23:30"


def test_week_not_due_before_23() -> None:
    now = datetime(2026, 5, 24, 22, 30, tzinfo=BERLIN)
    due = periods_due_for_fetch([PERIOD_WEEK], {}, now)
    assert due == []


def test_week_due_after_23_once_per_day() -> None:
    now = datetime(2026, 5, 24, 23, 5, tzinfo=BERLIN)
    due = periods_due_for_fetch([PERIOD_WEEK], {}, now)
    assert due == [PERIOD_WEEK]
    due_again = periods_due_for_fetch(
        [PERIOD_WEEK], {PERIOD_WEEK: "2026-05-24"}, now
    )
    assert due_again == []


def test_staggered_times_same_evening() -> None:
    last = {PERIOD_WEEK: "2026-05-24"}
    at_2310 = datetime(2026, 5, 24, 23, 10, tzinfo=BERLIN)
    assert periods_due_for_fetch(
        [PERIOD_WEEK, PERIOD_MONTH, PERIOD_YEAR], last, at_2310
    ) == [PERIOD_MONTH]
    at_2340 = datetime(2026, 5, 24, 23, 40, tzinfo=BERLIN)
    last[PERIOD_MONTH] = "2026-05-24"
    assert periods_due_for_fetch(
        [PERIOD_WEEK, PERIOD_MONTH, PERIOD_YEAR], last, at_2340
    ) == [PERIOD_YEAR]
