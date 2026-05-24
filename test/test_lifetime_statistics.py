"""Tests for lifetime site statistics (total_energy, CO2, money)."""

import sys
from pathlib import Path

PYTHON_DIR = Path(__file__).resolve().parents[1] / "python"
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from lifetime_statistics import (  # noqa: E402
    extract_lifetime_statistics_entities,
    pick_scene_statistics_total,
)


def test_pick_scene_statistics_total_by_type() -> None:
    data = {
        "statistics": [
            {"type": "1", "total": "123.45", "unit": "kwh"},
            {"type": "2", "total": "89.48", "unit": "kg"},
            {"type": "3", "total": "35.90", "unit": "€"},
        ]
    }
    assert pick_scene_statistics_total(data, "1") == 123.45
    assert pick_scene_statistics_total(data, "2") == 89.48
    assert pick_scene_statistics_total(data, "3") == 35.9


def test_extract_lifetime_statistics_for_system() -> None:
    data = {
        "type": "system",
        "statistics": [
            {"type": "1", "total": "1000", "unit": "kwh"},
            {"type": "2", "total": "500", "unit": "kg"},
            {"type": "3", "total": "200", "unit": "€"},
        ],
    }
    config = {
        "enableCoreEntities": True,
        "enableSystemOverview": True,
    }
    entities = extract_lifetime_statistics_entities(data, "system", config)
    assert entities["total_energy"] == 1000.0
    assert entities["total_co2_savings"] == 500.0
    assert entities["total_money_savings"] == 200.0


def test_extract_skipped_when_group_disabled() -> None:
    data = {
        "type": "system",
        "statistics": [{"type": "1", "total": "10", "unit": "kwh"}],
    }
    entities = extract_lifetime_statistics_entities(
        data, "system", {"enableCoreEntities": True, "enableSystemOverview": False}
    )
    assert "total_energy" not in entities
