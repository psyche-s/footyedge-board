import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {buildEditorialDesk,applyEditorialToDraft} from "../scripts/build-editorial-desk.mjs";

const DATE="2026-11-05";
function fixture(i){
 const id=String(880000+i),home="Home Club "+i,away="Away Club "+i;
 const before="2026-10-20T17:00:00Z";
 const H=Array.from({length:10},(_,k)=>({date:"2026-10-"+String(10+k).padStart(2,"0"),
   gf:2,ga:1,result:"W",venue:k%2?"away":"home"}));
 const A=Array.from({length:10},(_,k)=>({date:"2026-10-"+String(10+k).padStart(2,"0"),
   gf:1,ga:2,result:"L",venue:k%2?"home":"away"}));
 return {
  game:{id,home,away,league:"uefa.champions",date:DATE+"T18:00:00Z",top3:[{label:"Old model pick",score:99}],
   top:{label:"Old model pick",score:99},model:{top3:[]}},
  research:{id,home:{name:home},away:{name:away},date:DATE+"T18:00:00Z",last10:{home:H,away:A}}
 };
}
function evidence(id,key,source){
 const domains={football_whispers:"footballwhispers.com",sports_mole:"sportsmole.co.uk",
  sportskeeda:"sportskeeda.com"};
 return {fixture_date:DATE,match_id:id,market_key:key,source,source_url:"https://"+domains[source]+"/match/"+id,
  captured_at:DATE+"T00:11:00Z",permission:"authorized",
  permission_reference:"licensed-fixture-research-permission",stance:"support"};
}
function inputs(){
 const f=[1,2,3,4].map(fixture);
 return {board:{date:DATE,immutable:false,games:f.map(x=>x.game),top5:[],leagueTop5:{}},
  research:{date:DATE,fixtures:f.map(x=>x.research)},
  evidence:f.flatMap(x=>[
   evidence(x.game.id,"home_win","football_whispers"),
   evidence(x.game.id,"over_2_5","sports_mole"),
   evidence(x.game.id,"btts_yes","sportskeeda")
  ])};
}
test("No licensed editorial source = NO invented model picks, parlays or percentage",()=>{
 const {board,research}=inputs(),original=JSON.stringify(board);
 const desk=buildEditorialDesk({date:DATE,board,research,evidence:[]});
 assert.equal(desk.state,"pass");
 assert.equal(desk.matches.length,0);
 assert.equal(desk.sgp.status,"pass");
 assert.equal(desk.acca.status,"pass");
 assert.deepEqual(desk.sgp.legs,[]);
 const draft=applyEditorialToDraft(board,desk);
 assert.ok(draft.games.every(g=>g.top3.length===0&&g.top===null));
 assert.deepEqual(draft.top5,[]);
 assert.equal(JSON.stringify(board),original);
});
test("Dated, authorised evidence produces independent top-three picks, 3-leg SGP and 4+ cross-game legs",()=>{
 const {board,research,evidence}=inputs();
 const desk=buildEditorialDesk({date:DATE,board,research,evidence});
 assert.equal(desk.matches.length,4);
 assert.ok(desk.matches.every(m=>m.picks.length===3));
 assert.equal(desk.sgp.status,"qualified");
 assert.ok(desk.sgp.legs.length>=3&&desk.sgp.legs.length<=5);
 assert.equal(new Set(desk.sgp.legs.map(x=>x.gameId)).size,1);
 assert.equal(desk.acca.status,"qualified");
 assert.ok(desk.acca.legs.length>=4&&desk.acca.legs.length<=5);
 assert.equal(new Set(desk.acca.legs.map(x=>x.gameId)).size,desk.acca.legs.length);
 assert.equal(desk.noSportsbookOdds,true);
 for(const m of desk.matches)for(const p of m.picks){
  assert.ok(p.reason.length>80);
  assert.ok(p.confidenceRating<=96);
  assert.equal(p.probabilityCalibrated,false);
  assert.equal(p.odds,null);
  assert.doesNotMatch(p.reason,/sportsmole|footballwhispers|sportskeeda|https?:\/\/|forebet/i);
 }
 const output=applyEditorialToDraft(board,desk);
 assert.ok(output.games.every(g=>g.top3.length===3));
 assert.ok(output.games.every(g=>g.top?.label===g.top3[0]?.label));
});
test("Wrong fixture, stale or unapproved evidence cannot create public picks",()=>{
 const {board,research,evidence}=inputs();
 for(const row of evidence){row.permission="unknown";}
 evidence.push({ ...evidence[0],permission:"authorized",fixture_date:"2026-11-04"});
 const desk=buildEditorialDesk({date:DATE,board,research,evidence});
 assert.equal(desk.state,"pass");
 assert.equal(desk.matches.length,0);
});
test("The official scheduled refresh locks source-only picks and avoids model-built slip overwrite",()=>{
 const freeze=fs.readFileSync(".github/workflows/archive-board.yml","utf8");
 const slip=fs.readFileSync(".github/workflows/daily-slip-desk.yml","utf8");
 assert.match(freeze,/00:30 Toronto/);
 assert.match(freeze,/node scripts\/build-editorial-desk\.mjs/);
 assert.ok(freeze.indexOf("node scripts/build-editorial-desk.mjs")<freeze.indexOf("node scripts/archive-board.mjs"));
 assert.doesNotMatch(freeze,/SLIP_DATE="\$TODAY" node scripts\/build-daily-slips\.mjs/);
 assert.match(slip,/00:45 Toronto/);
 assert.match(slip,/git add -A data\/editorial-desk\//);
 assert.doesNotMatch(slip,/REBUILD_DAILY_SLIPS/);
 const css=fs.readFileSync("assets/footyedge-match-v3.css","utf8");
 assert.match(css,/Final fixture mockup lock/);
});

test("The fixture UI and parlay page can never fall back to model slips for upcoming games",()=>{
 const fixtures=fs.readFileSync("ui/part2.html","utf8");
 const page=fs.readFileSync("top-picks.html","utf8");
 const researchJob=fs.readFileSync(".github/workflows/build-research-base.yml","utf8");
 const freeze=fs.readFileSync(".github/workflows/archive-board.yml","utf8");
 const deskJob=fs.readFileSync(".github/workflows/daily-slip-desk.yml","utf8");
 assert.match(fixtures,/if\(!reviewed&&S\.date>=etDate\(\)&&!ARCHIVE_CAPTURE\)return \[\];/);
 assert.match(page,/date<localDate\(\)\?await data\("data\/slips\//);
 assert.match(page,/if\(date>=localDate\(\)\)/);
 assert.doesNotMatch(researchJob,/SLIP_DATE="\$TODAY" node scripts\/build-daily-slips\.mjs/);
 assert.match(freeze,/MINUTES_SINCE_MIDNIGHT < 720/);
 assert.match(deskJob,/github\.event_name \}\}" == "push"/);
});
