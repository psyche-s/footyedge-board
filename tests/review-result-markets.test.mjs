import test from "node:test";
import assert from "node:assert/strict";
import {evaluateMatch,evaluateSlate} from "../scripts/review-result-markets.mjs";
const date="2026-10-17T19:00:00Z";
function rows(results){return results.map((v,i)=>({id:"h"+i,date:"2026-10-"+String(i+1).padStart(2,"0")+"T12:00:00Z",
  gf:v==="W"?2:v==="D"?1:0,ga:v==="L"?2:v==="D"?1:0}));}
function g(home="WWWWWWWDDL",away="LLLLLLWDWD"){
 return {id:"game1",date,league:"eng.1",home:{name:"Hosts"},away:{name:"Visitors"},
   last10:{home:rows(home.split("")),away:rows(away.split(""))}};
}
test("ML watch when strong team victories and opponent losses support result",()=>{
 const x=evaluateMatch(g(),"2026-10-17T05:00:00Z");
 assert.equal(x.resultMarkets[0].label,"Hosts ML");
 assert.equal(x.resultMarkets[0].reviewStatus,"research-watch");
 assert.equal(x.resultMarkets[0].firstSample.hits,7);
 assert.equal(x.resultMarkets[0].opponentSample.hits,6);
 assert.equal(x.resultMarkets[0].modelProbability,null);
 assert.equal(x.resultMarkets[0].odds,null);
 assert.equal(x.resultMarkets[0].isOfficialPick,false);
});
test("No ML manufactured when only one side shows good form",()=>{
 const x=evaluateMatch(g("WWWWWWWWWW","WWWWWWWWWW"),"2026-10-17T05:00:00Z");
 assert.equal(x.resultMarkets[0].reviewStatus,"pass-weak-or-mixed-support");
 assert.equal(x.resultMarkets[2].reviewStatus,"pass-weak-or-mixed-support");
});
test("Future results excluded and insufficient sample blocks watch",()=>{
 const x=g();x.last10.away=x.last10.away.slice(0,3);
 x.last10.home.push({date:"2026-10-20T10:00:00Z",gf:20,ga:0});
 const y=evaluateMatch(x,"2026-10-17T22:00:00Z");
 assert.equal(y.resultMarkets[0].reviewStatus,"pass-insufficient-history");
 assert.equal(y.preKickoff,false);
});
test("Every fixture receives 1X2 and DC reviews without changing official picks",()=>{
 const out=evaluateSlate({date:"2026-10-17",generatedAt:"2026-10-17T04:00:00Z",fixtures:[g()]},"2026-10-17T05:00:00Z");
 assert.equal(out.summary.games,1);
 assert.equal(out.summary.marketChecks,5);
 assert.equal(out.games[0].resultMarkets.length,5);
 assert.equal(out.officialBoardUnchanged,true);
 assert.equal(out.noProviderApiRequests,true);
 assert.equal(out.confidenceCalibrated,false);
});
test("duplicate fixture identities fail closed",()=>{
 assert.throws(()=>evaluateSlate({date:"2026-10-17",fixtures:[g(),g()]},"2026-10-17T05:00:00Z"),/duplicate/);
});
