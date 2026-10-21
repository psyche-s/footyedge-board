import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {rosterRows,matchRosterPlayer,parseBio,statEntries,parseRecent,parseOverviewSeason,parseESPNLastFive} from "../api/player-profile.js";
import {extractStarters,rosterPhotos} from "../api/match-updates.js";

const sample={team:{name:"Verified FC"},athletes:[{position:"Forward",items:[
 {id:"99812",displayName:"Álvaro Serrano",jersey:"9",headshot:{href:"https://a.espncdn.com/i/headshots/soccer/players/full/99812.png"}},
 {id:"99813",displayName:"Marco Serrano",jersey:"8"}
]}]};
test("Player resolves by exact team-roster identity; ambiguous surname is not guessed",()=>{
 assert.equal(rosterRows(sample).length,2);
 assert.equal(matchRosterPlayer(sample,"Alvaro Serrano")?.id,"99812");
 assert.equal(matchRosterPlayer(sample,"Serrano"),null);
 assert.equal(matchRosterPlayer(sample,"Someone Else","99812"),null);
 assert.equal(matchRosterPlayer(sample,"Serrano","99812"),null); // ambiguous club surname
 const single={athletes:[{items:[{id:"262071",displayName:"Anastasios Douvikas",jersey:"9"}]}]};
 assert.equal(matchRosterPlayer(single,"Douvikas","262071")?.id,"262071");
 assert.equal(matchRosterPlayer(sample,"Álvaro Serrano","99812")?.id,"99812");
});
test("Verified public bio keeps missing information blank, and never includes private contacts",()=>{
 const p=parseBio({id:"99812",fullName:"Álvaro José Serrano",dateOfBirth:"1998-04-11",
  displayHeight:"5 ft 11 in",position:{displayName:"Forward"},nationality:"Spain",
  headshot:{href:"https://malicious.example/photo.jpg"},email:"secret@example.com",phone:"+1 000"},rosterRows(sample)[0],"Verified FC");
 assert.equal(p.name,"Álvaro José Serrano");
 assert.equal(p.dateOfBirth,"1998-04-11");
 assert.equal(p.headshot,null);
 assert.equal(p.nationality,"Spain");
 assert.equal(p.position,"Forward");
 assert.equal(p.jerseyNumber,"9");
 assert.equal(p.team,"Verified FC");
 assert.doesNotMatch(JSON.stringify(p),/secret@example.com|000|phone|email/);
});
test("Only numeric statistics actually supplied can appear",()=>{
 const s=statEntries({splits:[{categories:[{stats:[
  {name:"goals",value:7},{name:"assists",displayValue:"3"},
  {name:"appearances",value:20},{name:"goals",value:null},
  {name:"unknownProprietary",value:99}]}]}]});
 assert.ok(s.some(x=>x.label==="Goals"&&x.value===7));
 assert.ok(s.some(x=>x.label==="Assists"&&x.value===3));
 assert.ok(s.some(x=>x.label==="Appearances"&&x.value===20));
 assert.ok(!s.some(x=>x.label==="unknownProprietary"));
 assert.deepEqual(parseRecent({items:[]}),[]);
 assert.equal(parseRecent({entries:[{date:"2026-10-17",opponent:{name:"Opposition"},
  statistics:{stats:[{name:"goals",value:2}]}}]})[0]?.goals,2);
});
test("Headshot enrichment preserves matched player id and does not invent absent portraits",()=>{
 const summary={rosters:[{team:{id:"101"},roster:Array.from({length:11},(_,i)=>({
  starter:true,athlete:{id:500+i,displayName:"Player "+i,headshot:{href:"https://a.espncdn.com/"+i+".png"}}
 }))}]};
 const starters=extractStarters(summary);
 assert.equal(starters[0].players.length,11);
 assert.equal(starters[0].players[0].id,"500");
 const photos=rosterPhotos(sample);
 assert.equal(photos[0].id,"99812");
 assert.equal(photos[1].photoUrl,null);
});
test("Player opens from XI as an accessible button, API fetches on click, and lineup WDL pills are squares",()=>{
 const ui=fs.readFileSync("ui/part2.html","utf8");
 const css=fs.readFileSync("assets/footyedge-match-v3.css","utf8");
 assert.match(ui,/data-fe-player-name/);
 assert.match(ui,/function feOpenPlayerProfile/);
 assert.match(ui,/\/api\/player-profile\?/);
 assert.match(ui,/role="dialog"/);
 assert.match(ui,/aria-modal="true"/);
 assert.match(ui,/event\.key==="Escape"/);
 assert.match(ui,/g\.feEditorialPicks/);
 assert.match(css,/Final plain club-color fixture artwork/);
 assert.match(css,/\.fe-recentForm i\.fe-miniResult[\s\S]+?border-radius:6px!important/);
 assert.match(css,/\.fe-playerOverlay/);
 assert.match(css,/\.fe-playerStatsGrid/);
 assert.match(css,/\.fe-playerPortrait/);
});

