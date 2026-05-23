"""Tests for period block helpers."""

import sys
from pathlib import Path

PYTHON_DIR = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from energy_period import period_block_has_values  # noqa: E402


def test_period_block_has_values() -> None:
    assert not period_block_has_values({"date": "2026-W21", "period_label": "2026-W21"})
    assert period_block_has_values(
        {"date": "2026-W21", "solar_production": 12.5, "home_usage": 8.0}
    )
