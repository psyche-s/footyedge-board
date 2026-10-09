#!/usr/bin/env node
/** Frozen FootyEdge selections vs actual scores for October 5/6.
 * This is NOT a Dixon-Coles head-to-head (national teams unsupported).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { gradeOriginal } from "./review-shadow.mjs";
const dates=["2026-10-05","2026-10-06"];
const output={modelVersion:"archived-originals-audit-v0.1",dateRange:dates,
  comparisonValidity:"none: Dixon-Coles v0.3 covers seven men's club leagues only; Oct 5/6 official selections are national-team games",
  statement:"No retrospective national-team model picks are fabricated or attributed to the new model.",
  days:[],totals:{picks:0,hits:0,misses:0,pushes:0,ungraded:0},modelVsFootyEdgeMatches:0};
for(const date of dates){
 const [original,scores]=await Promise.all([
   fs.readFile("data/boards/"+date+".json","utf8").then(JSON.parse),
   fs.readFile("data/"+date+"/scoreboard.json","utf8").then(JSON.parse)
 ]);
 const byId=new Map((scores.events||[]).map(e=>[String(e.id),e]));
 const games=[];
 for(const game of original.games||[]){
   const event=byId.get(String(game.id))||
     (scores.events||[]).find(e=>{
       const teams=e.competitions?.[0]?.competitors||[];
       return teams.some(x=>x.homeAway==="home"&&x.team?.displayName===game.home) &&
              teams.some(x=>x.homeAway==="away"&&x.team?.displayName===game.away);
     });
   const cs=event?.competitions?.[0]?.competitors||[];
   const h=cs.find(c=>c.homeAway==="home"),a=cs.find(c=>c.homeAway==="away");
   const valid=event?.status?.type?.completed===true&&h&&a
     &&Number.isFinite(Number(h.score))&&Number.isFinite(Number(a.score));
   for(const pick of game.top3||[]){
     const settled=valid?gradeOriginal(pick,game,Number(h.score),Number(a.score)):"pending";
     games.push({home:game.home,away:game.away,selection:pick.label,
       originalConfidence:pick.score??null,originalOdds:pick.odds??null,
       score:valid?[Number(h.score),Number(a.score)]:null,originalOutcome:settled,
       newModelPick:null,modelComparisonStatus:"unsupported_national_team_model"});
     output.totals.picks++;
     if(settled==="hit")output.totals.hits++;
     else if(settled==="miss")output.totals.misses++;
     else if(settled==="push")output.totals.pushes++;
     else output.totals.ungraded++;
   }
 }
 output.days.push({date,graded:games.length,games});
}
output.totals.hitRate=output.totals.hits+output.totals.misses?
  Number((output.totals.hits/(output.totals.hits+output.totals.misses)).toFixed(6)):null;
const file=path.join("data","model-backtests","archived-originals-2026-10-05_06.json");
if(process.argv.includes("--dry-run"))console.log(JSON.stringify(output.totals));
else{
 await fs.mkdir(path.dirname(file),{recursive:true});
 try{await fs.writeFile(file,JSON.stringify(output,null,2)+"\n",{flag:"wx"})}
 catch(e){if(e.code!=="EEXIST")throw e;console.log("Immutable original outcome audit already exists");}
 console.log("Archived outcome comparison:",file,JSON.stringify(output.totals));
}
