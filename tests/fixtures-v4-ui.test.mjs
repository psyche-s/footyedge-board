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
 assert.match(logic,/is-upcoming/);
 assert.match(logic,/\(live\?'<i class="fe-liveDot"><\/i>':'\)/);
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
 assert.match(picks,/Best SGP Research Slip/);
 assert.match(picks,/Best ACCA Research Slip/);
 assert.match(picks,/Top 10 Market Props/);
 assert.match(picks,/No odds · Confidence only/);
 assert.match(picks,/return games\.flatMap/);
 assert.match(picks,/differentMarkets/);
 assert.doesNotMatch(picks,/potential payout|payout of/ig);
});
test("Lineups and projections respect source and uncertainty restrictions",()=>{
 assert.match(logic,/data\/team-intelligence\//);
 assert.match(logic,/PREDICTED · NOT CONFIRMED/);
 assert.match(logic,/function feExperimentalProjection/);
 assert.match(logic,/function feProjectionsPanel/);
 assert.match(logic,/from both teams’ last 10 completed matches/);
 assert.match(logic,/\["standings","Table"\]/);
 assert.doesNotMatch(logic,/\["comments","Comments"\]/);
});
