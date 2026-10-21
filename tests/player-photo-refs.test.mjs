import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {rosterPlayers,targetTeams} from "../scripts/sync-player-photo-refs.mjs";

test("Player roster extraction preserves provider identity and explicit links only",()=>{
 const p=rosterPlayers({athletes:[
  {id:"222",displayName:"First Player",gender:"MALE"},
  {id:"333",displayName:"Second Player",gender:"MALE",headshot:{href:"https://a.espncdn.com/i/headshots/soccer/players/full/333.png"}},
  {id:"333",displayName:"Duplicate"},
  {id:"444",displayName:"A Player",gender:"FEMALE"}
 ]});
 assert.equal(p.length,2);
 assert.deepEqual(p[0],{id:"222",name:"First Player",explicit:null});
 assert.equal(p[1].explicit,"https://a.espncdn.com/i/headshots/soccer/players/full/333.png");
});
test("Image lookup requires matching team and unique player name",()=>{
 const ui=fs.readFileSync("ui/part2.html","utf8");
 const fn=ui.slice(ui.indexOf("function feCachedPlayerPhoto("),ui.indexOf("function fePlayerSafePhoto("));
 assert.ok(fn.includes("const records=keys.flatMap"));
 const ctx={window:{FE_PLAYER_PHOTOS:{
  "esp.1:83":[["333","Second Player","https://a.espncdn.com/i/headshots/soccer/players/full/333.png"],
  ["555","John Smith","https://a.espncdn.com/i/headshots/soccer/players/full/555.png"]],
  "eng.1:83":[["333","Second Player","https://a.espncdn.com/i/headshots/soccer/players/full/333.png"]],
  "esp.1:75":[["222","First Player","https://a.espncdn.com/i/headshots/soccer/players/full/222.png"]]
 }}};
 const lookup=vm.runInNewContext(fn+";feCachedPlayerPhoto",ctx);
 assert.equal(lookup({league:"esp.1"},{id:"83"},{id:"333",name:"Second Player"}),
  "https://a.espncdn.com/i/headshots/soccer/players/full/333.png");
 assert.equal(lookup({league:"esp.1"},{id:"83"},"Smith"),
  "https://a.espncdn.com/i/headshots/soccer/players/full/555.png");
 assert.equal(lookup({league:"esp.1"},{id:"83"},"First Player"),"");
 assert.equal(lookup({league:"esp.1"},{id:"83"},{id:"999",name:"Second Player"}),"");
 assert.equal(lookup({league:"esp.1"},{id:"75"},{id:"222",name:"First Player"}),
  "https://a.espncdn.com/i/headshots/soccer/players/full/222.png");
});
test("Original Picks loads player image refs, without changing V2 or frozen boards",()=>{
 const html=fs.readFileSync("picks.html","utf8");
 const ui=fs.readFileSync("ui/part2.html","utf8");
 const api=fs.readFileSync("api/match-updates.js","utf8");
 const registry=fs.readFileSync("assets/player-photo-registry.js","utf8");
 assert.match(html,/assets\/player-photo-registry\.js/);
 assert.match(ui,/function feCachedPlayerPhoto/);
 assert.match(ui,/feCachedPlayerPhoto\(g,t,p\)/);
 assert.match(ui,/feCachedPlayerPhoto\(g,team,player\)/);
 assert.match(registry,/window\.FE_PLAYER_PHOTOS=/);
 assert.doesNotMatch(api,/i\/headshots\/soccer\/players\/full\/["']?\+/);
 assert.ok(typeof targetTeams==="function");
});
