import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const p1=fs.readFileSync("ui/part1.html","utf8");
const p2=fs.readFileSync("ui/part2.html","utf8");
const builder=fs.readFileSync("scripts/build-research-base.mjs","utf8");
const validator=fs.readFileSync("scripts/validate-daily-board.mjs","utf8");
const home=fs.readFileSync("index.html","utf8");
const aboutPage=fs.readFileSync("about.html","utf8");

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

test("mobile date bar keeps all five controls on one row",()=>{
  assert.match(p1,/grid-template-columns:36px minmax\(0,1fr\) auto 36px 36px!important/)
});
test("league fallback is a transparent SVG, never the emoji football",()=>{
  assert.match(p2,/function leagueFallbackHtml\(\)/);
  assert.match(p2,/viewBox="0 0 24 24"/);
  assert.doesNotMatch(p2,/<span class="leagueFallback" aria-hidden="true">⚽<\/span>/)
});
test("morning data horizon covers today plus next four days",()=>{
  const research=fs.readFileSync(".github/workflows/build-research-base.yml","utf8");
  const snapshots=fs.readFileSync(".github/workflows/refresh-snapshots.yml","utf8");
  assert.match(research,/for OFFSET in 0 1 2 3 4/);
  assert.match(snapshots,/for OFFSET in 0 1 2 3 4/)
});

test("exact sportsbook endpoint permits today plus next four dates",()=>{
  const oddsApi=fs.readFileSync("api/the-odds.js","utf8");
  assert.doesNotMatch(oddsApi,/live_date_only/);
  assert.match(oddsApi,/outside_5_day_horizon/);
  assert.match(oddsApi,/"fifa\.friendly"/)
});

test("future exact odds are filtered to the requested Toronto calendar date",()=>{
  const oddsApi=fs.readFileSync("api/the-odds.js","utf8");
  assert.match(oddsApi,/torontoDateOf\(event\.commence_time\)===date/)
});

test("rolling previews ignore missing price but respect posted-price floor",()=>{
  assert.match(p1,/function previewPriceAllowed\(p\)/);
  assert.match(p1,/!hasPostedPrice\(p\)\|\|priceAllowed\(p\)/);
  assert.match(p1,/window\.FootyEdgeDraft/)
});
test("public board prefers official lock then rolling preview",()=>{
  assert.match(p2,/data\/board-drafts/);
  assert.match(p2,/Morning preview · updates until 6:00 AM ET/);
  assert.match(p2,/Locked at 6:00 AM ET/)
});
test("official board locks from preview at 06:00 Toronto",()=>{
  const freezer=fs.readFileSync("scripts/archive-board.mjs","utf8");
  const publisher=fs.readFileSync("scripts/publish-board-previews.mjs","utf8");
  assert.match(freezer,/LOCK_HOUR=6/);
  assert.match(freezer,/board-drafts/);
  assert.match(freezer,/payload\.immutable=true/);
  assert.match(publisher,/Past 06:00 Toronto lock; refusing mutable refresh/)
});

test("league filters use recognizable Wikimedia marks for MLS, Bundesliga and Ligue 1",()=>{
  assert.match(p2,/"usa\.1":"https:\/\/commons\.wikimedia\.org\/wiki\/Special:Redirect\/file\/Major_League_Soccer_logo\.svg"/);
  assert.match(p2,/"ger\.1":"https:\/\/upload\.wikimedia\.org\/wikinews\/en\/1\/15\/Bundesliga_logo\.svg"/);
  assert.match(p2,/"fra\.1":"https:\/\/commons\.wikimedia\.org\/wiki\/Special:Redirect\/file\/Logo_Ligue_1_McDonald%27s_2024\.svg"/)
});
test("current international slate has direct flag mappings",()=>{
  for(const name of ["bolivia","el salvador","haiti","india","indonesia","jamaica","jordan","malaysia","new zealand","panama","philippines","russia","saudi arabia"])assert.ok(p2.includes('"'+name+'":'))
});

