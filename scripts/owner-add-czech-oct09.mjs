#!/usr/bin/env node
/** Owner-authorized October 9 men's Czech First League fixture addition.
 * Preserve the frozen board and never backfill picks after kickoff.
 */
import fs from "node:fs/promises";
import crypto from "node:crypto";
import {loadCzechSeason,eventForCzechMatch} from "../assets/czech-first-league.mjs";
const DAY="2026-10-09";
const FILE="data/boards/"+DAY+".json",REV="data/board-revisions/"+DAY;
const BACKUP=REV+"/before-czech-first-league-addition.json";
const LOGO="https://assets.football-logos.cc/logos/czech-republic/512x512/chance-liga.8511af91.png";
const sha=x=>crypto.createHash("sha256").update(x).digest("hex");
const format=x=>JSON.stringify(x,null,2)+"\n";
function teamForm(matches,team,cutoff){
 const played=matches.filter(m=>Array.isArray(m.score)&&Date.parse(m.kickoff)<cutoff)
  .filter(m=>m.home===team||m.away===team)
  .sort((a,b)=>Date.parse(b.kickoff)-Date.parse(a.kickoff)).slice(0,10);
 const rows=played.map(m=>{
  const h=m.home===team,gf=h?m.score[0]:m.score[1],ga=h?m.score[1]:m.score[0];
  return {date:m.date,venue:h?"home":"away",gf,ga,oppName:h?m.away:m.home,
    result:gf>ga?"W":gf<ga?"L":"D"};
 });
 const sample=rows.slice(0,5);
 const average=k=>sample.length?Number((sample.reduce((a,b)=>a+b[k],0)/sample.length).toFixed(2)):null;
 return {n:sample.length,form:sample.map(x=>x.result).join(" "),gf:average("gf"),ga:average("ga"),
  btts:sample.length?sample.filter(x=>x.gf>0&&x.ga>0).length/sample.length:null,
  o25:sample.length?sample.filter(x=>x.gf+x.ga>=3).length/sample.length:null,
  matches:rows,last10Matches:played.length,
  formSource:"openfootball_europe_2026_27_czech_completed_results"};
}
const before=await fs.readFile(FILE,"utf8"),board=JSON.parse(before);
if(board.date!==DAY||!board.immutable||board.state!=="locked")throw Error("Cannot correct an unexpected archived board");
if(board.ownerCorrection?.czechLeagueAdded){console.log("Czech owner addition already present");process.exit(0)}
const {matches,url}=await loadCzechSeason(DAY);
const todays=matches.filter(m=>m.date===DAY);
if(todays.length!==1||todays[0].home!=="FC Fastav Zlín"||todays[0].away!=="Slavia Praha")throw Error("Czech schedule changed; manual review required");
const current=todays[0],event=eventForCzechMatch(current);
if(board.games.some(g=>String(g.id)===String(event.id)))throw Error("Already saved Czech game without audit");
const kickoff=Date.parse(current.kickoff),now=Date.now();
const h=event.competitions[0].competitors.find(x=>x.homeAway==="home"),
      a=event.competitions[0].competitors.find(x=>x.homeAway==="away");
const oldCount=board.games.length,oldTop5=JSON.stringify(board.top5),
      oldPicks=JSON.stringify(board.games.map(g=>({id:g.id,top:g.top,top3:g.top3})));
const h2h=matches.filter(m=>Array.isArray(m.score)&&Date.parse(m.kickoff)<kickoff&&
  ((m.home===current.home&&m.away===current.away)||(m.home===current.away&&m.away===current.home)))
  .sort((x,y)=>Date.parse(y.kickoff)-Date.parse(x.kickoff)).slice(0,5);
const formHome=teamForm(matches,current.home,kickoff),formAway=teamForm(matches,current.away,kickoff);
const matchday=now>=kickoff;
const note=matchday?
  "Today's match was already underway when the Czech league was added. We won't manufacture earlier picks. The form below uses completed league matches before kickoff.":
  "We've added this Czech First League fixture. We are still checking exact bookmaker prices and model evidence, so no pick is being forced.";
const game={
 id:String(event.id),date:event.date,year:2026,league:"cze.1",leagueName:"Czech First League",
 leagueLogo:LOGO,home:h.team.displayName,away:a.team.displayName,
 teams:{home:{id:String(h.id),name:h.team.displayName,logo:null,score:null},
        away:{id:String(a.id),name:a.team.displayName,logo:null,score:null}},
 top:null,top3:[],teamNews:[],
 ownerEditorial:{
  primary:note,
  headToHead:h2h.length?"We've verified "+h2h.length+" recent league meeting(s) in this data source.":"No recent direct meeting is recorded in the verified current-season results.",
  updatedForOwner:true},
 model:{top:null,top3:[],candidates:[],rankedCandidates:[],researchCandidates:[],
  home:formHome,away:formAway,source:"Czech public-domain completed league matches",h2h:h2h},
 ownerCzechAddition:{addedAfterOriginalLock:true,addedAt:new Date().toISOString(),
  kickoff:current.kickoff,kickoffAlreadyPassed:matchday,backfilledPicks:false,
  sourceUrl:url,odds:"No verified sportsbook line published"},
};
board.games=[...board.games,game].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
board.leagueTop5={...board.leagueTop5,"cze.1":[]};
board.ownerCorrection={...board.ownerCorrection,
 czechLeagueAdded:true,firstLeagueCode:"cze.1",
 czechAddAt:new Date().toISOString(),sourceUrl:url};
if(board.games.length!==oldCount+1||JSON.stringify(board.top5)!==oldTop5||
 JSON.stringify(board.games.filter(g=>g.id!==game.id).map(g=>({id:g.id,top:g.top,top3:g.top3})))!==oldPicks)
 throw Error("Owner expansion unexpectedly altered existing picks or Top 5");
const after=format(board);
await fs.writeFile(BACKUP,before,{flag:"wx"});
const audits=JSON.parse(await fs.readFile(REV+"/audit.json","utf8"));
audits.push({file:FILE,owner:"Shaif",
 instruction:"Add Czech first league games and exact Chance Liga logo, alongside supplied Turkey, Saudi, Portugal and Championship league logos.",
 correctedAt:new Date().toISOString(),beforeSha256:sha(before),afterSha256:sha(after),backupPath:BACKUP,
 reason:"Appended verified men's Czech top-flight match with prior-five league form and exact requested competition logo; no retroactive picks or invented odds, and previous Top 5 and every selection preserved."});
await fs.writeFile(REV+"/audit.json",format(audits));
await fs.writeFile(FILE,after);
console.log("Czech First League added:",game.home,"v",game.away,"kickoff",game.date,
 "beforeKickoff",!matchday,"homeForm",formHome.form,"awayForm",formAway.form,
 "previousPickCount",board.games.reduce((n,g)=>n+g.top3.length,0));
