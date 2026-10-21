import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {selectAsiaFallback} from "../scripts/asia-statistical-fallback.mjs";
import {buildEditorialDesk,applyEditorialToDraft} from "../scripts/build-editorial-desk.mjs";

const DATE="2026-11-11",kickoff=DATE+"T10:00:00Z";
const win=(i)=>({
 date:new Date(Date.UTC(2026,9,11+i)).toISOString(),venue:i%2?"away":"home",
 gf:2,ga:1,result:"W"
});
const lose=(i)=>({
 date:new Date(Date.UTC(2026,9,11+i)).toISOString(),venue:i%2?"home":"away",
 gf:1,ga:2,result:"L"
});
function fixture(id,league="jpn.1"){
 return {id:String(id),league,date:kickoff,home:{name:"Home Tigers "+id},
  away:{name:"Away Eagles "+id},last10:{home:Array.from({length:10},(_,i)=>win(i)),
  away:Array.from({length:10},(_,i)=>lose(i))}};
}
function board(f){
 return {date:DATE,immutable:false,games:[{
   id:f.id,league:f.league,date:f.date,home:f.home.name,away:f.away.name,
   top:{label:"Old ML",score:99},top3:[{label:"Old ML",score:99}],model:{top3:[]}
 }],top5:[],leagueTop5:{}};
}
test("J1 and K1 fallback produces exactly three distinct evidence-based markets",()=>{
 for(const league of ["jpn.1","kor.1"]){
  const f=fixture(123,league),picks=selectAsiaFallback(f);
  assert.equal(picks.length,3,league);
  assert.equal(new Set(picks.map(p=>p.category)).size,3);
  assert.equal(picks.filter(p=>p.category==="Goals").length,1);
  assert.equal(picks.filter(p=>p.category==="Match Result"||p.category==="Double Chance").length,1);
  assert.equal(picks.filter(p=>p.category==="BTTS"||p.category==="Team Goals").length,1);
  for(const p of picks){
   assert.ok(p.reason.length>95);
   assert.match(p.reason,/last 10 games|last 10|last five/i);
   assert.equal(p.odds,null);
   assert.equal(p.probabilityCalibrated,false);
   assert.equal(p.independentPreviewConsensus,false);
   assert.doesNotMatch(p.reason,/https?:|football whispers|sportskeeda|sports mole|forebet/i);
  }
 }
});
test("Only J1 and K1 use fallback, never weak/non-verified history",()=>{
 assert.equal(selectAsiaFallback(fixture(100,"eng.1")).length,0);
 const x=fixture(200);x.last10.away=x.last10.away.slice(0,4);
 assert.deepEqual(selectAsiaFallback(x),[]);
 const y=fixture(300);y.last10.home=y.last10.home.map((r,i)=>({...r,
   date:new Date(Date.UTC(2026,10,13+i)).toISOString()}));
 assert.deepEqual(selectAsiaFallback(y),[]);
});
test("Daily editorial desk automatically fills qualifying Asian fixtures without publisher evidence",()=>{
 const f=fixture(321);
 const d=buildEditorialDesk({date:DATE,board:board(f),research:{date:DATE,fixtures:[f]},evidence:[]});
 assert.equal(d.matches.length,1);
 assert.equal(d.matches[0].reviewMethod,"verified-stats-no-editorial-preview");
 assert.equal(d.matches[0].picks.length,3);
 assert.equal(d.licensedEvidenceItems,0);
 assert.equal(d.sgp.status,"pass");
 const draft=applyEditorialToDraft(board(f),d);
 assert.equal(draft.games[0].top3.length,3);
 assert.equal(draft.games[0].recoveryStatus,"independent-asian-statistical-research");
 assert.equal(draft.games[0].top.label,draft.games[0].top3[0].label);
});
test("Fixture card puts red LIVE dot on same line and keeps LIVE > UPCOMING > FINAL ordering",()=>{
 const ui=fs.readFileSync("ui/part2.html","utf8");
 const css=fs.readFileSync("assets/footyedge-match-v3.css","utf8");
 assert.match(ui,/class="fe-liveLabel"><i class="fe-liveDot"/);
 assert.match(ui,/const fixtureStateRank=g=>feActualLive\(g\)\?0:/);
 assert.match(ui,/g\.done===true\|\|feActualFinal\(g\)/);
 assert.match(css,/display:inline-flex!important;flex-direction:row!important/);
 assert.match(css,/@keyframes fe-live-pulse/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/Oct 21 final mockup fidelity/);
});
