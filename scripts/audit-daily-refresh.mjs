#!/usr/bin/env node
// Read-only original FootyEdge refresh coverage audit: data-only report, no UI edits.
import fs from "node:fs";
import path from "node:path";
const tz="America/Toronto";
const date=process.env.REFRESH_AUDIT_DATE||(()=>{
 const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 return p.year+"-"+p.month+"-"+p.day;
})();
const root=process.cwd();
const get=p=>{try{return JSON.parse(fs.readFileSync(path.join(root,p),"utf8"))}catch{return null}};
const board=get("data/boards/"+date+".json");
if(board?.date!==date||!Array.isArray(board.games))throw Error("Exact-day published board required; no coverage numbers invented");
const desk=get("data/editorial-desk/"+date+".json");
const news=get("data/team-intelligence/"+date+".json");
const h2h=get("data/h2h/"+date+".json");
const research=get("data/research-base-"+date+".json");
const all=board.games;
const qualified=all.filter(g=>Array.isArray(g.top3)&&g.top3.length===3);
const missed=all.filter(g=>!Array.isArray(g.top3)||g.top3.length!==3);
const ids=new Set(all.map(g=>String(g.id)));
const idRows=(x)=>new Set((x?.fixtures||[]).map(f=>String(f.fixtureId||f.id)).filter(x=>ids.has(x)));
const predicted=(news?.fixtures||[]).filter(f=>ids.has(String(f.fixtureId))&&f.home?.predictedXI?.length===11&&f.away?.predictedXI?.length===11);
const leagueIds=[...new Set(all.map(g=>g.league).filter(Boolean))].sort();
const slipLeagues=[...new Set((desk?.sgpsByLeague||[]).filter(x=>x.status==="qualified"&&x.legs?.length>=3).map(x=>x.league))].sort();
const requiredCupIds=["eng.league_cup","eng.fa_cup","ger.dfb_pokal","esp.copa_del_rey","ita.coppa_italia","fra.coupe_de_france","ned.cup","por.taca.portugal","sco.tennents","sco.cis"];
const provenance=get("data/source-provenance/"+date+".json");
const scheduledCups=(provenance?.fixtures||[]).filter(f=>requiredCupIds.includes(f.league)&&f.verifiedFixtureSchedule?.url);
const publishedCupKeys=new Set(all.filter(g=>requiredCupIds.includes(g.league)).map(g=>g.league+"|"+String(g.home||"").toLowerCase()+"|"+String(g.away||"").toLowerCase()));
const absentCupFixtures=scheduledCups.filter(f=>!publishedCupKeys.has(f.league+"|"+String(f.home||"").toLowerCase()+"|"+String(f.away||"").toLowerCase()));
const obj={
 schema:"footyedge-original-refresh-audit-v1",date,generatedAt:new Date().toISOString(),
 auditedPublishedBoard:board.immutable===true||board.state==="published",
 noUiChanges:true,top5Entries:(board.top5||[]).length,
 fixtureTotal:all.length,leaguesOnSlate:leagueIds,
 cupCoverage:{sourceVerified:scheduledCups.length,absentFromBoard:absentCupFixtures.map(f=>({league:f.league,home:f.home,away:f.away}))},
 picks:{threePerMatch:qualified.length,unqualified:missed.map(g=>({id:String(g.id),league:g.league,reason:g.recoveryStatus||"insufficient verified research"})),
  incompleteCount:missed.length},
 research:{available:research?.date===date,verifiedFixtureIds:idRows(research).size,h2hFixtures:idRows(h2h).size,
  lineupCoverage:predicted.length,newsFixtures:idRows(news).size},
 slips:{editorialAvailable:desk?.date===date,reviewedMatches:(desk?.matches||[]).length,
  qualifiedLeagues:slipLeagues,leaguesWithoutQualifiedSGP:leagueIds.filter(x=>!slipLeagues.includes(x)),
  globalSgpStatus:desk?.sgp?.status||"unavailable",crossGameStatus:desk?.acca?.status||"unavailable"},
 warnings:[
  ...(!research||research.date!==date?["Dated research file missing"]:[]),
  ...(absentCupFixtures.length?["Verified scheduled cup fixtures absent from board: "+absentCupFixtures.length]:[]),
  ...((news?.fixtures||[]).length===0?["No dated team intelligence file with verified lineup/news rows"]:[]),
  ...(all.some(g=>!Array.isArray(g.h2h)||!g.h2h.length)?["One or more board fixtures lack attached H2H; do not represent missing as zero meetings"]:[]),
  ...(missed.length?["Not all games have 3 source-supported picks"]:[]),
  ...(slipLeagues.length<leagueIds.length?["Not every league has a sourced compatible 3+ leg SGP"]:[]),
  ...(predicted.length<all.length?["Predicted starting XIs are incomplete or unverified"]:[]),
  ...((board.top5||[]).length===0&&all.length?["No qualifying global Top 5 published"]:[])
 ]
};
const dest=path.join(root,"data","refresh-health",date+".json");
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,JSON.stringify(obj,null,2)+"\n");
console.log(JSON.stringify({date,fixtures:obj.fixtureTotal,top3:obj.picks.threePerMatch,
  leagueSGPs:obj.slips.qualifiedLeagues.length,news:obj.research.newsFixtures,
  predictedLineups:obj.research.lineupCoverage,warnings:obj.warnings},null,2));
