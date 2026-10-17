import importlib.util
import unittest
from datetime import datetime, date, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("research_prefreeze_v2",ROOT/"scripts/research_prefreeze_v2.py")
gate=importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def research(generated="2026-10-16T04:10:00Z", kickoff="2026-10-16T19:00:00Z"):
    return {"date":"2026-10-16", "generatedAt":generated, "fixtures":[
        {"id":"401234","league":"eng.1","date":kickoff},
        {"id":"401235","league":"eng.2","date":"2026-10-16T21:00:00Z"}
    ]}


class PreFreezeTests(unittest.TestCase):
    def test_real_prematch_and_correct_toronto_offset(self):
        r=gate.assess(date(2026,10,16),datetime(2026,10,16,4,20,tzinfo=timezone.utc),research())
        self.assertEqual(r["status"],"eligible_for_shadow_training")
        self.assertEqual(r["freezeToronto"],"2026-10-16T00:30:00-04:00")
        self.assertEqual(r["prematchEligibleFixtureCount"],2)
        self.assertFalse(r["publishPicks"])
        self.assertFalse(r["calibrated"])

    def test_winter_dst_uses_utc_minus_five(self):
        r=gate.assess(date(2027,1,14),datetime(2027,1,14,5,20,tzinfo=timezone.utc),
                      {"date":"2027-01-14","generatedAt":"2027-01-14T05:10:00Z","fixtures":[
                          {"id":"a1","league":"eng.1","date":"2027-01-14T20:00:00Z"}]})
        self.assertEqual(r["status"],"eligible_for_shadow_training")
        self.assertEqual(r["freezeToronto"],"2027-01-14T00:30:00-05:00")

    def test_after_freeze_and_late_research_are_blocked(self):
        r=gate.assess(date(2026,10,16),datetime(2026,10,16,4,40,tzinfo=timezone.utc),
                      research(generated="2026-10-16T04:34:51Z"))
        self.assertIn("model_run_started_after_freeze",r["blockers"])
        self.assertIn("research_generated_after_freeze",r["blockers"])

    def test_stale_research_and_future_generated_rejected(self):
        r=gate.assess(date(2026,10,16),datetime(2026,10,16,4,20,tzinfo=timezone.utc),
                      research(generated="2026-10-16T04:34:51Z"))
        self.assertIn("research_created_after_model_time",r["blockers"])
        r=gate.assess(date(2026,10,16),datetime(2026,10,16,4,20,tzinfo=timezone.utc),
                      research(generated="2026-10-15T23:10:00Z"))
        self.assertIn("stale_research_for_model",r["blockers"])

    def test_past_kickoffs_and_invalid_identifiers_are_blocked(self):
        r=gate.assess(date(2026,10,16),datetime(2026,10,16,4,20,tzinfo=timezone.utc),
                      research(kickoff="2026-10-15T19:00:00Z"))
        self.assertEqual(r["prematchEligibleFixtureCount"],1)
        doc=research()
        doc["fixtures"].append(dict(doc["fixtures"][0]))
        r=gate.assess(date(2026,10,16),datetime(2026,10,16,4,20,tzinfo=timezone.utc),doc)
        self.assertIn("duplicate_or_missing_fixture_identity",r["blockers"])

    def test_zero_supported_games_and_invalid_metadata(self):
        r=gate.assess(date(2026,10,16),datetime(2026,10,16,4,20,tzinfo=timezone.utc),
                      {"date":"2026-10-16","generatedAt":"2026-10-16T04:10:00Z","fixtures":[]})
        self.assertEqual(r["status"],"not_ready")
        self.assertIn("no_supported_model_fixtures",r["blockers"])
        r=gate.assess(date(2026,10,16),datetime(2026,10,16,4,20,tzinfo=timezone.utc),None)
        self.assertIn("missing_or_wrong_date_research",r["blockers"])


if __name__=="__main__":
    unittest.main()
