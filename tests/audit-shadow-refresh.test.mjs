import test from "node:test";
import assert from "node:assert/strict";
import { auditShadow } from "../scripts/audit-shadow-refresh.mjs";

const DAY = "2026-10-09";
function fixture(id, status = "shadow_prediction") {
  return {
    fixtureId: String(id), kickoff: "2026-10-09T19:00:00Z", status,
    probabilities: status === "shadow_prediction" ?
      {home_win: .4, draw: .3, away_win: .3} : undefined,
  };
}
function valid() {
  return {
    date: DAY, mode: "shadow_only", promotedToPicks: false,
    modelVersion: "dc-shadow-v0.2", asOf: "2026-10-09T09:35:00Z",
    coverage: {inputFixtures: 17, eligibleLeagueFixtures: 2, predicted: 2},
    fixtures: [fixture(1), fixture(2)],
  };
}
test("accepts coherent all-covered shadow data without using it for official picks", () => {
  const x = auditShadow(valid(), DAY);
  assert.equal(x.status, "ready");
  assert.equal(x.predicted, 2);
  assert.equal(x.useForPublishedPicks, false);
});
test("missing data is advisory and does not block picks", () => {
  assert.equal(auditShadow(null, DAY).status, "missing");
});
test("partial fixture forecasts are reported, not silently called ready", () => {
  const x = valid(); x.coverage.predicted = 1;
  x.fixtures[1] = fixture(2, "unknown_or_undersampled_team");
  assert.equal(auditShadow(x, DAY).status, "partial");
  assert.equal(auditShadow(x, DAY).skipped, 1);
});
test("rejects incorrect day or attempts to promote experimental probabilities", () => {
  const a = valid(); a.date = "2026-10-10";
  assert.equal(auditShadow(a, DAY).status, "invalid");
  const b = valid(); b.promotedToPicks = true;
  assert.equal(auditShadow(b, DAY).status, "invalid");
});
test("rejects any in-play prediction and inflated declared coverage", () => {
  const a = valid(); a.fixtures[0].kickoff = "2026-10-09T08:00:00Z";
  assert.equal(auditShadow(a, DAY).status, "invalid");
  const b = valid(); b.coverage.predicted = 3;
  assert.equal(auditShadow(b, DAY).status, "invalid");
});
test("zero eligible league fixtures are not a model failure", () => {
  const x = valid(); x.fixtures = [];
  x.coverage.eligibleLeagueFixtures = 0; x.coverage.predicted = 0;
  assert.equal(auditShadow(x, DAY).status, "no_supported_fixtures");
});
