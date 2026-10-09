import importlib.util
import tempfile
import unittest
from datetime import date, datetime, timezone
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "shadow_dixon_coles.py"
spec = importlib.util.spec_from_file_location("shadow_dixon_coles", SCRIPT)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class StubModel:
    fitted = True
    def predict(self, home, away):
        class Pred:
            home_draw_away = (.50, .25, .25)
            btts_yes = .50
            btts_no = .50
            home_goal_expectation = 1.6
            away_goal_expectation = 1.1
            def totals(self, line):
                p = {1.5: .25, 2.5: .50, 3.5: .75}[line]
                return p, 0, 1-p
        return Pred()

class ShadowModelTests(unittest.TestCase):
    def test_normalization(self):
        self.assertEqual(m.key("Málaga CF"), "malaga")
        self.assertEqual(m.key("Arsenal FC"), m.key("Arsenal"))
        self.assertEqual(m.key("Manchester City"), m.key("Man City"))

    def test_source_dates_and_score_variants(self):
        rows = m.completed_matches({"matches": [
            {"date": "2026-10-08", "team1": "A FC", "team2": "B FC", "score": {"ft": [1, 0]}},
            {"date": "2026-10-09", "team1": "A FC", "team2": "B FC", "score": {"ft": [2, 0]}},
            {"date": "2026-10-07", "team1": "B", "team2": "A", "score": [0, 2]},
            {"date": "2026-10-06", "team1": "A", "team2": "B"},
        ]}, date(2026, 10, 9))
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(row["date"] < date(2026, 10, 9) for row in rows))

    def test_probabilities_are_normalized(self):
        p = m.market_probabilities(StubModel().predict("a", "b"))
        self.assertAlmostEqual(p["home_win"] + p["draw"] + p["away_win"], 1, 5)
        self.assertAlmostEqual(p["btts_yes"] + p["btts_no"], 1, 5)
        self.assertAlmostEqual(p["home_or_draw"], .75, 5)

    def test_fixture_scope_source_quality_and_prediction(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "data").mkdir()
            import json
            (root / "data" / "research-base-2026-10-09.json").write_text(json.dumps({
                "date": "2026-10-09", "fixtures": [
                    {"id": 1, "league": "eng.1", "date": "2026-10-09T15:00:00Z",
                     "home": {"name": "Arsenal FC"}, "away": {"name": "Chelsea FC"}},
                    {"id": 2, "league": "eng.1", "date": "2026-10-09T15:00:00Z",
                     "home": {"name": "Arsenal (W)"}, "away": {"name": "Chelsea (W)"}},
                    {"id": 3, "league": "uefa.nations", "date": "2026-10-09T15:00:00Z",
                     "home": {"name": "Spain"}, "away": {"name": "Italy"}},
                ]}))
            # Many unique completed match days; no future data.
            matchdata = {"matches": [
                {"date": (date(2026, 9, 10) + __import__("datetime").timedelta(days=i // 4)).isoformat(),
                 "team1": "Arsenal FC" if i % 2 else "Chelsea FC",
                 "team2": "Chelsea FC" if i % 2 else "Arsenal FC", "score": {"ft": [1, 0]}}
                for i in range(100)
            ]}
            # Fixture quality gate is mocked: the previous scores are all in one source.
            fetch = lambda _: matchdata
            report = m.forecast_day(root, date(2026, 10, 9),
                                    datetime(2026, 10, 9, 10, tzinfo=timezone.utc),
                                    fetch=fetch, fitter=lambda rows, cutoff: StubModel())
            self.assertEqual(report["coverage"]["eligibleLeagueFixtures"], 1)
            self.assertEqual(report["coverage"]["predicted"], 1)
            self.assertEqual(report["fixtures"][0]["status"], "shadow_prediction")

    def test_missing_research_does_not_invent_games(self):
        with tempfile.TemporaryDirectory() as folder:
            report = m.forecast_day(Path(folder), date(2026, 10, 9),
                                    datetime(2026, 10, 9, tzinfo=timezone.utc))
        self.assertEqual(report["status"], "missing_research_base")
        self.assertEqual(report["fixtures"], [])

if __name__ == "__main__":
    unittest.main()
