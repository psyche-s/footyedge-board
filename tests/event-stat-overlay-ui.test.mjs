import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
test("original team-event projections are read-only overlay that preserves score and WDL",()=>{
 const ui=fs.readFileSync("ui/part2.html","utf8");
 assert.match(ui,/data\/event-projection-overlays\//);
 assert.match(ui,/additional\.kickoff===published\.kickoff/);
 assert.match(ui,/const published=S.feSimById\?\.get/);
 assert.match(ui,/statTotals:\{\.\.\.\(published.statTotals/);
 assert.match(ui,/eventResearchDerivedLater:true/);
});
test("only original scheduled publisher collects future event data before V3",()=>{
 const w=fs.readFileSync(".github/workflows/archive-board.yml","utf8");
 assert.ok(w.indexOf("node scripts/build-verified-event-projections.mjs")>=0);
 assert.ok(w.indexOf("node scripts/build-verified-event-projections.mjs")<w.indexOf("node scripts/simulate-matchups-v3.mjs"));
});
