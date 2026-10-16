"""SGP audit must never promote historical ratings or singles to combined odds."""
import importlib.util
import unittest
from pathlib import Path

FILE = Path(__file__).resolve().parents[1] / "scripts" / "sgp_readiness.py"
spec = importlib.util.spec_from_file_location("sgp_readiness", FILE)
sgp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sgp)


class SgpReadinessTests(unittest.TestCase):
    def test_correlation_and_no_combined_price(self):
        board = {"date": "2026-10-16", "immutable": True, "games": [
            {"id": 18, "home": "Home", "away": "Away", "top3": [
                {"label": "Over 1.5 Goals", "confidenceRating": 90,
                 "verifiedPrice": True, "displayOdds": "-350", "provider": "DraftKings",
                 "calibratedProbability": .87, "probabilityCalibrated": True},
                {"label": "Both Teams to Score", "confidenceRating": 88},
                {"label": "Home 1+ Goal", "confidenceRating": 86},
            ]}]}
        r = sgp.analyze(board)
        g = r["games"][0]
        self.assertTrue(r["boardImmutable"])
        self.assertIsNone(r["combinedOdds"])
        self.assertIsNone(r["ev"])
        self.assertFalse(g["bookable"])
        self.assertIn("btts_correlates_with_total_goals", g["overlapFlags"])
        self.assertIn("team_goal_implied_by_btts", g["overlapFlags"])
        self.assertIn("missing_bookmaker_combined_quote", g["blockers"])
        self.assertEqual(g["candidateLegs"][0]["odds"], "-350")
        self.assertIsNone(g["candidateLegs"][1]["odds"])
        self.assertEqual(g["candidateLegs"][0]["researchRating"], 90)

    def test_missing_games_is_not_filled_or_fabricated(self):
        data = sgp.analyze({"date": "2026-10-16", "games": []})
        self.assertEqual(data["games"], [])
        self.assertFalse(data["readyToPublish"])

    def test_distinct_player_and_goal_markets(self):
        self.assertEqual(sgp.overlap(["Player 1+ shots", "Under 3.5 Goals"]), [])


if __name__ == "__main__":
    unittest.main()
