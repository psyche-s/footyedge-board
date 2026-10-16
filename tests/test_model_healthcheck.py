"""Offline checks for dependency preflight. No package installation needed."""
import importlib.util
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

MOD = Path(__file__).resolve().parents[1] / "scripts" / "model_healthcheck.py"
spec = importlib.util.spec_from_file_location("model_healthcheck", MOD)
health = importlib.util.module_from_spec(spec)
spec.loader.exec_module(health)


class GoodPred:
    home_draw_away = (.45, .29, .26)
    home_goal_expectation = 1.35
    away_goal_expectation = 1.08


class WorkingStub:
    fitted = True
    def __init__(self, goals_home, goals_away, teams_home, teams_away, weights):
        assert len(goals_home) == len(weights) == 144
        assert len(teams_home) == len(teams_away) == len(goals_away)
    def fit(self, use_gradient, minimizer_options):
        assert use_gradient and minimizer_options["maxiter"] > 1
    def predict(self, home, away):
        assert home != away
        return GoodPred()


class BrokenFit(WorkingStub):
    fitted = False


class BrokenPred(WorkingStub):
    def predict(self, home, away):
        return SimpleNamespace(home_draw_away=(.40, .40, .40),
                               home_goal_expectation=1.1, away_goal_expectation=1.2)


class HealthTests(unittest.TestCase):
    def test_ready_when_binary_fit_and_prediction_api_work(self):
        pkg = SimpleNamespace(models=SimpleNamespace(DixonColesGoalModel=WorkingStub),
                              __version__="test")
        report = health.check(pkg)
        self.assertEqual(report["status"], "ready")
        self.assertFalse(report["calibrated"])
        self.assertEqual(report["checks"]["prediction_api"], "passed")

    def test_failed_optimizer_is_not_ready(self):
        pkg = SimpleNamespace(models=SimpleNamespace(DixonColesGoalModel=BrokenFit))
        report = health.check(pkg)
        self.assertEqual(report["status"], "failed")
        self.assertIn("Optimizer", report["error"])

    def test_probabilities_must_sum_to_one(self):
        pkg = SimpleNamespace(models=SimpleNamespace(DixonColesGoalModel=BrokenPred))
        report = health.check(pkg)
        self.assertEqual(report["status"], "failed")
        self.assertIn("sum to one", report["error"])

    def test_missing_package_api_reports_clean_failure(self):
        report = health.check(SimpleNamespace())
        self.assertEqual(report["status"], "failed")
        self.assertIn("AttributeError", report["error"])


if __name__ == "__main__":
    unittest.main()
