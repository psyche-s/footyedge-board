import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {rosterRows,matchRosterPlayer,parseBio,statEntries,parseRecent,parseOverviewSeason,parseESPNLastFive,parseESPNLastTen} from "../api/player-profile.js";
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
test("Headshot enrichment preserves matched player IDs without guessing missing image URLs",()=>{
 const summary={rosters:[{team:{id:"101"},roster:Array.from({length:11},(_,i)=>({
  starter:true,athlete:{id:500+i,displayName:"Player "+i,headshot:{href:"https://a.espncdn.com/"+i+".png"}}
 }))}]};
 const starters=extractStarters(summary);
 assert.equal(starters[0].players.length,11);
 assert.equal(starters[0].players[0].id,"500");
 const photos=rosterPhotos(sample);
 assert.equal(photos[0].id,"99812");
 assert.equal(photos[0].photoUrl,"https://a.espncdn.com/i/headshots/soccer/players/full/99812.png");
 assert.equal(photos[1].photoUrl,null); // A missing photo is not a verified CDN image
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
 assert.match(css,/\.fe-matchCard/);
 assert.match(css,/\.fe-playerLastTenTable/);
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
 assert.match(ui,/const number=new Map/);
 assert.match(ui,/priority=\["Appearances","Starts","Minutes played","Goals","Assists","Shots on target","Shots"/);
 assert.match(ui,/fe-playerStatsGridFull/);
 assert.doesNotMatch(ui.slice(ui.indexOf("function fePlayerProfileMarkup("),ui.indexOf("function feOpenPlayerProfile(")),/Not available<\/strong>/);
 assert.match(ui,/not provided, not zero/);
 assert.match(ui,/\.filter\(x=>x\[1\]!=null&&String\(x\[1\]\)\.trim\(\)\)/);
 assert.match(css,/\.fe-playerPhotoStage/);
 assert.match(css,/background:none!important;border:0!important;box-shadow:none!important/);
 assert.match(css,/transform:scale\(1\.58\)!important/);
 assert.match(css,/object-fit:contain!important/);
});

test("Complete fixture script parses and player profile displays only real stat values",()=>{
 const combined=fs.readFileSync("ui/part1.html","utf8")+fs.readFileSync("ui/part2.html","utf8");
 const scripts=[...combined.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.ok(scripts.length>=1,"combined fixture page must contain executable script");
 for(const script of scripts)assert.doesNotThrow(()=>new Function(script[1]));
 const ui=fs.readFileSync("ui/part2.html","utf8");
 assert.match(ui,/const number=new Map/);
 assert.match(ui,/fe-playerStatsGridFull/);
 assert.doesNotMatch(ui.slice(ui.indexOf("function fePlayerProfileMarkup("),ui.indexOf("function feOpenPlayerProfile(")),/Not available<\/strong>/);
});

test("Last ten verified club appearances merge cross-competition game logs, not international games",()=>{
 const events={},domestic=[],europe=[];
 for(let i=0;i<13;i++){
  const id="match"+i;
  events[id]={gameDate:"2026-10-"+String(i+1).padStart(2,"0")+"T12:00:00Z",
   team:{id:i===12?"455":"2572"},opponent:{displayName:"Opponent "+i}};
  const row={eventId:id,stats:["1","0","3","2","1","2","0","0","0"]};
  (i%3===0?europe:domestic).push(row);
 }
 const domesticLog={names:["totalGoals","goalAssists","totalShots","shotsOnTarget",
  "foulsCommitted","foulsSuffered","offsides","yellowCards","redCards"],events,
  seasonTypes:[{displayName:"2026-27 Italian Serie A",categories:[{events:domestic}]}]};
 const uclLog={...domesticLog,seasonTypes:[{displayName:"2026-27 Champions League",
  categories:[{events:europe}]}]};
 const overview={gameLog:{displayName:"2026-27 Italian Serie A",events,
  statistics:[{names:["appearances","totalGoals"],events:[{eventId:"match11",stats:["Started","1"]}]}]}};
 const out=parseESPNLastTen(overview,[domesticLog,uclLog],"2572",Date.parse("2026-10-25"));
 assert.equal(out.length,10);
 assert.equal(out[0].opponent,"Opponent 11");
 assert.equal(out[0].appearance,"Started");
 assert.equal(out[0].shotsOnTarget,2);
 assert.equal(out[0].foulsCommitted,1);
 assert.equal(out[0].foulsWon,2);
 assert.equal(out[0].yellowCards,0);
 assert.equal(out[0].minutes,null);
 assert.ok(!out.some(x=>x.opponent==="Opponent 12"));
});
test("Player profile displays requested ten-game columns, app-start distinction and simple position",()=>{
 const ui=fs.readFileSync("ui/part2.html","utf8");
 const css=fs.readFileSync("assets/footyedge-match-v3.css","utf8");
 assert.match(ui,/Appearances = all games played, including substitutions/);
 assert.match(ui,/Starts = games in the starting XI/);
 assert.match(ui,/slice\(0,10\)/);
 for(const key of ["minutes","goals","assists","shotsOnTarget","shots","foulsCommitted","foulsWon","yellowCards","redCards"])
  assert.ok(ui.includes('"'+key+'"'),"Missing requested recent stat "+key);
 assert.match(ui,/function fePlayerRole\(position\)/);
 assert.doesNotMatch(ui,/Goal protection and distribution/);
 assert.match(css,/fe-playerStatsGridFull/);
 assert.match(css,/fe-playerMatchStats/);
 assert.match(css,/scale\(1\.90\)/);
});


test("Last-ten UI keeps the opponent sticky while nine metrics scroll horizontally",()=>{
 const ui=fs.readFileSync("ui/part2.html","utf8");
 const css=fs.readFileSync("assets/footyedge-match-v3.css","utf8");
 const markup=ui.slice(ui.indexOf("function fePlayerProfileMarkup("),ui.indexOf("async function feOpenPlayerProfile("));
 assert.match(markup,/fe-playerTableScroll/);
 assert.match(markup,/fe-playerLastTenTable/);
 assert.match(markup,/fe-playerOpponent/);
 assert.match(markup,/fe-playerStatLegend/);
 assert.match(markup,/slice\(0,10\)/);
 assert.match(markup,/Last 10 appearances/);
 assert.doesNotMatch(markup,/fe-playerAppearanceRow/);
 for(const token of ["MIN","SH","SOT","FC","FW","YC","RC","G","A"])
   assert.ok(markup.includes('"'+token+'"'),"Missing abbreviation "+token);
 assert.match(css,/\.fe-playerTableScroll\{/);
 assert.match(css,/overflow-x:auto/);
 assert.match(css,/\.fe-playerLastTenTable th:first-child\{/);
 assert.match(css,/position:sticky;left:0/);
 assert.match(css,/\.fe-playerPhotoStage\{/);
});
test("Club matches show ESPN's actual competition, not a generic Last 5 Matches label",()=>{
 const overview={gameLog:{displayName:"Last 5 Matches",
  statistics:[{names:["totalGoals"],events:[{eventId:"c1",stats:["2"]}]}],
  events:{c1:{gameDate:"2026-10-19T11:00:00Z",team:{id:"2572"},
   leagueName:"Italian Serie A",opponent:{displayName:"Udinese"}}}}};
 const actual=parseESPNLastTen(overview,[],"2572",Date.parse("2026-10-21"));
 assert.equal(actual.length,1);
 assert.equal(actual[0].competition,"Italian Serie A");
 assert.equal(actual[0].goals,2);
 assert.equal(actual[0].minutes,null);
});
