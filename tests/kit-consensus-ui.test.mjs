import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const js=fs.readFileSync("ui/part2.html","utf8");
const css=fs.readFileSync("assets/footyedge-match-v3.css","utf8");

test("2026 official-shirt palettes have independent home and away rules",()=>{
 const a=js.indexOf("const FE_2026_KIT_STYLES="),b=js.indexOf("function feUpcoming(g){",a);
 assert.ok(a>=0&&b>a,"missing kit palette mapping");
 const get=vm.runInNewContext(js.slice(a,b)+";({get:feKitPalette})",{
  fePalette:()=>({primary:"#245B4A",secondary:"#102C39"})
 }).get;
 const feyenoordAway=get({name:"Feyenoord Rotterdam"},"away");
 assert.match(feyenoordAway.primary,/^#[0-9A-F]{6}$/i,"legible palette should have a real hex background");
 assert.equal(feyenoordAway.secondary,"#DAE8F2","preserve the club-specific away palette");
 assert.equal(feyenoordAway.pattern,"tonal");
 assert.equal(get({name:"Real Betis"},"home").pattern,"pinstripe");
 assert.equal(get({name:"Bayern Munich"},"home").pattern,"vertical");
 assert.equal(get({name:"Manchester United"},"away").pattern,"waves");
 assert.ok(get({name:"Unknown Club"},"away").primary,"fallback color exists");
 assert.match(js,/data-home-kit/);
 assert.match(js,/data-away-kit/);
 assert.match(css,/2026\/27 kit pattern variants/);
 assert.match(css,/--fe-home-texture/);
 assert.match(css,/--fe-away-texture/);
});

test("dark team crests keep normal blend and opponent badges use our local registry",()=>{
 assert.match(js,/"feyenoord rotterdam":"feyenoord"/);
 assert.match(js,/makeLogo\(row\.oppId,op\)/);
 assert.match(css,/mix-blend-mode:normal!important;filter:drop-shadow/);
 assert.doesNotMatch(js.slice(js.indexOf("function renderGames(){"),js.indexOf("const FILTER_LEAGUE_LOGOS")) ,/fe-cardTicket|Match analysis/);
});

test("independently dated previews and last-ten statistics yield three source-free choices",()=>{
 const a=js.indexOf("function feOwnerConsensusTop3(g){"),b=js.indexOf("function viewCandidates(g){",a);
 assert.ok(a>=0&&b>a,"current-day research review function missing");
 const fn=vm.runInNewContext(js.slice(a,b)+";feOwnerConsensusTop3",{
   S:{date:"2026-10-21"},etDate:()=>"2026-10-21",URL
 });
 const board=JSON.parse(fs.readFileSync("data/boards/2026-10-21.json","utf8"));
 const research=JSON.parse(fs.readFileSync("data/research-base-2026-10-21.json","utf8"));
 const previews=JSON.parse(fs.readFileSync("data/editorial-previews/2026-10-21.json","utf8"));
 const pick=board.games.find(x=>String(x.id)==="401915396");
 const result=fn({...pick,baseResearch:research.fixtures.find(x=>String(x.id)===String(pick.id)),
   editorialPreview:previews.matches.find(x=>String(x.fixtureId)===String(pick.id))});
 assert.equal(result.length,3);
 assert.ok(result.some(p=>p.editorialSupport>=1));
 assert.ok(result.every((p,i)=>i===0||result[i-1].confidenceRating>=p.confidenceRating));
 assert.equal(new Set(result.map(p=>p.label)).size,result.length);
 assert.doesNotMatch(result.map(x=>x.reason).join(" "),/footballwhispers|sportskeeda|sports mole|https?:\/\//i);
});
