"""Source-integrity, point-in-time and numerical tests for the optional forecast model."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import unittest

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from forecast_model import (
    forecast_goals,
    two_way_no_vig_implied,
    model_edge_pp,
)


def make_history() -> pd.DataFrame:
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    rows = []
    teams = ["arsenal", "chelsea", "liverpool", "brighton", "tottenham"]
    # 125 prior official-style completed matches, balanced across venue splits.
    for idx in range(125):
        home = teams[idx % len(teams)]
        away = teams[(idx + (1 + (idx // len(teams)) % (len(teams) - 1))) % len(teams)]
        rows.append({
            "leagueCode": "E0", "homeKey": home, "awayKey": away,
            "kickoff": start + timedelta(days=idx),
            "played": True,
            "FTHG": 2 if home == "arsenal" else (idx % 3),
            "FTAG": 1 if away == "chelsea" else (idx % 2),
        })
    return pd.DataFrame(rows)


class ForecastModelTests(unittest.TestCase):
    def test_rejects_insufficient_data(self):
        cutoff = datetime(2026, 10, 23, tzinfo=timezone.utc)
        self.assertIsNone(forecast_goals(make_history().head(25), "E0", "arsenal", "chelsea", cutoff))

    def test_goal_rates_deterministic_and_normalized(self):
        cutoff = datetime(2026, 10, 23, tzinfo=timezone.utc)
        first = forecast_goals(make_history(), "E0", "arsenal", "chelsea", cutoff)
        second = forecast_goals(make_history(), "E0", "arsenal", "chelsea", cutoff)
        self.assertIsNotNone(first)
        self.assertEqual(first, second)
        assert first is not None
        self.assertFalse(first["calibrated"])
        self.assertGreater(first["homeLambda"], 0)
        self.assertGreater(first["awayLambda"], 0)
        self.assertAlmostEqual(first["homeWin"] + first["draw"] + first["awayWin"], 100, delta=0.2)
        self.assertTrue(0 < first["over25"] < 100)
        self.assertEqual(first["sample"]["league"], 125)

    def test_future_results_cannot_leak_into_forecast(self):
        cutoff = datetime(2026, 10, 23, tzinfo=timezone.utc)
        past = make_history()
        baseline = forecast_goals(past, "E0", "arsenal", "chelsea", cutoff)
        future = pd.DataFrame([{
            "leagueCode": "E0", "homeKey": "arsenal", "awayKey": "chelsea",
            "kickoff": cutoff + timedelta(days=2), "played": True,
            "FTHG": 99, "FTAG": 0
        }])
        polluted = forecast_goals(pd.concat([past, future], ignore_index=True),
                                  "E0", "arsenal", "chelsea", cutoff)
        self.assertEqual(baseline, polluted)

    def test_no_vig_comparison_is_explicit_and_gated(self):
        self.assertAlmostEqual(two_way_no_vig_implied(2.0, 2.0), 0.5)
        self.assertIsNone(two_way_no_vig_implied(1.0, 2.0))
        self.assertIsNone(two_way_no_vig_implied(float("nan"), 2.0))
        self.assertEqual(model_edge_pp(55.0, 0.5), 5.0)
        self.assertIsNone(model_edge_pp(101.0, 0.5))
        self.assertIsNone(model_edge_pp(55.0, -0.1))

    def test_never_use_not_played_records(self):
        data = make_history()
        cutoff = datetime(2026, 10, 23, tzinfo=timezone.utc)
        baseline = forecast_goals(data, "E0", "arsenal", "chelsea", cutoff)
        fake = data.iloc[[0]].copy()
        fake["FTHG"], fake["FTAG"], fake["played"] = 70, 0, False
        other = forecast_goals(pd.concat([data, fake], ignore_index=True),
                               "E0", "arsenal", "chelsea", cutoff)
        self.assertEqual(baseline, other)


if __name__ == "__main__":
    unittest.main()
