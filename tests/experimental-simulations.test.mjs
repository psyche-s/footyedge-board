import {test} from "node:test";
import assert from "node:assert/strict";
import {runForecast} from "../scripts/simulate-fixtures.mjs";
const date="2026-10-25",asof="2026-10-25T00:00:00Z",kickoff="2026-10-25T18:00:00Z";
const record=(id,gf,ga,dt="2026-10-15T18:00:00Z")=>({id,date:dt,venue:"home",gf,ga,result:gf>ga?"W":gf<ga?"L":"D"});
const match=(id="f1")=>({id,league:"eng.1",date:kickoff,home:{id:"1",name:"Alpha"},away:{id:"2",name:"Beta"},last10:{home:Array.from({length:10},(_,i)=>record("h"+i,2,1)),away:Array.from({length:10},(_,i)=>record("a"+i,1,2))}});
test("each match gets the requested draws, normalized WDL and a feasible score mode",()=>{
 const o=runForecast({research:{date,fixtures:[match()]},analytics:{matches:[]},h2h:{fixtures:[]},teamNews:{fixtures:[]},asof,simulations:10000});
 assert.equal(o.totalSimulations,10000);
 assert.equal(o.fixtures.length,1);
 const f=o.fixtures[0];
 assert.equal(f.simulations,10000);
 assert.ok(Math.abs(Object.values(f.winDrawLossPct).reduce((a,b)=>a+b,0)-100)<0.02);
 assert.match(f.predictedScore,/^\d+-\d+$/);
 assert.ok(f.predictedScoreProbabilityPct>0 && f.predictedScoreProbabilityPct<100);
 assert.equal(f.status,"pre_kickoff_experimental");
 assert.equal(f.dataQuality.verifiedXg,false);
});
test("deterministic seed gives the same WDL and scores",()=>{
 const args={research:{date,fixtures:[match()]},asof,simulations:10000};
 const a=runForecast(args),b=runForecast(args);
 assert.deepEqual(a.fixtures,b.fixtures);
});
test("pre-kickoff history gate excludes results recorded after scheduled kickoff",()=>{
 const f=match();
 f.last10.home.push(record("leak",15,0,"2026-10-26T00:00:00Z"));
 const x=runForecast({research:{date,fixtures:[f]},asof,simulations:10000});
 assert.equal(x.fixtures[0].dataQuality.homeHistoryGames,10);
});
test("late generation is marked invalid as a pre-match prediction",()=>{
 const f=runForecast({research:{date,fixtures:[match()]},asof:"2026-10-25T19:00:00Z",simulations:1000});
 assert.equal(f.fixtures[0].status,"post_kickoff_research_run_not_valid_pre_match");
});
