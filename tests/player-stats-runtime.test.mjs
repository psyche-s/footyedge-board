import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import vm from "node:vm";
import test from "node:test";
import profileHandler from "../api/player-profile.js";

test("all three deployed player routes can load their photo dependency from CommonJS",()=>{
 // Reproduce Vercel's require() boundary, which native ESM-only unit tests miss.
 for(const route of ["player-profile","lineup-headshots","match-updates"]){
  const file=new URL("../api/"+route+".js",import.meta.url);
  const dependency=fs.readFileSync(file,"utf8").match(/^import[^\n]+from "([^"]*player-photos\.[^"]+)"/m)?.[1];
  assert.ok(dependency,"player route photo dependency exists");
  const run=spawnSync(process.execPath,["--no-experimental-require-module","-e",
   'const p=require(process.argv[1]);if(typeof p.validPlayerImageURL!=="function"||!p.photoForIdentity({id:"157892",displayName:"Virgil van Dijk"}))process.exit(1)',
   fileURLToPath(new URL(dependency,file))],{encoding:"utf8"});
  assert.equal(run.status,0,route+" failed to initialize: "+run.stderr);
 }
});

test("profile response populates season stats, ten appearances and lineup goals/shots cells",async t=>{
 const athlete={id:"99812",displayName:"Regression Striker",
  headshot:{href:"https://a.espncdn.com/i/headshots/soccer/players/full/99812.png"}};
 const names=["totalGoals","goalAssists","totalShots","shotsOnTarget","foulsCommitted",
  "foulsSuffered","yellowCards","redCards"];
 const events={},rows=Array.from({length:10},(_,i)=>{
  const eventId=String(401000000+i);
  events[eventId]={gameDate:"2026-10-"+String(i+1).padStart(2,"0")+"T12:00:00Z",
   team:{id:"42"},opponent:{displayName:"Opponent "+i},leagueName:"Premier League"};
  return {eventId,stats:[String(i%2),"0",String(i%4),"1","2","3","0","0"]};
 });
 const competition="2026-27 English Premier League";
 const overview={statistics:{names,splits:[{teamId:"42",leagueSlug:"eng.1",
  displayName:competition,stats:["5","0","13","10","20","30","0","0"]}]}};
 const gameLog={names,events,seasonTypes:[{displayName:competition,categories:[{events:rows}]}]};
 const priorFetch=globalThis.fetch;
 globalThis.fetch=async url=>{
  const path=String(url);
  const data=path.endsWith("/roster")?{team:{id:"42",displayName:"Verified Club"},athletes:[athlete]}:
   path.endsWith("/overview")?overview:path.endsWith("/gamelog")?gameLog:{};
  return {ok:true,status:200,json:async()=>data};
 };
 t.after(()=>{globalThis.fetch=priorFetch});
 const response={setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}};
 await profileHandler({method:"GET",query:{league:"eng.1",teamId:"42",name:athlete.displayName}},response);
 const data=response.body;
 assert.equal(response.code,200);
 assert.equal(data.status,"verified");
 assert.equal(data.stats.find(s=>s.label==="Goals")?.value,5);
 assert.equal(data.stats.find(s=>s.label==="Assists")?.value,0);
 assert.equal(data.stats.find(s=>s.label==="Shots")?.value,13);
 assert.equal(data.recent.length,10);
 assert.equal(data.recent[0].goals,1);
 assert.equal(data.recent[0].shots,1);
 assert.equal(data.recent[0].foulsWon,3);
 assert.equal(data.recent[0].minutes,null);

 const ui=fs.readFileSync(new URL("../ui/part2.html",import.meta.url),"utf8");
 const context=vm.createContext({esc:x=>String(x)});
 vm.runInContext(ui.slice(ui.indexOf("function fePlayerImageUrl("),ui.indexOf("\nasync function feOpenPlayerProfile(")),context);
 vm.runInContext(ui.slice(ui.indexOf("function fePitchFive("),ui.indexOf("function fePitchMetric(")),context);
 const html=context.fePlayerProfileMarkup(data,{name:athlete.displayName,teamName:"Verified Club"});
 assert.equal((html.match(/data-fe-recent-comp=/g)||[]).length,10);
 assert.match(html,/>Goals<\/span><strong>5<\/strong>/);
 assert.match(html,/>Shots<\/span><strong>13<\/strong>/);
 for(const metric of ["goals","shots","shotsOnTarget","foulsCommitted","foulsWon"]){
  const cells=context.fePitchCells(data,metric,"2026-11-01T15:00:00Z");
  assert.equal((cells.match(/<i /g)||[]).length,5);
  assert.doesNotMatch(cells,/fe-pitchStatEmpty/);
 }
 assert.match(context.fePitchCells(data,"goals","2026-11-01T15:00:00Z"),/>0<\/i>/);
 assert.match(context.fePitchCells(data,"minutes","2026-11-01T15:00:00Z"),/>—<\/i>/);
});
