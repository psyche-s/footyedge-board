import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const doc=JSON.parse(fs.readFileSync("data/editorial-desk/2026-10-21.json","utf8"));
const ui=fs.readFileSync("ui/part2.html","utf8");
const picks=fs.readFileSync("top-picks.html","utf8");
const style=fs.readFileSync("assets/footyedge-match-v3.css","utf8");
test("Editorial fixture choices are exactly three with human reasoning and no external attribution",()=>{
 assert.equal(doc.schema,"footyedge-editorial-desk-v1");
 assert.equal(doc.originalMatchBoardsUnchanged,true);
 assert.ok(doc.matches.length>=9);
 for(const row of doc.matches){
  assert.equal(row.picks.length,3);
  for(const p of row.picks){
   assert.ok(p.reason.split(/\s+/).length>=15);
   assert.equal(p.researchOnly,true);
   assert.equal(p.probabilityCalibrated,false);
   assert.doesNotMatch(p.reason,/https?:|footballwhispers|sportskeeda|sports mole|forebet/i);
  }
 }
 assert.match(ui,/editorialDeskPayload/);
 assert.match(ui,/game\.feEditorialPicks=/);
 assert.match(ui,/reviewed\|\|g\.model\?\.top3/);
});
test("Real reviewed SGP has three to five legs and cross-match accumulator has one leg per fixture",()=>{
 assert.equal(doc.sgp.status,"qualified");
 assert.ok(doc.sgp.legs.length>=3&&doc.sgp.legs.length<=5);
 assert.equal(new Set(doc.sgp.legs.map(x=>x.gameId)).size,1);
 assert.ok(doc.acca.legs.length>=4&&doc.acca.legs.length<=6);
 assert.equal(new Set(doc.acca.legs.map(x=>x.gameId)).size,doc.acca.legs.length);
 for(const leg of [...doc.sgp.legs,...doc.acca.legs])assert.equal(leg.verifiedPrice,false);
 assert.match(picks,/editorial-desk/);
 assert.match(picks,/items\.length\+" LEGS"/);
 assert.doesNotMatch(picks,/LEGS · ODDS UNVERIFIED/);
 assert.match(picks,/length>=3/);
});
test("Fixture sides keep a uniform dark-centred visual treatment",()=>{
 assert.match(style,/Final fixture mockup lock/);
 assert.match(style,/radial-gradient\(ellipse at 50% 55%/);
 assert.doesNotMatch(ui.slice(ui.indexOf("function renderGames(){"),ui.indexOf("const FILTER_LEAGUE_LOGOS")),/Match analysis/);
});
