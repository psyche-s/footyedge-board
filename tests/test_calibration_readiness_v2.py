import importlib.util
import unittest
from pathlib import Path

SCRIPT=Path(__file__).resolve().parents[1]/"scripts/calibration_readiness_v2.py"
spec=importlib.util.spec_from_file_location("calibration_readiness_v2",SCRIPT)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def sample(p=(.6,.2,.2),outcome="home_win"):
    return {"pred":{"home_win":p[0],"draw":p[1],"away_win":p[2]},
            "actual":{k:k==outcome for k in mod.KEYS}}


class CalibrationReadinessTests(unittest.TestCase):
    def test_valid_small_holdout_is_not_calibrated(self):
        x=mod.evaluate({"mode":"retrospective_holdout_not_original_footyedge_picks",
                       "evaluatedMatches":[sample(),sample(outcome="away_win")]})
        self.assertEqual(x["scoredMatches"],2)
        self.assertEqual(x["accuracyTop1"],.5)
        self.assertEqual(x["multiclassBrier"],.84)
        self.assertFalse(x["calibrated"])
        self.assertFalse(x["eligibleForMarketEV"])
        self.assertFalse(x["eligibleFor90PercentConfidenceDisplay"])
        self.assertEqual(x["status"],"insufficient_sample_no_probability_certification")

    def test_future_lookahead_not_passed_off_as_original_picks(self):
        with self.assertRaises(ValueError):
            mod.evaluate({"mode":"official_picks","evaluatedMatches":[sample()]})

    def test_out_of_range_probabilities_fail_closed(self):
        d=mod.evaluate({"mode":"retrospective_holdout_not_original_footyedge_picks",
                        "evaluatedMatches":[sample((1.3,-.5,.2)),sample()]})
        self.assertEqual(d["scoredMatches"],1)
        self.assertEqual(d["rejectedInvalidMatches"],1)

    def test_sparse_confidence_bucket_remains_unknown(self):
        d=mod.evaluate({"mode":"retrospective_holdout_not_original_footyedge_picks",
                        "evaluatedMatches":[sample()]})
        empty=[v for v in d["bands"] if v["n"]==0]
        self.assertTrue(empty)
        self.assertTrue(all(v["observedAccuracy"] is None for v in empty))


if __name__=="__main__":
    unittest.main()
