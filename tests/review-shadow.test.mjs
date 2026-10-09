import test from "node:test";
import assert from "node:assert/strict";
import { buildReview,scoreForecast,gradeOriginal } from "../scripts/review-shadow.mjs";

const fixture={fixtureId:"1",league:"ger.1",home:"Home FC",away:"Away FC",
  status:"shadow_prediction",kickoff:"2026-10-09T19:00:00Z",
  probabilities:{home_win:.60,draw:.20,away_win:.20,home_or_draw:.80,away_or_draw:.40,
    over_1_5:.7,under_2_5:.4,over_2_5:.6,under_3_5:.8,btts_yes:.55,btts_no:.45}};
function input(completed=true){
  return {date:"2026-10-09",
    snapshots:{candidate:{date:"2026-10-09",asOf:"2026-10-09T12:00:00Z",
      modelVersion:"dc-shadow-v0.3",mode:"shadow_only",promotedToPicks:false,
      coverage:{eligibleLeagueFixtures:1,predicted:1},fixtures:[fixture]}},
    board:{games:[{id:"1",home:"Home FC",away:"Away FC",
      top3:[{label:"Home FC ML",score:92,odds:-175},{label:"Over 2.5 Goals",score:80,odds:-110}]}]},
    scoreboard:{events:[{id:"1",status:{type:{completed}},competitions:[{competitors:[
      {homeAway:"home",score:"2"},{homeAway:"away",score:"1"}
    ]}]}]}
  };
}
test("scores 1X2 and goals markets from saved pre-match probability",()=>{
 const x=scoreForecast(fixture,2,1);
 assert.equal(x.mostLikelyResultCorrect,true);
 assert.equal(x.actual1x2,"home_win");
 assert.equal(x.actualOutcome.over_2_5,true);
 assert.ok(x.multiclassLogLoss>0);
});
test("compares original FootyEdge markets without altering their contents",()=>{
 const source=input(),copy=JSON.stringify(source.board);
 const out=buildReview(source);
 assert.equal(out.fullySettled,true);
 assert.equal(out.metrics.candidate.graded,1);
 assert.deepEqual(out.fixtures[0].originalFootyEdgeSelections.map(p=>p.originalOutcome),["hit","hit"]);
 assert.equal(JSON.stringify(source.board),copy);
});
test("a pending match never receives a fabricated settlement",()=>{
 const x=buildReview(input(false));
 assert.equal(x.fullySettled,false);
 assert.equal(x.metrics.candidate.pending,1);
});
test("ignore any post-kickoff/hindsight model results",()=>{
 const x=input();
 x.snapshots.candidate.asOf="2026-10-09T20:00:00Z";
 const y=buildReview(x);
 assert.equal(y.fullySettled,false);
 assert.equal(y.metrics.candidate.graded,0);
});
test("original national-team picks are marked outside club model scope",()=>{
 const x=input();x.board.games.push({id:"2",home:"England",away:"France",top3:[{label:"England ML"}]});
 const out=buildReview(x);
 assert.equal(out.originalsWithoutSupportedModel.length,1);
});
test("push and unknown player markets are not faked",()=>{
 assert.equal(gradeOriginal({label:"Under 3.0 Goals"},fixture,2,1),"push");
 assert.equal(gradeOriginal({label:"Player to Score"},fixture,2,1),"not_scored_unknown_market");
});
