import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const html=fs.readFileSync("ui/part2.html","utf8");
const css=fs.readFileSync("assets/footyedge-match-v3.css","utf8");
const extract=(start,end)=>{
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,"Missing fixture/profile function "+start);
 return html.slice(a,b);
};
const browserContext={esc:x=>String(x??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;"),
 fePlayerSafePhoto:()=>"",fePlayerRole:x=>x||"",
 teamImgTag:()=>"",teamDisplayName:(_g,x)=>x.name};
test("Player profile keeps ten separate original-style matchup rows with nine metrics each",()=>{
 const source=extract("function fePlayerProfileMarkup(result,fallback){","async function feOpenPlayerProfile(g,button){");
 const markup=vm.runInNewContext(source+";fePlayerProfileMarkup",browserContext);
 const recent=Array.from({length:10},(_,i)=>({
   date:"2026-10-"+String(i+1).padStart(2,"0"),opponent:"Club "+i,goals:i%2,assists:0,
   shots:2,shotsOnTarget:1,minutes:90,foulsCommitted:1,foulsWon:3,
   yellowCards:0,redCards:0
 }));
 const result=markup({status:"verified",player:{name:"Example Player",team:"Sample FC"},stats:[],recent},
   {name:"Example Player",teamName:"Sample FC"});
 assert.equal((result.match(/class="fe-playerAppearanceRow"/g)||[]).length,10);
 assert.equal((result.match(/class="fe-playerMetric"/g)||[]).length,90);
 assert.match(result,/Last 10 appearances/);
 assert.match(result,/10 verified available/);
 for(const abbr of ["G","A","SH","SOT","MIN","FC","FW","YC","RC"])
   assert.match(result,new RegExp("<strong>"+abbr+"</strong>"));
 assert.match(result,/— means not reported, not zero/);
 assert.doesNotMatch(result,/Swipe the table|fe-playerTableScroll/);
});
test("A fixture with verified squads but no confirmed La Liga XI shows an accurately labelled roster",()=>{
 const source=extract("function feVerifiedSquadPanel(g){","function feLineupsPanel(g){");
 const panel=vm.runInNewContext(source+";feVerifiedSquadPanel",browserContext);
 const game={home:{id:"1538",name:"Levante"},away:{id:"93",name:"Athletic Club"},
   feSquadRosters:{"1538":[{id:"141438",name:"Mathew Ryan",jersey:"13"}],
    "93":[{id:"214412",name:"Iñaki Williams",jersey:"9"}]}};
 const html=panel(game);
 assert.match(html,/Verified team squads/);
 assert.match(html,/not a confirmed XI/);
 assert.match(html,/Mathew Ryan/);
 assert.match(html,/Iñaki Williams/);
 assert.equal((html.match(/data-fe-player-name=/g)||[]).length,2);
 assert.doesNotMatch(html,/OFFICIAL STARTING XI|Predicted formation/);
 const none=panel({...game,feSquadRosters:{}});
 assert.match(none,/has not yet published/);
});
test("La Liga lineup pane retains a verification button and saves ESPN roster even without XI",()=>{
 assert.match(html,/g\.feSquadRosters=data\.rosterHeadshots\|\|\{\}/);
 assert.match(html,/Confirmed starting XIs have not been published/);
 assert.match(html,/feVerifiedSquadPanel\(g\)/);
 assert.match(html,/Check lineups/);
 assert.match(html,/g\.feTab==="lineups"&&!g\.feLastRefreshTime/);
 assert.match(css,/\.fe-playerAppearanceRow/);
 assert.match(css,/\.fe-playerMetricGrid/);
 assert.match(css,/\.fe-squadPlayer/);
});
