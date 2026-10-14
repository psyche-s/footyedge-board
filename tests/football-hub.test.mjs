import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
import {toCompact,toCompactPublic,mergeGames,recentYears,validateSource} from "../scripts/sync-football-data-hub.mjs";
const require=createRequire(import.meta.url);
const hub=require("../assets/football-hub-history.js");
const doc={
 schema:"footyedge-history-v1",license:"CC0-1.0",competition:"eng.1",
 games:[
 {id:"old",d:"2025-05-01",h:"Arsenal FC",a:"Chelsea FC",hs:2,as:0,s:"2024-25"},
 {id:"new",d:"2026-09-01",h:"Chelsea FC",a:"Arsenal FC",hs:1,as:1,s:"2026-27"},
 {id:"future",d:"2026-10-14",h:"Arsenal FC",a:"Chelsea FC",hs:7,as:7,s:"2026-27"},
 {id:"other",d:"2026-08-01",h:"Liverpool FC",a:"Chelsea FC",hs:4,as:3,s:"2026-27"}
]};
const fixture={league:"eng.1",date:"2026-10-14T18:00:00Z",home:{name:"Arsenal"},away:{name:"Chelsea"}};
test("H2H only historical games and exact teams, date newest first",()=>{
 const rows=hub.getH2HFromDocument(doc,fixture);
 assert.deepEqual(rows.map(r=>r.id),["new","old"]);
 assert.equal(rows[0].awayScore,1);
 assert.equal(rows[1].homeScore,2);
});
test("Unsupported leagues and identities are not inferred",()=>{
 assert.equal(hub.sourceLeague("uefa.champions"),null);
 assert.equal(hub.getH2HFromDocument(doc,{...fixture,away:{name:"Manchester City"}}).length,0);
 assert.equal(hub.getH2HFromDocument({...doc,license:"unknown"},fixture).length,0);
 assert.equal(hub.norm("Manchester City FC"),"manchester city");
});
test("Hub mirror browser fetches public path only and caches",async()=>{
 let calls=0;const fetcher=async(url)=>{calls++;assert.equal(url,"/data/football-hub/eng.1.json");return{ok:true,json:async()=>doc}};
 const one=await hub.findH2H(fixture,fetcher);
 const two=await hub.findH2H(fixture,fetcher);
 assert.equal(one.length,2);assert.equal(two.length,2);assert.equal(calls,1);
 hub.clearCache();
});
test("Nonfinal games and today's scores are excluded from publisher",()=>{
 const match={id:"of:test",date:"2026-10-12",status:"final",home_name:"Arsenal",away_name:"Chelsea",score:{full_time:[1,0]},season:"2026-27"};
 assert.equal(toCompact(match,"2026-10-14").hs,1);
 assert.equal(toCompact({...match,status:"not_final"},"2026-10-14"),null);
 assert.equal(toCompact({...match,date:"2026-10-14"},"2026-10-14"),null);
 assert.equal(toCompact({...match,score:{full_time:[null,null]}},"2026-10-14"),null);
});
test("Current upstream fallback creates matching source IDs",()=>{
 const m={round:"Matchday 1",date:"2026-08-14",team1:"Arsenal FC",team2:"Chelsea FC",score:{ft:[3,2]}};
 const row=toCompactPublic(m,"en.1","2026-27","2026-10-14");
 assert.match(row.id,/^of:[a-f0-9]{24}$/);
 assert.equal(row.hi,"club:england:arsenal-fc");
 assert.equal(row.hs,3);
 assert.equal(toCompactPublic({...m,score:{} },"en.1","2026-27","2026-10-14"),null);
});
test("Corrected scores update stable match IDs",()=>{
 const game={id:"of:fixture",d:"2026-09-12",h:"A",a:"B",hs:1,as:0};
 assert.equal(mergeGames([game],[{...game,hs:2}],"2026-10-14")[0].hs,2);
 assert.deepEqual(recentYears("2026-10-14"),["2025-26","2026-27"]);
});
test("Private source must be explicitly CC0",()=>{
 assert.equal(validateSource({source:"openfootball/football.json",license:"CC0-1.0",competition_id:"en.1",matches:[]},"en.1"),true);
 assert.throws(()=>validateSource({source:"other",license:"CC-BY-NC",competition_id:"en.1",matches:[]},"en.1"));
});
test("Original FootyEdge board files are not sync targets",()=>{
 const src=readFileSync("scripts/sync-football-data-hub.mjs","utf8");
 assert.equal(src.includes("data/boards/"),false);
 assert.match(src,/football-hub/);
});
