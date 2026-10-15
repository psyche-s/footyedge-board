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
