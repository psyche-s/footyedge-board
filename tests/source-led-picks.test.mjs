import test from "node:test";
import assert from "node:assert/strict";
import {generate} from "../scripts/build-source-led-picks.mjs";
const date="2026-10-25",f={
 id:"123456",date:"2026-10-25T14:00Z",league:"eng.1",
 home:{name:"Home FC"},away:{name:"Away FC"},
 last10:{home:Array.from({length:10},(_,i)=>({date:"2026-10-18T12:00Z",gf:i%4===0?0:2,ga:i%2})),
 away:Array.from({length:10},(_,i)=>({date:"2026-10-18T12:00Z",gf:1,ga:i%2?3:1}))}
};
const researched={date,fixtures:[f]};
const webURL="https://footballwhispers.com/blog/todays-betting-tips/";
const valid={schema:"footyedge-curated-editorial-market-tips-v1",date,fixtures:[
 {fixtureId:"123456",league:"eng.1",home:"Home FC",away:"Away FC",publicationDate:date,source:"football_whispers",url:webURL,
  marketPicks:["home_win","over_2_5","btts_yes","over_4_5_cards","player_fake_atgs","exact_score_2_2"]
  .map(market=>({market,explicitPreMatchTip:true}))}]};
const odds={date,opinions:[{fixtureId:"123456",source:"sports_mole",market:"match_winner",
 prediction:"home",kind:"explicit_pre_match_prediction",fixtureDate:date,
 url:"https://www.sportsmole.co.uk/football/example.html"}]};
test("Three distinct publisher-backed categories can appear; player and exact-score tips are gated",()=>{
 const v=generate({date,research:researched,curated:valid,opinions:odds});
 assert.equal(v.totals.fixtures,1);
 assert.equal(v.matches[0].picks.length,3);
 assert.equal(v.totals.rejectedUnverifiedMarkets,2);
 assert.ok(v.matches[0].picks.some(x=>x.key==="home_win"));
 assert.ok(v.matches[0].picks.every(x=>x.sourceProvenance.length));
 assert.equal(v.archiveUnmodified,true);
 assert.equal(v.top5.length,1);
 assert.ok(v.matches[0].picks.every(x=>x.odds===null&&x.ev===null&&!x.probabilityCalibrated));
});
test("No unverified publisher recommendation means no source-led picks or synthetic goals",()=>{
 const v=generate({date,research:researched,curated:{date,fixtures:[]},opinions:{date,opinions:[]}});
 assert.equal(v.matches[0].picks.length,0);
 assert.equal(v.totals.zero,1);
 assert.equal(v.top5.length,0);
});
test("Wrong teams or provider domains cannot produce recommendations",()=>{
 const bad=structuredClone(valid);
 bad.fixtures[0].away="Other Team";
 assert.equal(generate({date,research:researched,curated:bad,opinions:{date,opinions:[]}}).matches[0].picks.length,0);
 bad.fixtures[0].away="Away FC";
 bad.fixtures[0].url="https://unrelated.example/foo";
 assert.equal(generate({date,research:researched,curated:bad,opinions:{date,opinions:[]}}).matches[0].picks.length,0);
});
test("Editorial disagreements reduce rating and are explicitly disclosed, not counted as agreement",()=>{
 const a=generate({date,research:researched,curated:valid,opinions:odds});
 const opposing=structuredClone(odds);
 opposing.opinions.push({...opposing.opinions[0],source:"windrawwin",url:"https://www.windrawwin.com/tips/england-premier-league/",prediction:"away"});
 const b=generate({date,research:researched,curated:valid,opinions:opposing});
 const first=v=>v.matches[0].picks.find(x=>x.key==="home_win");
 assert.ok(first(b).editorialOpposition>0);
 assert.ok(first(b).confidenceRating<first(a).confidenceRating);
 assert.match(first(b).reason,/no unanimous result consensus/);
});

test("Tied publisher directions are a result-market PASS, not a forced ML",()=>{
 const two={date,opinions:[
  {fixtureId:"123456",source:"sports_mole",market:"match_winner",prediction:"home",
   kind:"explicit_pre_match_prediction",fixtureDate:date,url:"https://www.sportsmole.co.uk/football/example.html"},
  {fixtureId:"123456",source:"the_analyst",market:"match_winner",prediction:"away",
   kind:"explicit_pre_match_prediction",fixtureDate:date,url:"https://theanalyst.com/articles/example"}
 ]};
 const result=generate({date,research:researched,curated:{date,fixtures:[]},opinions:two});
 assert.equal(result.matches[0].picks.length,0);
 assert.equal(result.matches[0].reviewStatus,"pass_no_independent_market_tip");
 assert.equal(result.top5.length,0);
});
