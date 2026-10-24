import test from "node:test";
import assert from "node:assert/strict";
import {audit} from "../scripts/audit-source-consensus.mjs";
import {addAuditedConsensus} from "../scripts/build-consensus-reviewed.mjs";
const date="2026-10-25";
const base={
 schema:"footyedge-dated-researched-top3-v1",date,archiveUnmodified:true,method:"test",
 matches:[{gameId:"f1",home:"Home United",away:"Away City",league:"eng.1",reviewed:true,
 picks:[
  {label:"Home United or Draw",family:"result",confidenceRating:81,reason:"10 verified recent matches demonstrate a strong home-or-draw trend."},
  {label:"Over 1.5 Goals",family:"total",confidenceRating:79,reason:"Past home and away games contain scoring opportunities."},
  {label:"BTTS Yes",family:"btts",confidenceRating:68,reason:"Each side has recently scored."}
 ]}]
};
const win="https://www.windrawwin.com/predictions/future/20261025/";
const mole="https://www.sportsmole.co.uk/football/example.html";
const whispers="https://footballwhispers.com/blog/example/";
const opinion=(source,prediction,url,market="match_winner")=>({
 fixtureId:"f1",source,market,prediction,kind:"explicit_pre_match_prediction",
 fixtureDate:date,url,verifiedAt:"2026-10-25T03:00:00Z"
});
const doc=opinions=>({date,capturedAt:"2026-10-25T03:00:00Z",opinions});
test("two distinct matching publishers support result direction, not other markets",()=>{
 const c=audit(base,doc([opinion("windrawwin","home",win),opinion("sports_mole","home",mole)]));
 assert.equal(c.summary.fixturesWithTwoOrMoreIndependentSources,1);
 assert.equal(c.summary.picksWithTwoSourceAgreement,1);
 assert.equal(c.summary.invalidRecords,0);
 assert.equal(c.matches[0].picks[0].verdict,"independent_agreement");
 assert.equal(c.matches[0].picks[1].verdict,"not_independently_checked");
 const result=addAuditedConsensus(base,c);
 assert.equal(result.matches[0].picks[0].confidenceRating,81);
 assert.match(result.matches[0].picks[0].reason,/Two distinct pre-match forecasts/);
 assert.doesNotMatch(result.matches[0].picks[0].reason,/WinDrawWin|Sports Mole|https?:/);
});
test("opposite winner predictions are flagged and never called consensus",()=>{
 const c=audit(base,doc([opinion("windrawwin","home",win),opinion("football_whispers","away",whispers)]));
 assert.equal(c.summary.picksWithConflictingForecasts,1);
 assert.equal(c.summary.picksWithTwoSourceAgreement,0);
 assert.match(addAuditedConsensus(base,c).matches[0].picks[0].reason,/disagree/);
});
test("one publisher, even repeated, cannot fabricate agreement",()=>{
 const c=audit(base,doc([opinion("windrawwin","home",win),opinion("windrawwin","home",win)]));
 assert.equal(c.summary.invalidRecords,1);
 assert.equal(c.summary.picksWithTwoSourceAgreement,0);
});
test("wrong date and foreign provider URLs are rejected, never converted into votes",()=>{
 const wrong=opinion("sports_mole","home","https://unrelated.example/article");
 const stale={...opinion("windrawwin","home",win),fixtureDate:"2026-10-24"};
 const c=audit(base,doc([wrong,stale]));
 assert.equal(c.summary.invalidRecords,2);
 assert.equal(c.summary.fixturesWithExternalPrediction,0);
 assert.equal(c.summary.picksNotIndependentlyChecked,3);
});
test("source names and fake odds never appear in public consensus reasons",()=>{
 const c=audit(base,doc([opinion("windrawwin","home",win),opinion("sports_mole","home",mole)]));
 const r=addAuditedConsensus(base,c).matches[0].picks[0];
 assert.ok(!/windrawwin|sports.mole|http/i.test(r.reason));
 assert.equal(r.confidenceRating,81);
 assert.equal(r.verifiedPrice,undefined);
});
