import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const js=fs.readFileSync("ui/part2.html","utf8");
const css=fs.readFileSync("assets/footyedge-match-v3.css","utf8");
const slips=fs.readFileSync("top-picks.html","utf8");
const engine=fs.readFileSync("scripts/build-daily-slips.mjs","utf8");
test("H2H and last five use the identical rotating SVG disclosure",()=>{
 assert.match(js,/function feArrow\(open\)/);
 assert.match(js,/feArrow\(expanded\)/);
 assert.match(js,/feArrow\(exp\)/);
 assert.match(css,/\.fe-arrowIcon\.open\{transform:rotate\(180deg\)\}/);
 assert.match(css,/\.fe-down\{[^}]*border:0!important/);
});
test("Last five results have fixed and aligned score columns",()=>{
 assert.match(js,/class="fe-recentScore/);
 assert.match(css,/\.fe-recentTeams\{[^}]*grid-template-columns:/);
 assert.match(css,/\.fe-recentScore\{/);
});
test("Team news lists each reported player separately",()=>{
 assert.match(js,/class="fe-newsPlayers"/);
 assert.match(js,/arr\.map\(person=>'<li>'/);
 assert.match(css,/\.fe-newsPlayers li\{/);
});
test("Lineups use a pitch and sourced portraits, never a random athlete photo",()=>{
 assert.match(js,/function feTeamPitchRows/);
 assert.match(js,/class="fe-sharedPitch"/);
 assert.match(js,/class="fe-sharedHalf fe-half-/);
 assert.match(js,/p\?\.photoUrl/);
 assert.match(js,/PREDICTED · NOT CONFIRMED/);
 assert.match(js,/data-refresh-match/);
 assert.match(css,/\.fe-fieldAvatar\{/);
});
test("Fixture card has no old details footer row and uses team-color gradients",()=>{
 const render=js.slice(js.indexOf("function renderGames(){"),js.indexOf("const FILTER_LEAGUE_LOGOS=",js.indexOf("function renderGames(){")));
 assert.doesNotMatch(render,/fe-cardBottom/);
 assert.match(css,/--fe-home/);
 assert.match(css,/--fe-away/);
});
test("Receipt refresh conserves deployment limits and uses major-league-only source",()=>{
 assert.match(slips,/id="refreshBtn"/);
 assert.match(slips,/items\.length\+" LEGS"/);
 assert.match(slips,/\/api\/refresh-slips\?date=/);
 assert.match(slips,/Recently checked/);
 assert.match(engine,/MAJOR_SLIP_LEAGUES/);
 assert.match(engine,/eligibleSlipLegs/);
 assert.match(engine,/majorLeagueRule:true/);
});



test("Fixture and expanded match headers anchor to 5px edges with an immovable centre",()=>{
 const block=css.slice(css.indexOf("/* Single edge-anchored match-header geometry"));
 assert.ok(block.startsWith("/* Single edge-anchored"),"Edge-based layout must be last in cascade");
 assert.match(block,/:is\(\.fe-matchCard,\.fe-dialogHero\) \.fe-hero\.fe-kitHero\{/);
 assert.match(block,/padding-left:5px!important/);
 assert.match(block,/padding-right:5px!important/);
 assert.match(block,/grid-template-columns:minmax\(0,1fr\) minmax\(116px,\.9fr\) minmax\(0,1fr\)!important/);
 assert.match(block,/fe-side\.fe-home[\s\S]*?justify-items:start!important/);
 assert.match(block,/fe-side\.fe-away[\s\S]*?justify-items:end!important/);
 assert.match(block,/fe-side\.fe-home \.fe-sideName[\s\S]*?text-align:left!important/);
 assert.match(block,/fe-side\.fe-away \.fe-sideName[\s\S]*?text-align:right!important/);
 assert.match(block,/fe-center\{[\s\S]*?grid-column:2!important/);
 assert.match(block,/\.fe-center>\.fe-kickoff\{[\s\S]*?text-align:center!important/);
 assert.match(block,/@media\(max-width:375px\)/);
 assert.match(block,/grid-template-columns:minmax\(0,1fr\) 100px minmax\(0,1fr\)!important/);
 assert.doesNotMatch(block,/left:-9px|left:-5px|width:min\(100%,264px\)/);
 assert.match(fs.readFileSync("ui/part1.html","utf8"),/footyedge-match-v3\.css\?v=32/);
 assert.match(fs.readFileSync("picks.html","utf8"),/ui\/part1\.html\?v=140/);
});
