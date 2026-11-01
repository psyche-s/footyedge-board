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
const pricedSlips=get("data/slips-reviewed/"+date+".json");
const sourceLed=get("data/source-led/"+date+".json");
const reviewed=get("data/consensus-reviewed/"+date+".json");
const reviewedById=new Map((reviewed?.date===date?reviewed.matches||[]:[]).map(x=>[String(x.gameId),x]));
const v4=get("data/experimental-simulations/"+date+"-v4.json");
const modelById=new Map((v4?.date===date?v4.fixtures||[]:[]).map(x=>[String(x.fixtureId),x]));
const publisherById=new Map((sourceLed?.date===date?sourceLed.matches||[]:[]).map(x=>[String(x.gameId),x]));
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
const newsById=new Map((news?.fixtures||[]).map(f=>[String(f.fixtureId),f]));
const deskById=new Map((desk?.matches||[]).map(f=>[String(f.gameId),f]));
const perFixture=all.map(g=>{
 const id=String(g.id),intel=newsById.get(id),review=deskById.get(id);
 const reviewedRow=reviewedById.get(id);
 const count=Array.isArray(reviewedRow?.picks)?reviewedRow.picks.length:Array.isArray(g.top3)?g.top3.length:0;
 const archiveCount=Array.isArray(g.top3)?g.top3.length:0;
 const lineupReady=!!(intel?.home?.predictedXI?.length===11&&intel?.away?.predictedXI?.length===11);
 const lineupStatus=lineupReady?(intel.home.lineupStatus==="confirmed"&&intel.away.lineupStatus==="confirmed"?"confirmed":"predicted-not-confirmed"):"unavailable";
 const newsReady=!!(intel?.source?.url&&(intel?.home?.out||intel?.home?.doubtful||intel?.away?.out||intel?.away?.doubtful));
 const simulation=modelById.get(id);
 const modelReady=!!(simulation?.expectedGoals&&Number.isFinite(simulation.expectedGoals.home)&&Number.isFinite(simulation.expectedGoals.away));
 const draws=Number(simulation?.simulations||0);
 const retrospective=String(simulation?.status||"").startsWith("retrospective");
 const publisher=publisherById.get(id);
 const publisherCount=publisher?.picks?.length||0;
 return {id,league:g.league,home:g.home,away:g.away,
  top3:{count,archiveCount,displaySource:reviewedRow?"dated_model_and_source_audited_overlay":"immutable_archive",status:count===3?"qualified":count?"partial":"pass",reason:count===3?null:reviewedRow?.reviewStatus||g.recoveryStatus||"insufficient independently verified distinct markets",
   publisherCount,publisherStatus:publisherCount===3?"qualified":publisherCount?"partial":"pass"},
  lineup:{status:lineupStatus,sourceVerified:!!intel?.source?.publicationDateVerified},
  teamNews:{status:newsReady?"available":"unavailable",sourceVerified:!!intel?.source?.publicationDateVerified},
  playerProfiles:{status:"not-audited",reason:"Individual player last-ten logs and image rights not checked by this audit"},
  model:{status:modelReady?(retrospective?"retrospective-10000-draws":"pre-kickoff-10000-draws"):"missing-expected-goals",
   verified10000Draws:modelReady&&draws===10000,externalAnalystBlendVerified:!!simulation?.externalOpinion,
   retrospective},
  editorialDesk:{status:review?.reviewed?"reviewed":"pass"}};
});
const perLeagueSGP=leagueIds.map(league=>{
 const row=(desk?.sgpsByLeague||[]).find(x=>x.league===league&&x.status==="qualified"&&x.legs?.length>=3);
 return {league,status:row?"qualified":"hold",legs:row?.legs?.length||0,
  reason:row?null:"No verified compatible 3+ leg editorial SGP with exact market support"};
});
const displayQualified=perFixture.filter(x=>x.top3.count===3);
const displayMissed=perFixture.filter(x=>x.top3.count!==3);
const obj={
 schema:"footyedge-original-refresh-audit-v2",date,generatedAt:new Date().toISOString(),
 perFixture,perLeagueSGP,
 auditedPublishedBoard:board.immutable===true||board.state==="published",
 noUiChanges:true,top5Entries:Math.min(5,perFixture.filter(x=>x.top3.count>0).length),archivedTop5Entries:(board.top5||[]).length,
 fixtureTotal:all.length,leaguesOnSlate:leagueIds,
 cupCoverage:{sourceVerified:scheduledCups.length,absentFromBoard:absentCupFixtures.map(f=>({league:f.league,home:f.home,away:f.away}))},
 picks:{threePerMatch:displayQualified.length,unqualified:displayMissed.map(x=>({id:x.id,league:x.league,reason:x.top3.reason||"insufficient verified research"})),
  incompleteCount:displayMissed.length,archivedThreePerMatch:qualified.length},
 research:{available:research?.date===date,verifiedFixtureIds:idRows(research).size,h2hFixtures:idRows(h2h).size,
  lineupCoverage:predicted.length,newsFixtures:idRows(news).size,
  v4ModeledFixtures:modelById.size,v4Verified10000Draws:[...modelById.values()].filter(x=>x.simulations===10000).length,
  externalAnalystForecasts:[...modelById.values()].filter(x=>x.externalOpinion).length,
  retrospectiveModelFixtures:[...modelById.values()].filter(x=>String(x.status||"").startsWith("retrospective")).length,
  reviewedTop3QualifiedThree:reviewed?.totals?.three||0,
  sourceLedQualifiedThree:sourceLed?.totals?.three||0,sourceLedPartial:(sourceLed?.totals?.two||0)+(sourceLed?.totals?.one||0)},
 slips:{editorialAvailable:desk?.date===date,reviewedMatches:(desk?.matches||[]).length,
  qualifiedLeagues:slipLeagues,leaguesWithoutQualifiedSGP:leagueIds.filter(x=>!slipLeagues.includes(x)),
  globalSgpStatus:pricedSlips?.sgp?.status||desk?.sgp?.status||"unavailable",
  crossGameStatus:pricedSlips?.acca?.status||desk?.acca?.status||"unavailable",
  executableOntarioQuotesVerified:!!pricedSlips?.acca?.legs?.length&&pricedSlips.acca.legs.every(x=>x.verifiedPrice===true&&Number.isFinite(Number(x.odds)))},
 warnings:[
  ...(!research||research.date!==date?["Dated research file missing"]:[]),
  ...(absentCupFixtures.length?["Verified scheduled cup fixtures absent from board: "+absentCupFixtures.length]:[]),
  ...((news?.fixtures||[]).length===0?["No dated team intelligence file with verified lineup/news rows"]:[]),
  ...(all.some(g=>!Array.isArray(g.h2h)||!g.h2h.length)?["One or more board fixtures lack attached H2H; do not represent missing as zero meetings"]:[]),
  ...(displayMissed.length?["Not all games have 3 distinct model-and-history-supported picks"]:[]),
  ...(slipLeagues.length<leagueIds.length?["Not every league has a sourced compatible 3+ leg SGP"]:[]),
  ...(predicted.length<all.length?["Predicted starting XIs are incomplete or unverified"]:[]),
  ...(modelById.size<all.length?["One or more fixtures lack a V4 10000-draw projection"]:[]),
  ...(pricedSlips?.acca?.status==="hold"?["Cross-game research slip HOLD: no verified executable bet365 Ontario prices"]:[]),
  ...((board.top5||[]).length===0&&all.length?["No qualifying global Top 5 published"]:[])
 ]
};
const dest=path.join(root,"data","refresh-health",date+".json");
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,JSON.stringify(obj,null,2)+"\n");
console.log(JSON.stringify({date,fixtures:obj.fixtureTotal,top3:obj.picks.threePerMatch,
  leagueSGPs:obj.slips.qualifiedLeagues.length,news:obj.research.newsFixtures,
  predictedLineups:obj.research.lineupCoverage,warnings:obj.warnings},null,2));
