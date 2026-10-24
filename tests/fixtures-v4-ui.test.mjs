import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const logic=fs.readFileSync("ui/part2.html","utf8");
const markup=fs.readFileSync("ui/part1.html","utf8");
const css=fs.readFileSync("assets/footyedge-match-v3.css","utf8");
const homepage=fs.readFileSync("index.html","utf8");
const picks=fs.readFileSync("top-picks.html","utf8");
test("Fixtures retain full research access while suppressing the old top picks and market filters",()=>{
 assert.match(markup,/Today’s Fixtures/);
 assert.match(markup,/id="topAnchor" hidden/);
 assert.match(markup,/fe-hiddenMarket/);
 assert.match(markup,/id="feLeagueSelect"/);
 assert.match(logic,/selection\.onchange=/);
 assert.match(homepage,/href="top-picks\.html"/);
 assert.match(homepage,/href="picks\.html"/);
});
test("Future fixture cards use yellow upcoming and no invalid live dot",()=>{
 assert.match(logic,/function feUpcoming\(g\)/);
 assert.match(logic,/const live=feActualLive\(g\),final=feActualFinal\(g\)/);
 assert.match(logic,/function feActualLive\(g\)/);
 assert.ok(logic.includes('<span class="fe-liveLabel"><i class="fe-liveDot"'));
 assert.match(css,/fe-heroStatus\.is-upcoming/);
});
test("H2H, last five and confirmed season standings are independently displayed",()=>{
 assert.match(logic,/attachSavedH2H\(S\.games\)/);
 assert.match(logic,/game\.baseResearch=game\.baseResearch\|\|researchBaseMap/);
 assert.match(logic,/function feLastFive\(g\)/);
 assert.match(logic,/function feTableTab\(g\)/);
 assert.match(logic,/fe-leagueTable/);
 assert.match(logic,/feEnsureTable\(g\)/);
 assert.match(logic,/function feOfficialNewsHTML/);
 assert.match(logic,/reportUrls/);
});
test("Top picks separate page has research SGP, ACCA and top 10 evidence-gated markets",()=>{
 assert.match(picks,/THE MATCHDAY SGP/);
 assert.doesNotMatch(picks,/THE J1 GOALS FLYER/);
 assert.match(picks,/THE MATCHDAY ACCA/);
 assert.match(picks,/Top 10 Market Props/);
 assert.match(picks,/FOOTYEDGE <span class="slipFootmark">◆<\/span>/);
 assert.match(picks,/class="ticketTear"/);
 assert.match(picks,/\.ticketPaper \.legTitle/);
 assert.match(picks,/Confidence grades are research rankings/);
 assert.match(picks,/data\("data\/slips\/"\+date\+"\.json"\)/);
 assert.match(picks,/desk\.sgp/);
 assert.match(picks,/desk\.acca/);
 assert.match(picks,/desk\.props/);
 assert.doesNotMatch(picks,/potential payout|payout of/ig);
});
test("Lineups and projections respect source and uncertainty restrictions",()=>{
 assert.match(logic,/data\/team-intelligence\//);
 assert.match(logic,/PREDICTED · NOT CONFIRMED/);
 assert.match(logic,/function feExperimentalProjection/);
 assert.match(logic,/function feProjectionsPanel/);
 assert.match(logic,/10,000 simulated matches/);
 assert.match(logic,/data\\/experimental-simulations\\//);
 assert.match(logic,/fe-projBars/); // Original win/draw/loss segmented presentation is preserved.
 assert.match(markup,/fe-simScore/);
 assert.match(logic,/\["standings","Table"\]/);
 assert.doesNotMatch(logic,/\["comments","Comments"\]/);
});

test("Fixture renderer is complete, uses unified mockup backgrounds, and has no ticket footer",()=>{
 const start=logic.indexOf("function renderGames(){"),end=logic.indexOf("const FILTER_LEAGUE_LOGOS",start);
 assert.ok(start>=0 && end>start,"fixture renderer must exist");
 const renderer=logic.slice(start,end);
 assert.match(renderer,/feMatchHero\(g\)/);
 assert.doesNotMatch(renderer,/fe-cardTicket|esc\(label\)/);
 assert.match(logic,/function feRecentForm\(g\)/);
 assert.match(logic,/function renderModal\(g\)/);
 assert.match(logic,/async function load\(/);
 assert.match(css,/ONE mockup-aligned template/);
 assert.match(css,/\.fe-dialogHero \.fe-hero\.fe-kitHero/);
 assert.match(css,/-webkit-mask-image/);
 assert.match(css,/mix-blend-mode:multiply/);
});
test("External sources remain metadata, never visible on the fixture details",()=>{
 assert.match(logic,/function fePreviewLinks\(g,p\)\{return "";\}/);
 assert.doesNotMatch(logic,/<a class="fe-sourceLine"/);
 assert.doesNotMatch(logic,/>Official club report /);
 assert.doesNotMatch(logic,/source-backed evidence/);
});
