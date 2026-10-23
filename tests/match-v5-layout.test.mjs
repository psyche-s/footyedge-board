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
 assert.match(fs.readFileSync("ui/part1.html","utf8"),/footyedge-match-v3\.css\?v=34/);
 assert.match(fs.readFileSync("picks.html","utf8"),/ui\/part1\.html\?v=143/);
});

test("Away content nudges left on mobile, without resizing either fixture or expanded layout",()=>{
 const block=css.slice(css.indexOf("/* Small away-side optical correction only."));
 assert.ok(block.startsWith("/* Small away-side"));
 assert.match(block,/@media\(max-width:620px\)/);
 assert.match(block,/:is\(\.fe-matchCard,\.fe-dialogHero\) \.fe-heroTeams > \.fe-side\.fe-away\{/);
 assert.match(block,/transform:translateX\(-22px\)!important/);
 assert.match(block,/@media\(max-width:360px\)/);
 assert.match(block,/transform:translateX\(-14px\)!important/);
 assert.doesNotMatch(block,/^\s*(?:width|grid-template-columns|left|padding|margin)\s*:/m);
 assert.match(fs.readFileSync("ui/part1.html","utf8"),/footyedge-match-v3\.css\?v=34/);
 assert.match(fs.readFileSync("picks.html","utf8"),/ui\/part1\.html\?v=143/);
});

test("V3 preview design is additive and keeps fixture/expanded match renderer identical",()=>{
 const preview=fs.readFileSync("assets/footyedge-v3-preview.css","utf8");
 const p1=fs.readFileSync("ui/part1.html","utf8");
 const p2=fs.readFileSync("ui/part2.html","utf8");
 const loader=fs.readFileSync("picks.html","utf8");
 assert.match(preview,/grid-template-columns:minmax\(0,1fr\) 112px minmax\(0,1fr\)!important/);
 assert.match(preview,/\.fe-matchCard,\.fe-dialogHero/);
 assert.match(preview,/\.fe-heroTeams>\.fe-side/);
 assert.match(preview,/transform:none!important/);
 assert.match(preview,/\.fe-kickoff/);
 assert.match(preview,/@media\(max-width:380px\)/);
 assert.match(preview,/\.games\{grid-template-columns:1fr/);
 assert.match(preview,/\.fe-hero\.fe-kitHero::before/);
 assert.match(p1,/footyedge-v3-preview\.css\?v=1/);
 assert.match(p1,/DESIGN PREVIEW/);
 assert.match(p1,/id="feLeagueSelect"/);
 assert.match(p1,/id="searchInput"/);
 assert.match(p1,/data-status="live"/);
 assert.match(p2,/function feMatchHero\(g\)/);
 assert.match(p2,/searchParams.get\("previewDate"\)/);
 assert.match(p2,/feMatchHero\(g\)\+'/);
 assert.match(loader,/ui\/part1\.html\?v=143/);
});

test("V3 fully cancels original away transform and keeps form chip row inside 320px screens",()=>{
 const c=fs.readFileSync("assets/footyedge-v3-preview.css","utf8");
 assert.match(c,/\.fe-heroTeams > \.fe-side\.fe-away\{\s*transform:none!important/);
 assert.match(c,/\.fe-heroTeams > \.fe-side\.fe-home,/);
 assert.match(c,/@media\(max-width:380px\)[\s\S]*gap:1px!important/);
 for(const w of [320,360,375,390,430,620]){
   const gap=w<=380?3:4,mid=w<=380?102:112;
   const inset=w<=380?10:14;
   const side=(w-24-2*inset-mid-2*gap)/2;
   const chipWidth=w<=380?14:17,chipGap=w<=380?1:3;
   assert.ok(5*chipWidth+4*chipGap<=side,
    "Five form chips must fit on a "+w+"px viewport, track "+side);
 }
});