test("ESPN competition overview returns actual starts goals assists and shots, never zeros for missing fields",()=>{
 const overview={statistics:{names:["starts","totalGoals","goalAssists","totalShots","shotsOnTarget"],
  splits:[{leagueSlug:"ita.1",teamId:"2572",displayName:"2026-27 Italian Serie A",
    stats:["6","3","0","19","10"]},{leagueSlug:"uefa.champions",teamId:"2572",
    displayName:"2026-27 Champions League",stats:["1","2","0","3","2"]},
    {leagueSlug:"uefa.nations",teamId:"455",displayName:"2026-27 UEFA Nations League",stats:["0","1","0","3","1"]}]}};
 const gamelog={seasonTypes:[{displayName:"2026-27 Italian Serie A",
    categories:[{events:Array.from({length:7},(_,i)=>({eventId:"event"+i}))}]}]};
 const selected=parseOverviewSeason(overview,"ita.1","2572",gamelog);
 assert.equal(selected.competition,"2026-27 Italian Serie A");
 assert.equal(selected.stats.find(x=>x.label==="Goals")?.value,3);
 assert.equal(selected.stats.find(x=>x.label==="Assists")?.value,0);
 assert.equal(selected.stats.find(x=>x.label==="Shots")?.value,19);
 assert.equal(selected.stats.find(x=>x.label==="Appearances")?.value,7);
 const european=parseOverviewSeason(overview,"uefa.champions","2572",gamelog);
 assert.equal(european.stats.find(x=>x.label==="Goals")?.value,2);
 assert.ok(!european.stats.some(x=>x.label==="Appearances"));
 assert.equal(parseOverviewSeason(null,"ita.1","2572",null).stats.length,0);
});
test("ESPN last five game logs resolve dated opponents, goals assists and shots",()=>{
 const summary={gameLog:{statistics:[{names:["appearances","totalGoals","goalAssists","totalShots"],
  events:[{eventId:"x1",stats:["Started","2","1","5"]},{eventId:"x2",stats:["Sub","0","0","1"]}]}],
  events:{x1:{gameDate:"2026-09-04T18:45:00Z",opponent:{displayName:"Genoa"}},
    x2:{gameDate:"2026-09-11T18:45:00Z",opponent:{displayName:"Udinese"}}}}};
 const out=parseESPNLastFive(summary,null,"2026-27 Italian Serie A");
 assert.equal(out.length,2);
 assert.equal(out[0].opponent,"Udinese");
 assert.equal(out[1].goals,2);
 assert.equal(out[1].shots,5);
 assert.equal(out[1].appearance,"Started");
});
test("Profile loading is compact and unverified fields are filtered instead of oversized placeholders",()=>{
 const ui=fs.readFileSync("ui/part2.html","utf8"),
   css=fs.readFileSync("assets/footyedge-match-v3.css","utf8");
 assert.match(ui,/fe-profileShimmer/);
 assert.match(ui,/fe-playerStatEmpty/);
 assert.match(ui,/Missing values are omitted, not estimated/);
 assert.match(ui,/\.filter\(x=>x\[1\]!=null&&String\(x\[1\]\)\.trim\(\)\)/);
 assert.match(css,/\.fe-playerPhotoStage/);
 assert.match(css,/background:none!important;border:0!important;box-shadow:none!important/);
 assert.match(css,/object-fit:cover!important/);
});
