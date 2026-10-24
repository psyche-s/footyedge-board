import test from "node:test";
import assert from "node:assert/strict";
import {generateReviewedSlipDesk} from "../scripts/build-odds-reviewed-slips.mjs";
const day="2026-10-25",asof=day+"T01:00:00Z",time=day+"T18:00:00Z";
const leagues=["eng.1","esp.1","ita.1","ger.1","fra.1","ned.1","jpn.1"];
const fixtures=leagues.map((league,i)=>{const home="Home"+i,away="Away"+i;
 return {id:String(i+1),date:time,league,home:{name:home,id:home},away:{name:away,id:away},
  last10:{home:Array.from({length:10},(_,k)=>({gf:2,ga:1})),
   away:Array.from({length:10},(_,k)=>({gf:1,ga:2}))}}});
const research={date:day,fixtures};
const reviews={date:day,matches:fixtures.map(x=>({gameId:x.id,kickoff:x.date,league:x.league,
 home:x.home.name,away:x.away.name,reviewed:true,
 picks:[{label:x.home.name+" or Draw",family:"result",category:"Double Chance",confidenceRating:82,reason:"10 verified games and opponent results support the protected outcome."},
 {label:"Over 2.5 Goals",family:"total",category:"Goals",confidenceRating:82,reason:"Recent independent fixture totals favor at least three goals."},
 {label:x.home.name+" 1+ Goal",family:"team-goal",category:"Team Goals",confidenceRating:77,reason:"Recent goals scored and goals allowed favor at least one home goal."}] }))};
const sims={date:day,fixtures:fixtures.map(x=>({fixtureId:x.id,home:x.home.name,away:x.away.name,
 status:"pre_kickoff_experimental",winDrawLossPct:{homeWin:69,draw:21,awayWin:10},
 marketsPct:{over1_5:95,over2_5:86,under3_5:30,bttsYes:67}}))};
const markets={date:day,source:"ESPN-reported book quotes",observations:day+"T00:40:00Z",
 events:fixtures.map(x=>({id:x.id,date:x.date,home:x.home.name,away:x.away.name,
 prices:[{label:"Over 2.5 Goals",odds:-130,book:"Reference book",bookKey:"draftkings"}]}))};
test("major-league SGPs and cross-game slip are built only with documented risks",()=>{
 const d=generateReviewedSlipDesk({date:day,review:reviews,research,simulation:sims,markets,asof});
 assert.equal(d.sgp.status,"pass"); // Result + team 1+ + total is repeated goal exposure.
 assert.equal(d.sgp.legs.length,0);
 assert.equal(d.sgpsByLeague.length,0);
 assert.equal(d.acca.status,"hold"); // No bet365 Ontario executable quote.
 assert.ok(d.acca.legs.length>=4&&d.acca.legs.length<=7);
 assert.equal(new Set(d.acca.legs.map(l=>l.gameId)).size,d.acca.legs.length);
 assert.ok(d.acca.legs.every(x=>x.odds===null&&x.verifiedPrice===false));
 assert.ok(d.acca.legs.every(x=>x.observedReferenceOdds===-130));
 assert.ok(d.acca.legs.every(x=>x.league!=="jpn.1"));
 assert.equal(d.sportsbookAvailability.includes("Not verified"),true);
});
test("missing prices do not become fake quoted odds",()=>{
 const m={...markets,events:[]};
 const x=generateReviewedSlipDesk({date:day,review:reviews,research,simulation:sims,markets:m,asof});
 assert.equal(x.audits.priceScreenCandidates,0);
 assert.equal(x.audits.pricedCrossLegs,0);
 assert.ok(x.acca.legs.every(l=>l.odds===null&&l.verifiedPrice===false));
});
test("future-dated or started fixtures cannot enter published advice",()=>{
 const x=generateReviewedSlipDesk({date:day,review:reviews,research,simulation:sims,
 markets,asof:day+"T23:00:00Z"});
 assert.equal(x.sgp.status,"pass");
 assert.equal(x.acca.status,"pass");
});


test("independent result + goals + verified non-goal event qualifies only with real event evidence",()=>{
 const f=fixtures[0];
 const updated=structuredClone(reviews);
 updated.matches[0].picks=[
  {label:f.home.name+" or Draw",family:"result",category:"Double Chance",confidenceRating:83,reason:"Home side has avoided defeat in eight of its last ten games."},
  {label:"Over 2.5 Goals",family:"total",category:"Goals",confidenceRating:79,reason:"Both recent attacking records support three match goals."},
  {label:"Over 8.5 Corners",family:"corners",category:"Corners",confidenceRating:75,reason:"Corner volume and opposing corner allowance both exceed the selected threshold.",marketEvidence:{verified:true,teamSample:10,opponentAllowanceSample:10}}
 ];
 const d=generateReviewedSlipDesk({date:day,review:updated,research,simulation:sims,markets,asof});
 assert.equal(d.sgp.status,"qualified");
 assert.equal(d.sgp.legs.length,3);
 assert.equal(d.sgp.legs.some(x=>x.label==="Over 8.5 Corners"),true);
});
test("event props must have independent verified samples, not market labels",()=>{
 const u=structuredClone(reviews);
 for(const m of u.matches)m.picks[2]={...m.picks[2],label:"Over 8.5 Corners",family:"corners",marketEvidence:{verified:false,teamSample:10,opponentAllowanceSample:10}};
 const d=generateReviewedSlipDesk({date:day,review:u,research,simulation:sims,markets,asof});
 assert.equal(d.sgp.status,"pass");
});
