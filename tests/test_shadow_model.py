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

    def test_verified_club_aliases(self):
        aliases = [
            ("Espanyol", "RCD Espanyol de Barcelona"),
            ("Lens", "Racing Club de Lens"),
            ("Lyon", "Olympique Lyonnais"),
            ("Werder Bremen", "SV Werder Bremen"),
            ("Heerenveen", "SC Heerenveen"),
            ("Braga", "Sporting Clube de Braga"),
            ("Sporting CP", "Sporting Clube de Portugal"),
        ]
        for public, source in aliases:
            with self.subTest(public=public):
                self.assertEqual(m.key(public), m.key(source))

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
                {"date": (date(2026, 6, 27) + __import__("datetime").timedelta(days=i)).isoformat(),
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

    def test_verified_final_scores_only_as_next_day_training_input(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "data" / "boards").mkdir(parents=True)
            day = date(2026, 10, 9)
            import json
            (root / "data" / "boards" / "2026-10-09.json").write_text(json.dumps({
                "date": "2026-10-09",
                "games": [
                    {"id": "100", "league": "ger.1", "home": "Borussia Dortmund", "away": "Werder Bremen"},
                    {"id": "200", "league": "eng.1", "home": "Arsenal", "away": "Chelsea"},
                    {"id": "300", "league": "ger.1", "home": "Bayern (W)", "away": "Essen (W)"}
                ]
            }))
            (root / "data" / "2026-10-09").mkdir(parents=True)
            (root / "data" / "2026-10-09" / "scoreboard.json").write_text(json.dumps({
                "events": [
                    {"id": "100", "status": {"type": {"completed": True}},
                     "competitions": [{"competitors": [
                         {"homeAway": "home", "score": "2"},
                         {"homeAway": "away", "score": "1"}]}]},
                    {"id": "300", "status": {"type": {"completed": True}},
                     "competitions": [{"competitors": [
                         {"homeAway": "home", "score": "4"},
                         {"homeAway": "away", "score": "0"}]}]},
                    {"id": "200", "status": {"type": {"completed": False}},
                     "competitions": [{"competitors": [
                         {"homeAway": "home", "score": "0"},
                         {"homeAway": "away", "score": "0"}]}]}
                ]}))
            rows, ids = m.load_verified_prior_scores(root, "ger.1", date(2026, 10, 10))
            self.assertEqual(ids, ["100"])
            self.assertEqual(rows[0]["hg"], 2)
            self.assertEqual(rows[0]["date"], day)
            previous, ids = m.load_verified_prior_scores(root, "ger.1", date(2026, 10, 9))
            self.assertEqual(previous, [])
            self.assertEqual(ids, [])

    def test_supplement_duplicates_are_deduplicated_and_conflicts_exposed(self):
        day = date(2026, 10, 9)
        a = {"date": day, "home": "dortmund", "away": "bremen", "hg": 2, "ag": 1}
        more, bad = m.merge_results([a], [dict(a), {**a, "hg": 3}])
        self.assertEqual(len(more), 1)
        self.assertEqual(bad, 1)

    def test_missing_research_does_not_invent_games(self):
        with tempfile.TemporaryDirectory() as folder:
            report = m.forecast_day(Path(folder), date(2026, 10, 9),
                                    datetime(2026, 10, 9, tzinfo=timezone.utc))
        self.assertEqual(report["status"], "missing_research_base")
        self.assertEqual(report["fixtures"], [])

if __name__ == "__main__":
    unittest.main()
