import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const research=fs.readFileSync("scripts/build-research-base.mjs","utf8");
const fallback=fs.readFileSync("scripts/build-evidence-only-board.mjs","utf8");
const api=fs.readFileSync("api/espn-scoreboard.js","utf8");
const registry=fs.readFileSync("assets/board-availability.js","utf8");
test("Europa and Conference tracked across fixture, research and fallback",()=>{
 for(const code of ["uefa.europa","uefa.europa.conf"]){
  assert.ok(registry.includes(code));
  assert.ok(research.includes(code));
  assert.ok(fallback.includes(code));
  assert.ok(api.includes(code));
 }
});
test("Hub is historical CC0 only and strictly pre-fixture",()=>{
 assert.match(research,/footyedge-history-v1/);
 assert.match(research,/CC0-1.0/);
 assert.match(research,/m.d>=cutoff/);
 assert.match(research,/domestic-league-completed-results-only/);
 assert.match(research,/hubHistory:hub/);
 assert.doesNotMatch(research,/writeFile\([^\n]*data\/boards/);
});
test("Do not change October 15 frozen official selections",()=>{
 const board=JSON.parse(fs.readFileSync("data/boards/2026-10-15.json","utf8"));
 assert.equal(board.immutable,true);
 assert.equal(board.state,"locked");
});

test("dated October 15 snapshot includes both European men's competitions",()=>{
 const snapshot=JSON.parse(fs.readFileSync("data/2026-10-15/fixtures.json","utf8"));
 const ids=snapshot.response.map(x=>Number(x.league?.id));
 assert.equal(ids.filter(x=>x===776).length,18);
 assert.equal(ids.filter(x=>x===20296).length,18);
 for(const p of ["scripts/build-research-base.mjs","api/espn-scoreboard.js","assets/board-availability.js"]){
  const code=fs.readFileSync(p,"utf8");
  assert.match(code,/20296/);assert.match(code,/776/);
 }
});

test("owner-approved v7 adds 36 European fixtures and retains original frozen archive",()=>{
 const correction=JSON.parse(fs.readFileSync("data/corrections/2026-10-15-v7.json","utf8"));
 const original=JSON.parse(fs.readFileSync("data/boards/2026-10-15.json","utf8"));
 assert.equal(correction.ownerApproved,true);
 assert.equal(correction.immutableOriginalPreserved,true);
 assert.equal(original.games.length,3);
 assert.equal(original.top5.length,0);
 assert.equal(correction.games.length,39);
 assert.equal(correction.games.filter(g=>g.league==="uefa.europa").length,18);
 assert.equal(correction.games.filter(g=>g.league==="uefa.europa.conf").length,18);
 assert.equal(correction.games.filter(g=>g.league.startsWith("uefa.")&&g.top3.length===3).length,36);
 assert.equal(correction.games.filter(g=>g.league==="uefa.europa"&&g.top3.length===3).length,18);
 assert.equal(correction.games.filter(g=>g.league==="uefa.europa.conf"&&g.top3.length===3).length,18);
 assert.equal(correction.top5.length,5);
 assert.match(fs.readFileSync("ui/part2.html","utf8"),/approvedCorrection\.games\.map/);
});
