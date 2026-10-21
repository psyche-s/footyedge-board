import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const code=fs.readFileSync("assets/player-photo-registry.js","utf8");
const prefix="window.FOOTYEDGE_PLAYER_PHOTOS=";
const registry=JSON.parse(code.slice(code.indexOf(prefix)+prefix.length).trim().replace(/;\s*$/,""));
test("Roster photo references come from verified club IDs",()=>{
 assert.ok(Object.keys(registry.teams).length>=4);
 for(const [k,t] of Object.entries(registry.teams)){
  assert.equal(k,t.league+":"+t.teamId);
  assert.match(t.source,/^https:\/\/site\.api\.espn\.com\//);
  assert.ok(t.players.length>0);
  assert.equal(new Set(t.players.map(p=>p.id)).size,t.players.length);
  for(const p of t.players){assert.match(p.id,/^\d{1,12}$/);
   if(p.photoUrl)assert.match(p.photoUrl,/^https:\/\/a\.espncdn\.com\//)}
 }
});
test("Original fixture loads photo registry without duplicate squad cards",()=>{
 const ui=fs.readFileSync("ui/part2.html","utf8");
 const boot=fs.readFileSync("picks.html","utf8");
 assert.match(boot,/assets\/player-photo-registry\.js/);
 assert.match(ui,/fePhotoMatch\(g,t,p\)/);
 const panel=ui.slice(ui.indexOf("function feLineupsPanel(g){"),ui.indexOf("function feMatchSourceStatus(g){"));
 assert.match(panel,/fe-sharedPitch/);
 assert.doesNotMatch(panel,/feVerifiedSquadPanel|Verified team squads/);
});
