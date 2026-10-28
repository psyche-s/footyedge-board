import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const ui=fs.readFileSync("ui/part1.html","utf8");
const runtime=fs.readFileSync("ui/part2.html","utf8");
const css=fs.readFileSync("assets/fixture-controls-v1.css","utf8");
test("excluded second-tier fixture competitions stay hidden, while EFL Championship remains",()=>{
 for(const id of ["ita.2","esp.2","ger.2","fra.2"])
   assert.doesNotMatch(ui,new RegExp('"'+id.replaceAll(".","\\.")+'":'));
 assert.match(ui,/"eng\.2":"EFL Championship"/);
 assert.match(ui,/FE_FIXTURE_LEAGUE_LABELS\[key\]/);
 assert.match(ui,/const MAJOR_LEAGUES=new Set\(Object\.keys\(leagueNames\)\)/);
 assert.match(runtime,/FootyEdgeAvailability\.isExcludedSecondTier\(g\.league,g\.leagueName\)/);
 const availability=fs.readFileSync("assets/board-availability.js","utf8");
 assert.match(availability,/function isExcludedSecondTier\(/);
 assert.match(availability,/if\(code==="eng\.2"\)return false/);
});
test("previously missing competitions have image sources, not only a ball fallback",()=>{
 for(const id of ["ita.2","esp.2","ger.2","fra.2","sco.1"])
  assert.match(runtime,new RegExp('"'+id.replaceAll(".","\\.")+'":"https://'));
 assert.match(runtime,/leagueIconHtml\(g\.league,g\.leagueLogo\)/);
});
test("status, league and search labels are gone and controls are equal sized",()=>{
 for(const t of ["Status","League","Search"])
  assert.doesNotMatch(ui,new RegExp('<div class="filterTitle">'+t+'</div>'));
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/grid-template-rows:auto 48px/);
});
test("clear search removes filtering and X is only shown when input has text",()=>{
 assert.match(ui,/id="searchClear" aria-label="Clear search"/);
 assert.match(runtime,/feSearchClear\.hidden=!feSearchInput\.value\.length/);
 assert.match(runtime,/feSearchInput\.value="";S\.search="";feUpdateSearchClear\(\);renderGames\(\)/);
 assert.match(css,/#filters #searchClear\[hidden\]\{display:none!important\}/);
});