test("rolling previews never freeze converted or otherwise unverified prices",()=>{
  assert.match(p1,/p\.odds!=null&&p\.bookKey/);
  assert.match(p1,/function clonePreviewPickForArchive/);
  assert.match(p1,/x\.odds=null/);
  assert.match(p2,/daily-odds-/)
});

test("expanded analysis uses uppercase WHY THIS PICK and preserves existing Team News rendering",()=>{
  assert.match(p2,/WHY THIS PICK/);
  assert.match(p2,/const newsHtml=teamCard\(g\.home\)\+teamCard\(g\.away\)/);
});
test("verified native display prices can show EV while unavailable exact markets are explicit",()=>{
  assert.match(p1,/p\.ev==null\?"—":evText\(p\.ev\)/);
  assert.match(p1,/p\.priceStatus/);
  assert.match(p1,/odds:"N\/A"/);
});

test("expanded Team News keeps the original team-card layout",()=>{
  assert.match(p2,/No verified absence or lineup change has been reported yet/);
  assert.match(p2,/teamNewsCard/);
  assert.match(p2,/const newsHtml=teamCard\(g\.home\)\+teamCard\(g\.away\)/);
});
test("form chips support archived verified W D L strings",()=>{
  assert.match(p2,/function formHTML/);
  assert.match(p2,/\^\[WDL\]\$/);
});

test("collapsed match cards do not render Team News; expanded drawer keeps team cards",()=>{
  assert.doesNotMatch(p2,/const news=teamNewsSummary\(g,p\);\s*if\(news\)html\+=/);
  assert.match(p2,/const newsHtml=teamCard\(g\.home\)\+teamCard\(g\.away\)/);
  assert.match(p2,/modalTeamNews/);
});
test("verified prices render in American format from exact decimal price",()=>{
  assert.match(p1,/function americanFromDecimalPrice/);
  assert.match(p1,/function displayAmericanOdds/);
  assert.match(p1,/odds:displayAmericanOdds\(p\)/);
});

test("reader-facing commentary avoids model-report jargon",()=>{
  assert.doesNotMatch(p1,/venue-rate blend|Poisson translation|risk-adjusted fit|positive availability\/continuity signal/i);
});
test("women fixtures add W suffix only at display layer",()=>{
  assert.match(p2,/function isWomenFixture/);
  assert.match(p2,/function teamDisplayName/);
  assert.match(p2,/function displayPickLabel/);
  assert.match(p2,/name\+" \(W\)"/);
});

