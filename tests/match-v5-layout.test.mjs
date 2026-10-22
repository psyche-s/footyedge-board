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


test("Both fixture and expanded score headers contain names within equal team tracks",()=>{
 const block=css.slice(css.indexOf("/* Responsive match-header containment"));
 assert.ok(block.includes(":is(.fe-matchCard,.fe-dialogHero)"),"Both layouts must be fixed together");
 assert.match(block,/grid-template-columns:minmax\(0,1fr\) minmax\(116px,\.9fr\) minmax\(0,1fr\)!important/);
 assert.match(block,/\.fe-heroTeams \.fe-sideName\{/);
 assert.match(block,/width:100%!important/);
 assert.match(block,/overflow-wrap:anywhere!important/);
 assert.match(block,/\.fe-center>\.fe-scoreLine/);
 assert.doesNotMatch(css,/width:min\(100%,264px\)/);
 assert.doesNotMatch(css,/width:max-content!important/);
 assert.match(fs.readFileSync("ui/part1.html","utf8"),/footyedge-match-v3\.css\?v=30/);
 assert.match(fs.readFileSync("picks.html","utf8"),/ui\/part1\.html\?v=138/);
});

test("Away teams shift only nine pixels left on phone-size fixture and expanded headers",()=>{
 const block=css.slice(css.indexOf("/* Optical balance on phone-size fixture"));
 assert.match(block,/@media\(max-width:620px\)/);
 assert.match(block,/:is\(\.fe-matchCard,\.fe-dialogHero\) \.fe-heroTeams>\.fe-side\.fe-away\{/);
 assert.match(block,/left:-9px!important/);
 assert.match(block,/@media\(max-width:360px\)/);
 assert.match(block,/left:-5px!important/);
 assert.doesNotMatch(block,/grid-template-columns|width:|translate|scale/);
 assert.match(fs.readFileSync("ui/part1.html","utf8"),/footyedge-match-v3\.css\?v=31/);
 assert.match(fs.readFileSync("picks.html","utf8"),/ui\/part1\.html\?v=139/);
});
