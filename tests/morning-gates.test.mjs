import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const p1=fs.readFileSync("ui/part1.html","utf8");
const p2=fs.readFileSync("ui/part2.html","utf8");
const builder=fs.readFileSync("scripts/build-research-base.mjs","utf8");
const validator=fs.readFileSync("scripts/validate-daily-board.mjs","utf8");

test("compact search is visible and accessible",()=>{
  assert.match(p1,/id="searchBtn" aria-label="Search games"/);
  assert.doesNotMatch(p1,/id="searchBtn" hidden/)
});
test("club crests contain while country flags retain circular treatment",()=>{
  assert.match(p1,/teamLogo\.clubCrest[\s\S]{0,260}object-fit:contain/);
  assert.match(p1,/countryFlag[\s\S]{0,260}clip-path:circle/)
});
test("league map includes Serie A Bundesliga and Ligue 1",()=>{
  for(const k of ["ita.1","ger.1","fra.1"])assert.ok(p2.includes('"'+k+'":'))
});
test("Why this pick is embedded under Pick 1",()=>{
  assert.match(p2,/i===0\?whyHtml\(x\)/);
  assert.doesNotMatch(p2,/WHY THIS PICK FITS/)
});
test("player props and team news use explicit evidence gates",()=>{
  assert.match(p2,/playerNewsReady\(p\)/);
  assert.match(p2,/verifiedNewsReady\(g,item\)/);
  assert.match(p2,/modelImpact/)
});
test("research history backfills prior season and excludes incomplete matches",()=>{
  assert.match(builder,/Number\(season\)-1/);
  assert.match(builder,/status\?\.type\?\.completed/);
  assert.match(builder,/last10:/);
  assert.match(builder,/last5:/)
});
test("publication validator enforces history price and player-news gates",()=>{
  assert.match(validator,/Incomplete all-competition last-10 history/);
  assert.match(validator,/No verified native sportsbook odds available/);
  assert.match(validator,/Player prop lacks credible expected-start\/minutes evidence/)
});
