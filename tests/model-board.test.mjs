import test from "node:test";
import assert from "node:assert/strict";
import { buildOverlay } from "../scripts/build-model-board.mjs";
const date="2026-10-09";
const payload=()=>({
candidate:{date,mode:"shadow_only",promotedToPicks:false,modelVersion:"dc-shadow-v0.3",
  asOf:"2026-10-09T13:00:00Z",researchInputSha256:"abc",fixtures:[{
  fixtureId:"abc-1",league:"ger.1",home:"Dortmund",away:"Bremen",
  kickoff:"2026-10-09T18:30:00Z",status:"shadow_prediction",
  probabilities:{home_win:.7783,draw:.15,away_win:.0717,under_3_5:.64,over_1_5:.81}
}]},
odds:{date,verifiedNativeOnly:true,nativeFormat:"american",fetchedAt:"2026-10-09T10:04:00Z",events:[{
 league:"ger.1",home:"Dortmund",away:"Bremen",homeML:-290,drawML:425,awayML:600,
 mlBook:{key:"draftkings",name:"DraftKings"}
}]}});
test("independent model board preserves only exact sportsbook quotes",()=>{
 const x=payload(),orig=JSON.stringify(x);
 const r=buildOverlay({...x,date});
 assert.equal(r.leagueFixtures,1);assert.equal(r.verifiedMoneylineQuotes,3);
 assert.equal(r.matchups[0].markets[0].odds,-290);
 assert.ok(r.matchups[0].markets[0].rawModelEV>0);
 assert.equal(r.matchups[0].unpricedProbabilities.under_3_5,.64);
 assert.equal(JSON.stringify(x),orig);
});
test("missing exact ML is unavailable; does not backfill model fair odds",()=>{
 const x=payload();delete x.odds.events[0].homeML;
 const r=buildOverlay({...x,date});
 assert.equal(r.matchups[0].markets[0].odds,null);
 assert.equal(r.matchups[0].markets[0].rawModelEV,null);
});
test("rejects wrong date or unsupported odds provenance",()=>{
 const x=payload();x.odds.verifiedNativeOnly=false;
 assert.throws(()=>buildOverlay({...x,date}),/exact-native/);
});
test("rejects any already-started forecast in dated research overlay",()=>{
 const x=payload();x.candidate.fixtures[0].kickoff="2026-10-09T12:00:00Z";
 const r=buildOverlay({...x,date});assert.equal(r.leagueFixtures,0);
});
