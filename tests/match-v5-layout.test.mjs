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

test("Restore the pre-alignment layout for BOTH original fixture and expanded headers",()=>{
 // Never override the previously approved match-card geometry with nudges.
 assert.doesNotMatch(css,/Mobile fixture-card geometry|Responsive match-header containment|Optical balance on phone-size fixture|Single edge-anchored match-header geometry/);
 assert.doesNotMatch(css,/\.fe-heroTeams>\.fe-side\.fe-away\{\s*position:relative/);
 assert.match(css,/\.fe-matchCard \.fe-heroTeams\{display:grid!important;grid-template-columns:/);
 assert.match(css,/\.fe-dialogHero \.fe-heroTeams \.fe-side/);
 assert.ok(js.includes("return '<div class=\"fe-dialogHero\">'+feMatchHero(g)"));
 assert.match(fs.readFileSync("ui/part1.html","utf8"),/footyedge-match-v3\.css\?v=36/);
 assert.match(fs.readFileSync("picks.html","utf8"),/ui\/part1\.html\?v=\d+/);
});

test("Fixture and expanded cards keep a symmetric three-column mobile layout",()=>{
 const block=css.slice(css.indexOf("/* 2026-10-23 MOBILE ALIGNMENT CONTRACT"));
 assert.ok(block.startsWith("/* 2026-10-23 MOBILE ALIGNMENT CONTRACT"));
 assert.match(block,/:is\(\.fe-matchCard,\.fe-dialogHero\) \.fe-hero\.fe-kitHero>\.fe-heroTeams/);
 assert.match(block,/grid-template-columns:minmax\(0,1fr\) minmax\(116px,\.93fr\) minmax\(0,1fr\)!important/);
 assert.match(block,/transform:none!important/);
 assert.match(block,/grid-template-rows:70px 40px 24px 25px!important/);
 assert.match(block,/grid-template-rows:62px 40px 24px 25px!important/);
 assert.match(block,/\.fe-center>\.fe-kickoff/);
 assert.match(block,/\.fe-center>\.fe-scoreLine/);
 assert.match(block,/\.fe-logoWrap img\.fe-crest/);
 assert.doesNotMatch(css,/transform:translateX\(-22px\)!important|transform:translateX\(-14px\)!important/);
 assert.match(css,/broadcast-home\.svg/);
 assert.match(css,/broadcast-away\.svg/);
 assert.ok(fs.readFileSync("ui/part1.html","utf8").includes("footyedge-match-v3.css?v=36"));
 assert.match(fs.readFileSync("picks.html","utf8"),/ui\/part1\.html\?v=\d+/);
});
