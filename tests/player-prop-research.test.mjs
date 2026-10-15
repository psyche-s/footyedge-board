import test from "node:test";
import assert from "node:assert/strict";
import {evaluatePlayerProps} from "../scripts/player-prop-research.mjs";
const fixture={id:"f1",date:"2026-10-16T18:00:00Z",home:{id:"h"},away:{id:"a"}};
const player={id:"p1",name:"Example Striker",teamId:"h",sourceUrl:"https://example.org/match-data",lineup:{verified:true,fixtureId:"f1",status:"starting"},matches:Array.from({length:6},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,"0")}`,completed:true,minutes:85,goals:i%2,assists:i%3===0?1:0,sourceUrl:"https://example.org/match-data"}))};
test("No player data produces no synthetic goalscorer picks",()=>assert.deepEqual(evaluatePlayerProps({fixture}),[]));
test("ATGS and Score or Assist remain research-only without calibrated probabilities",()=>{
 const x=evaluatePlayerProps({fixture,players:[player]});
 assert.deepEqual(x.map(p=>p.market),["ATGS","Score or Assist"]);
 assert.ok(x.every(p=>p.status==="PASS"&&p.confidence===null&&p.ev===null&&p.quote===null));
 assert.equal(x[0].stats.atgsHits,3);
});
test("Do not accept other-player, wrong-market, stale or synthetic quotes",()=>{
 const x=evaluatePlayerProps({fixture,players:[player],quotes:[{fixtureId:"f1",playerId:"different",market:"ATGS",verifiedNative:true,provider:"DraftKings",sourceUrl:"https://example.org/quote",asOf:"2026-10-16T10:00:00Z",decimalOdds:2.2}]});
 assert.ok(x.every(p=>p.quote===null));
});
test("Bench players cannot be published as starting-confirmed",()=>{
 const x=evaluatePlayerProps({fixture,players:[{...player,lineup:{verified:false}}]});
 assert.ok(x.every(p=>p.eligible===false&&p.status==="PASS"));
});
