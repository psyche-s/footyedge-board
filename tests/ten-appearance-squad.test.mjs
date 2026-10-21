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
 fePlayerSafePhoto:()=>"",fePlayerRole:x=>x||"",feCachedPlayerPhoto:()=>"",
 teamImgTag:()=>"",teamDisplayName:(_g,x)=>x.name};
test("Player profile renders ten horizontal-scroll table rows with nine metrics each",()=>{
 const source=extract("function fePlayerProfileMarkup(result,fallback){","async function feOpenPlayerProfile(g,button){");
 const markup=vm.runInNewContext(source+";fePlayerProfileMarkup",browserContext);
 const recent=Array.from({length:10},(_,i)=>({
   date:"2026-10-"+String(i+1).padStart(2,"0"),opponent:"Club "+i,goals:i%2,assists:0,
   shots:2,shotsOnTarget:1,minutes:90,foulsCommitted:1,foulsWon:3,
   yellowCards:0,redCards:0
 }));
 const result=markup({status:"verified",player:{name:"Example Player",team:"Sample FC"},stats:[],recent},
   {name:"Example Player",teamName:"Sample FC"});
 assert.equal((result.match(/<tr>/g)||[]).length,11); // header + ten appearances
 assert.equal((result.match(/<td>/g)||[]).length,90);
 assert.match(result,/class="fe-playerLastTenTable"/);
 assert.match(result,/class="fe-playerTableScroll"/);
 assert.match(result,/scope="row" class="fe-playerOpponent"/);
 assert.match(result,/Last 10 appearances/);
 assert.match(result,/10 verified available/);
 for(const abbr of ["G","A","SH","SOT","MIN","FC","FW","YC","RC"])
   assert.match(result,new RegExp('<th scope="col" title="[^"]+">'+abbr+"</th>"));
 assert.match(result,/— means not reported, not zero/);
 assert.match(result,/Scroll sideways to see all match statistics/);
});
test("La Liga lineup pane keeps the pitch and check button without duplicate squads",()=>{
 assert.match(html,/g\.feSquadRosters=data\.rosterHeadshots\|\|\{\}/);
 assert.match(html,/Confirmed starting XIs have not been published/);
 assert.doesNotMatch(html,/feVerifiedSquadPanel\(g\)/);
 assert.match(html,/Check lineups/);
 assert.match(html,/g\.feTab==="lineups"&&!g\.feLastRefreshTime/);
 assert.match(css,/\.fe-playerTableScroll/);
 assert.match(css,/\.fe-playerLastTenTable/);
 assert.match(css,/\.fe-squadPlayer/);
});

test("Every league retains the field when lineups are still pending",()=>{
 const source=extract("function feLineupsPanel(g){","function feMatchSourceStatus(g){");
 const panel=vm.runInNewContext(source+";feLineupsPanel",{
  ...browserContext,
  feTeamPitchRows:(_intel,t)=>'<div class="fe-sharedHalf">'+t.name+'</div>',
  feMatchSourceStatus:()=>''
 });
 const game={league:"esp.1",home:{name:"Levante"},away:{name:"Athletic Club"}};
 const output=panel(game);
 assert.match(output,/class="fe-sharedPitch"/);
 assert.match(output,/Levante/);
 assert.match(output,/Athletic Club/);
 assert.match(output,/XI PENDING/);
 assert.match(output,/Confirmed starting XIs have not been published/);
 assert.doesNotMatch(output,/Squad players|Verified team squads/);
 const supplied=panel({...game,teamIntel:{source:{url:"https://example.org/fixture"},
  home:{predictedXI:Array.from({length:11},(_,i)=>"Player "+i)},away:{predictedXI:[]}}});
 assert.match(supplied,/PREDICTED · NOT CONFIRMED/);
 assert.match(supplied,/class="fe-sharedPitch"/);
});
