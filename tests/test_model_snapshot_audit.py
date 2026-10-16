import importlib.util
import unittest
from pathlib import Path
FILE=Path(__file__).resolve().parents[1]/"scripts"/"model_snapshot_audit.py"
spec=importlib.util.spec_from_file_location("audit_model_snapshot",FILE)
audit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class AuditTests(unittest.TestCase):
    def base(self):
        return {"date":"2026-10-16","asOf":"2026-10-16T04:15:00Z",
                "status":"completed","promotedToPicks":False,
                "coverage":{"eligibleLeagueFixtures":1,"predicted":1},
                "fixtures":[{"status":"predicted"}],"leagueDiagnostics":{}}
    def test_successful_synthetic_run_is_not_published(self):
        report=audit.inspect_snapshot(self.base())
        self.assertEqual(report["actualForecastStatus"],"model_execution_only")
        self.assertFalse(report["calibrated"])
        self.assertFalse(report["eligibleForPublication"])
        self.assertEqual(report["blockers"],[])
    def test_after_freeze_is_not_valid_prematch(self):
        d=self.base()
        d["asOf"]="2026-10-16T04:35:00Z"
        r=audit.inspect_snapshot(d)
        self.assertIn("forecast_generated_after_official_freeze",r["blockers"])
    def test_workflow_completed_with_no_predictions_is_failure(self):
        d=self.base()
        d["coverage"]["predicted"]=0
        d["fixtures"][0]["status"]="fit_failed"
        d["leagueDiagnostics"]={"eng.2":{"status":"fit_failed",
                          "error":"ModuleNotFoundError: No module named 'penaltyblog'"}}
        r=audit.inspect_snapshot(d)
        self.assertEqual(r["actualForecastStatus"],"no_forecasts")
        self.assertIn("no_actual_forecasts",r["blockers"])
        self.assertTrue(r["failedFitMessages"])
    def test_mismatched_counts_not_approved(self):
        d=self.base()
        d["coverage"]["predicted"]=3
        r=audit.inspect_snapshot(d)
        self.assertIn("coverage_prediction_count_mismatch",r["blockers"])


if __name__=="__main__":
    unittest.main()