test("Top 3 pick labels stay single-line while cards and stat boxes stay compact",()=>{
  assert.match(p1,/v83 owner-requested compact Top 3/);
  assert.match(p1,/\.top3PickMain b\{[\s\S]*?white-space:nowrap!important/);
  assert.match(p1,/\.top3Pick\{[\s\S]*?min-height:0!important/);
  assert.match(p1,/\.analysisContent \.statCell\{[\s\S]*?height:30px!important/);
});

test("expanded modal centers VS between flags and normalizes four metric tiles",()=>{
  assert.match(p1,/v84 expanded modal alignment cleanup only/);
  assert.match(p1,/\.modalTeams>\.vs\{[\s\S]*?height:72px!important[\s\S]*?align-items:center!important[\s\S]*?justify-content:center!important/);
  assert.match(p1,/\.metric \.form\{[\s\S]*?margin:0!important[\s\S]*?min-height:0!important/);
  assert.match(p1,/\.metric\{[\s\S]*?height:42px!important[\s\S]*?justify-content:center!important/);
});

test("expanded four metric boxes are identical size",()=>{
  assert.match(p1,/v85 equal-size expanded metric tiles only/);
  assert.match(p1,/grid-template-rows:repeat\(2,42px\)!important/);
  assert.match(p1,/\.metric\{[\s\S]*?max-height:42px!important/);
});

test("Home Top 5 applies womens W suffix at display layer",()=>{
  assert.match(home,/function homeWomenFixture/);
  assert.match(home,/function homeTeamName/);
  assert.match(home,/function homeSelectionLabel/);
  assert.match(home,/renderTop5\(board\.top5,"",board\)/);
});

test("Home and About support buttons use native matching CTA typography and height",()=>{
  assert.match(home,/class="supportCta"/);
  assert.match(home,/\.supportCta\{[\s\S]*?min-height:46px[\s\S]*?font-family:inherit/);
  assert.match(home,/\.cta\{[\s\S]*?min-height:46px[\s\S]*?font-family:inherit/);
  assert.match(aboutPage,/class="supportCta"/);
  assert.match(aboutPage,/ABOUT FOOTYEDGE/);
});
test("mobile Home hero uses a tall image stage through the tagline",()=>{
  assert.match(home,/@media\(max-width:640px\)[\s\S]*?\.heroStage\{height:285px/);
  assert.match(home,/@media\(max-width:640px\)[\s\S]*?\.heroStage>img\{object-fit:cover/);
});

test("Support CTA keeps the original Buy Me a Coffee cup mark",()=>{
  assert.match(home,/bmc-new-btn-logo\.svg/);
  assert.match(aboutPage,/bmc-new-btn-logo\.svg/);
});

test("Home merges intro into hero with image stage and no separate About card",()=>{
  assert.match(home,/class="heroStage"/);
  assert.match(home,/class="heroBrand"/);
  assert.match(home,/id="heroImage"/);
  assert.match(home,/class="heroIntro"/);
  assert.doesNotMatch(home,/class="card about"/);
  assert.doesNotMatch(home,/>ABOUT<\/span> FOOTYEDGE/);
  assert.match(home,/heroImage"\)\.src="data:image\/webp;base64/);
});
test("mobile hero extends image through tagline with a readability fade",()=>{
  assert.match(home,/class="heroStage"/);
  assert.match(home,/class="heroBrand"/);
  assert.match(home,/\.heroStage\{height:285px/);
  assert.match(home,/\.heroStage>img\{object-fit:cover/);
  assert.match(home,/\.heroStage:after\{background:linear-gradient/);
});

test("logo cache is loaded before Today’s Picks UI and local assets are preferred",()=>{
  assert.match(fs.readFileSync("picks.html","utf8"),/assets\/logos\/registry\.js/);
  assert.match(p2,/const REMOTE_LEAGUE_LOGOS=/);
  assert.match(p2,/eng\.1":"\/assets\/logos\/competitions\/eng\.1\.png/);
  assert.match(p2,/window\.FOOTYEDGE_LOGOS\?\.teams/);
});
test("football-logos.cc is canonical upstream for cached logos",()=>{
  const cfg=JSON.parse(fs.readFileSync("data/logo-sources.json","utf8"));
  assert.equal(cfg.source,"https://football-logos.cc");
  assert.ok(cfg.competitions.length>=10);
  const sync=fs.readFileSync("scripts/sync-football-logos.mjs","utf8");
  assert.match(sync,/football-logos\.cc/);
  assert.match(sync,/manifest\.json/);
  assert.match(sync,/registry\.js/);
});

test("competition marks use dark-UI variants and remain contained",()=>{
  const cfg=JSON.parse(fs.readFileSync("data/logo-sources.json","utf8"));
  const byId=Object.fromEntries(cfg.competitions.map(x=>[x.id,x]));
  assert.match(byId["uefa.champions"].page,/uefa-champions-league\/no-text\/$/);
  assert.equal(byId["uefa.champions"].displayVariant,"no-text-white");
  assert.match(byId["fra.1"].page,/ligue-1\/white\/$/);
  assert.match(byId["ned.1"].page,/eredivisie\/no-text-white\/$/);
  assert.match(p1,/\.leagueLogoUcl\{[\s\S]*?brightness\(0\) invert\(1\)/);
  assert.match(p1,/\.leagueIcon\{[\s\S]*?overflow:hidden!important/);
  assert.match(p2,/leagueLogoSerieA/);
});

test("locked board competition metadata remains authoritative after live fixture merge",()=>{
  assert.match(p1,/if\(a\.leagueName\)g\.leagueName=a\.leagueName/);
  assert.match(p1,/if\(a\.league!=null\)g\.league=a\.league/);
  assert.match(p2,/modalTitle"\)\.textContent=teamDisplayName\(g,g\.home\)\+" vs "\+teamDisplayName\(g,g\.away\)/);
});

test("public schedule and research apply the configured tagged-event scope",()=>{
  const availability=fs.readFileSync("assets/board-availability.js","utf8");
  const research=fs.readFileSync("scripts/build-research-base.mjs","utf8");
  assert.match(availability,/function excludedTaggedEvent/);
  assert.match(availability,/!excludedTaggedEvent\(e\)/);
  assert.match(research,/FootyEdgeAvailability\.excludedTaggedEvent/);
  assert.match(p2,/filter\(e=>!FootyEdgeAvailability\.excludedTaggedEvent\?\.\(e\)\)\.map/);
});

test("October 7 corrected official board is locked and cleared",()=>{
  const board=JSON.parse(fs.readFileSync("data/boards/2026-10-07.json","utf8"));
  assert.equal(board.immutable,true);
  assert.equal(board.state,"locked");
  assert.equal(board.coverage,"full-board");
  assert.deepEqual(board.top5,[]);
  assert.deepEqual(board.games,[]);
});

test("empty locked boards resolve and show the next eligible game date",()=>{
  const availability=fs.readFileSync("assets/board-availability.js","utf8");
  assert.match(availability,/async function loadNext\(date,readJson\)/);
  assert.match(availability,/nextGameDate:day/);
  assert.match(availability,/No games today\./);
  assert.match(p2,/FootyEdgeAvailability\.loadNext\(date,json\)/);
  assert.match(p1,/board-availability\.js\?v=\d+/);
});

test("five owner-supplied league logos remain shared across competition surfaces",()=>{
  const urls=[
    "chance-liga.8511af91.png",
    "super-lig.e5930ec5.png",
    "saudi-professional-league.59d5c8af.png",
    "primeira-liga--white.c5c27520.png",
    "efl-championship.2766b536.png"
  ];
  for(const url of urls)assert.ok(p2.includes(url),url+" must stay in the exact logo mapping");
  for(const id of ["cze.1","tur.1","ksa.1","por.1","eng.2"]){
    assert.ok(p2.includes('"'+id+'":EXACT_LEAGUE_LOGOS["'+id+'"]'),id+" must reference the shared logo map");
  }
  assert.match(p2,/const src=EXACT_LEAGUE_LOGOS\[id\]\|\|LEAGUE_LOGOS\[id\]/);
  assert.match(p2,/leagueIconHtml\(id\)/);
  assert.match(p2,/leagueIconHtml\(g\.league,g\.leagueLogo\)/);
});
test("competition names and icon columns align in filters and match headers",()=>{
  assert.ok(p1.includes('"por.1":"Liga Portugal"'));
  assert.match(p1,/grid-template-columns:24px max-content!important/);
  assert.match(p1,/grid-template-columns:24px minmax\(0,1fr\)!important/);
  assert.match(p1,/\.filterPill \.leagueLogoImg,\.gameTop \.leagueLogoImg,\.modalLeague \.leagueLogoImg/);
  assert.match(p2,/esc\(displayLeagueName\(g\.league,g\.leagueName\)\)/);
});

test("Premier League and MLS logos fit fully inside the existing competition icon box",()=>{
  assert.match(p1,/\.league-eng-1 \.leagueLogoImg\{transform:scale\(\.78\)!important\}/);
  assert.match(p1,/\.league-usa-1 \.leagueLogoImg\{transform:scale\(\.78\)!important\}/);
  assert.match(p1,/\.leagueIcon\{[\s\S]*?width:24px!important[\s\S]*?height:24px!important/);
});
