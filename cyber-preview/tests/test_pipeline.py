import sys
from datetime import datetime, timezone
from pathlib import Path
import unittest

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from build_dashboard_data import canonical, normalize, generate


class PipelineTests(unittest.TestCase):
    def test_alias_and_accent(self):
        self.assertEqual(canonical("Nottm Forest"), "nottingham forest")
        self.assertEqual(canonical("MÁLAGA"), "malaga")

    def test_no_fake_xg_or_lines(self):
        frame = normalize(pd.DataFrame([
            {"Date": "02/10/2026", "Time": "15:00", "HomeTeam": "Team A", "AwayTeam": "Team B",
             "FTHG": 2, "FTAG": 1, "HS": 10, "AS": 6},
            {"Date": "25/10/2026", "Time": "15:00", "HomeTeam": "Team A", "AwayTeam": "Team B",
             "FTHG": None, "FTAG": None},
        ]), "E0")
        data = generate(frame, datetime(2026, 10, 23, tzinfo=timezone.utc), horizon_days=10)
        self.assertEqual(len(data["matches"]), 1)
        game = data["matches"][0]
        self.assertIsNone(game["homeXG"])
        self.assertIsNone(game["awayXG"])
        self.assertIsNone(game["projectedShots"])
        self.assertIsNone(game["sgp"])
        self.assertIsNone(game["modelForecast"])
        self.assertEqual(game["homeTeam"]["form"], ["W"])
        self.assertEqual(game["homeTeam"]["goalsFor"], 2.0)
        self.assertEqual(len(game["h2h"]), 1)

    def test_completed_matches_excluded(self):
        frame = normalize(pd.DataFrame([{"Date": "25/10/2026", "HomeTeam": "A",
                                         "AwayTeam": "B", "FTHG": 1, "FTAG": 1}]), "E0")
        data = generate(frame, datetime(2026, 10, 23, tzinfo=timezone.utc))
        self.assertFalse(data["matches"])


if __name__ == "__main__":
    unittest.main()
