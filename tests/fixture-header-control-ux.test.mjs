import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const ui=fs.readFileSync("ui/part1.html","utf8");
const runtime=fs.readFileSync("ui/part2.html","utf8");
const css=fs.readFileSync("assets/fixture-controls-v1.css","utf8");
test("fixture competitions show meaningful league names, not raw ITA 2",()=>{
 assert.match(ui,/"ita\.2":"Serie B"/);
 assert.match(ui,/"esp\.2":"LaLiga Hypermotion"/);
 assert.match(ui,/"ger\.2":"2\. Bundesliga"/);
 assert.match(ui,/FE_FIXTURE_LEAGUE_LABELS\[key\]/);
 assert.match(ui,/const MAJOR_LEAGUES=new Set\(Object\.keys\(leagueNames\)\)/);
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
