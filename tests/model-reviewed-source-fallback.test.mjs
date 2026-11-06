import test from "node:test";
import assert from "node:assert/strict";
import {mergeModelReviewed} from "../scripts/build-source-led-picks.mjs";
const day="2026-11-06",base={date:day,totals:{fixtures:1,zero:1,three:0,two:0,one:0,sourceOpinionRecords:0,sourceMarketTips:0},
 top5:[],matches:[{gameId:"1",league:"eng.1",home:"A",away:"B",picks:[],qualifyingInputs:{sourcedMarketPicks:0}}]};
const picks=["A or Draw","Under 3.5 Goals","B 1+ Goal"].map((label,i)=>({
 label,family:["result","total","team-goal"][i],homeSample:10,awaySample:10,
 experimentalFrequencyPct:[75,79,61][i],confidenceRating:[74,76,65][i],
 probabilityCalibrated:false,reason:"Observed match history and modeled outcome."
}));
test("Three independent model-reviewed categories may fill missing publisher votes without claiming editorial sourcing",()=>{
 const a=mergeModelReviewed({doc:base,review:{date:day,matches:[{gameId:"1",league:"eng.1",home:"A",away:"B",picks}]},
  simulation:{date:day,simulationsPerFixture:10000,fixtures:[{fixtureId:"1",status:"pre_kickoff_experimental"}]}});
 assert.equal(a.totals.three,1);
 assert.equal(a.matches[0].picks.length,3);
 assert.equal(a.matches[0].editorialSourceCount,undefined);
 assert.ok(a.matches[0].picks.every(p=>p.modelResearchOnly&&p.editorialSupport===0&&p.odds===null&&!p.probabilityCalibrated));
 assert.equal(a.top5FrozenBoardPreserved,true);
});
test("Never replace dated source-only record with unverified or retrospective model data",()=>{
 const a=mergeModelReviewed({doc:base,review:{date:day,matches:[{gameId:"1",league:"eng.1",home:"A",away:"B",picks}]},
  simulation:{date:day,simulationsPerFixture:10000,fixtures:[{fixtureId:"1",status:"retrospective_after_kickoff"}]}});
 assert.equal(a.totals.zero,1);
 assert.equal(a.matches[0].picks.length,0);
 assert.throws(()=>mergeModelReviewed({doc:base,review:{date:"2026-11-05",matches:[]},
  simulation:{date:day,simulationsPerFixture:10000,fixtures:[]}}));
});
