import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {distinctPickSet,marketThesis,selectionEvidence} from "../scripts/independent-picks.mjs";
const research=(label,family,confidenceRating=80,extra={})=>({label,family,
 category:family==="result"?"Double Chance":family==="total"?"Goals":"Team Goals",
 confidenceRating,sourceBackedReason:true,reason:"Both teams' previous ten source-dated matches and available model evidence support this market line.",...extra});
test("Chelsea example retains distinct result and total but eliminates duplicate scoring dependency",()=>{
 const input=[research("Over 1.5 Goals","total",90),research("Chelsea 1+ Goal","team-goal",89),research("Chelsea or Draw","result",81)];
 assert.deepEqual(distinctPickSet(input).map(x=>x.label),["Over 1.5 Goals","Chelsea or Draw"]);
});
test("one goal threshold and another goal threshold do not qualify as two edges",()=>{
 const picks=[research("Under 4.5 Goals","total",93),research("Over 1.5 Goals","total",87),research("BTTS Yes","btts",82)];
 assert.equal(distinctPickSet(picks).length,1);
});
test("reported event sample with opponent allowance can qualify as a separate third event family",()=>{
 const base=[research("Over 2.5 Goals","total",85),research("Arsenal or Draw","result",78)];
 const supported=research("Player 1+ Foul Committed","fouls",76,{marketEvidence:{verified:true,playerSample:10,opponentAllowanceSample:10,playerMarket:true,playerAvailable:true}});
 assert.equal(distinctPickSet([...base,supported]).length,3);
 const unsupported=research("Player 1+ Foul Committed","fouls",76,{marketEvidence:{verified:false,playerSample:10,opponentAllowanceSample:0}});
 assert.equal(distinctPickSet([...base,unsupported]).length,2);
 assert.equal(selectionEvidence(unsupported),false);
});
test("same-side goal and result not counted separately without genuinely different underlying driver",()=>{
 const picks=[research("Manchester City 1+ Goal","team-goal",90),
  research("Manchester City or Draw","result",81)];
 assert.equal(distinctPickSet(picks).length,1);
});
test("live Original UI uses a team palette on both WDL bar ends, neutral draw",()=>{
 const ui=fs.readFileSync("ui/part2.html","utf8");
 assert.match(ui,/background:'\+esc\(fePalette\(g\.home\)\.primary\)/);
 assert.match(ui,/background:'\+esc\(fePalette\(g\.away\)\.primary\)/);
 assert.match(ui,/background:#66726f/);
 assert.match(ui,/feDistinctTop3\(sourcePicks\)/);
});
