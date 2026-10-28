#!/usr/bin/env node
/**
 * Original: source-verified multi-publisher Top 3 compiler.
 * Source observations are authored in the dated evidence ledger. A bookmaker
 * quote or calculated hit rate never substitutes for a published prediction.
 * Source names/URLs are retained in provenance, not user-visible reasoning.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {canonicalFixtureKey} from "./owner-fixture-identity.mjs";
import {validateBoard} from "./validate-published-boards.mjs";

const date=process.env.OWNER_OVERRIDE_DATE;
const today=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"})
  .formatToParts(new Date()).map(x=>[x.type,x.value]));
if(date!=="2026-10-28"||date!==today.year+"-"+today.month+"-"+today.day)throw Error("Date-scoped owner authorization required");
const read=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const [ledger,research,draft,simDoc]=await Promise.all([
 read("data/editorial-source-tips/"+date+".json"),read("data/research-base-"+date+".json"),
 read("data/board-drafts/"+date+".json"),
 read("data/experimental-simulations/"+date+".json")
]);
if(ledger.schema!=="footyedge-verified-editorial-market-review-v1"||
 ledger.date!==date||draft.date!==date||research.date!==date||simDoc.date!==date||
 !Array.isArray(ledger.fixtures)||ledger.fixtures.length<10)throw Error("Dated source inputs invalid");
const recordByMatch=new Map();
for(const row of ledger.fixtures){
 const k=canonicalFixtureKey({...row,date});
 if(recordByMatch.has(k))throw Error("Duplicate editorial match: "+k);
 const pubs=new Set();
 for(const s of row.sources||[]){
  const u=new URL(s.url);
  if(u.protocol!=="https:"||!s.provider||pubs.has(s.provider)||
   !(s.publishedOn&&s.publishedOn<=date||s.observedOn===date))throw Error("Invalid source provenance: "+k);
  pubs.add(s.provider);
 }
 if(pubs.size<2)throw Error("At least two independent editorial sources required for "+k);
 recordByMatch.set(k,row);
}
const keyed=arr=>new Map((arr||[]).map(g=>[String(g.fixtureId||g.id),g]));
const researchById=keyed(research.fixtures),simulationById=keyed(simDoc.fixtures);
const definitions={
 btts_yes:g=>({label:"BTTS Yes",category:"BTTS",family:"btts"}),
 btts_no:g=>({label:"BTTS No",category:"BTTS",family:"btts"}),
 over_2_5:g=>({label:"Over 2.5 Goals",category:"Goals",family:"total"}),
 under_2_5:g=>({label:"Under 2.5 Goals",category:"Goals",family:"total"}),
 under_3_5:g=>({label:"Under 3.5 Goals",category:"Goals",family:"total"}),
 home_ml:g=>({label:g.home+" ML",category:"Match Result",family:"result"}),
 away_ml:g=>({label:g.away+" ML",category:"Match Result",family:"result"}),
 home_dc:g=>({label:g.home+" or Draw",category:"Double Chance",family:"result"}),
 away_dc:g=>({label:g.away+" or Draw",category:"Double Chance",family:"result"}),
 home_ht_ml:g=>({label:g.home+" ML at Half-Time",category:"Half-Time Result",family:"halftime"}),
 home_or_draw_ht:g=>({label:g.home+" or Draw at Half-Time",category:"Half-Time Double Chance",family:"halftime"}),
 halftime_draw:g=>({label:"Half-Time Draw",category:"Half-Time Result",family:"halftime"}),
 home_team_over_1_5:g=>({label:g.home+" 2+ Goals",category:"Team Goals",family:"teamtotal"}),
 away_team_over_1_5:g=>({label:g.away+" 2+ Goals",category:"Team Goals",family:"teamtotal"})
};
const scoreSupports=(m,value)=>{
 const nums=String(value||"").match(/^(\d+)-(\d+)$/);
 if(!nums)return false;
 const h=Number(nums[1]),a=Number(nums[2]);
 switch(m){
 case "btts_yes":return h>0&&a>0;
 case "btts_no":return h===0||a===0;
 case "over_2_5":return h+a>2;
 case "under_2_5":return h+a<3;
 case "under_3_5":return h+a<4;
 case "home_ml":return h>a;
 case "away_ml":return a>h;
 case "home_dc":return h>=a;
 case "away_dc":return a>=h;
 case "home_team_over_1_5":return h>=2;
 case "away_team_over_1_5":return a>=2;
 default:return false;
 }
};
const explicitSupport=(m,tips=[])=>tips.includes(m)||
 (m==="home_ml"&&tips.includes("home_win_and_btts_yes"))||
 (m==="btts_yes"&&tips.includes("home_win_and_btts_yes"))||
 (m==="btts_no"&&tips.includes("away_dc_and_btts_no"))||
 (m==="away_dc"&&tips.includes("away_dc_and_btts_no"))||
 (m==="home_dc"&&tips.includes("home_ml"))||
 (m==="away_dc"&&tips.includes("away_ml"));
const supportFor=(m,src)=>{
 if(explicitSupport(m,src.explicitMarkets))return "explicit-published-tip";
 if(scoreSupports(m,src.predictedScore))return "published-score-implies-market";
 return null;
};
const simRate=(m,s)=>{
 if(!s)return null;
 const w=s.winDrawLossPct||{},q=s.marketsPct||{},e=s.expectedGoals||{};
 const clamp=v=>Number.isFinite(v)?Math.min(100,Math.max(0,v)):null;
 switch(m){
 case "home_ml":return clamp(w.homeWin);
 case "away_ml":return clamp(w.awayWin);
 case "home_dc":return clamp(w.homeWin+w.draw);
 case "away_dc":return clamp(w.awayWin+w.draw);
 case "btts_yes":return clamp(q.bttsYes);
 case "btts_no":return clamp(100-q.bttsYes);
 case "over_2_5":return clamp(q.over2_5);
 case "under_2_5":return clamp(100-q.over2_5);
 case "under_3_5":return clamp(q.under3_5);
 case "home_team_over_1_5":return clamp(Number.isFinite(e.home)?100*(1-Math.exp(-e.home)*(1+e.home)):null);
 case "away_team_over_1_5":return clamp(Number.isFinite(e.away)?100*(1-Math.exp(-e.away)*(1+e.away)):null);
 default:return null;
 }
};
const chosenGames=new Set();let replaced=0,outrightML=0,reviewedPicks=0,disagreements=0;
for(const g of draft.games){
 const row=recordByMatch.get(canonicalFixtureKey(g));
 if(!row)continue;
 const r=researchById.get(String(g.id)),sim=simulationById.get(String(g.id));
 if(!r||!sim||r.last10?.home?.length<5||r.last10?.away?.length<5)throw Error("Source ledger cannot override unresearched match "+g.home+" - "+g.away);
 const picks=[];
 for(const [i,tip] of row.picks.entries()){
  const make=definitions[tip.market];
  if(!make)throw Error("Unrecognized dated source market "+tip.market);
  const supporters=row.sources.filter(s=>supportFor(tip.market,s));
  if(!supporters.length)throw Error("Market not actually supported by named source: "+g.home+" "+tip.market);
  const provenance=supporters.map(s=>({provider:s.provider,url:s.url,publishedOn:s.publishedOn||null,observedOn:s.observedOn||null,kind:supportFor(tip.market,s)}));
  const historyN=Math.min(r.last10.home.length,r.last10.away.length);
  const grade=Number(tip.researchGrade);
  if(!Number.isInteger(grade)||grade<58||grade>94||String(tip.reason).length<60)throw Error("Invalid research strength "+tip.market);
  const modeled=simRate(tip.market,sim);
  const modelDisagrees=modeled!=null&&modeled<50;
  const conflict=String(tip.caveat||"").trim();
  if(modelDisagrees||conflict)disagreements++;
  const reason=tip.reason+
    (conflict?" Important limitation: "+conflict:"")+
    (modelDisagrees&&!/model|forecast|simulation/i.test(tip.reason+" "+conflict)?
      " The independent match simulation is less favorable to this outcome.":"");
  const meta=make(g);
  picks.push({...meta,rank:i+1,reason,
    confidenceRating:grade,researchStrength:grade,
    confidenceRatingMethod:"Source-reviewed research strength, NOT a calibrated chance of winning; multiple published match predictions plus independently verified match history.",
    confidenceType:"editorial_consensus_research_grade",probabilityCalibrated:false,
    sourceBackedReason:true,researchOnly:true,odds:null,provider:null,bookKey:null,
    bookExact:false,verifiedPrice:false,priceEligible:false,displayOdds:null,
    score:null,modelScore:null,baseScore:null,modelProb:null,marketProb:null,ev:null,
    homeSample:r.last10.home.length,awaySample:r.last10.away.length,
    sourceProvenance:provenance,editorialSourceSupport:provenance.length,
    sourceOpinionCount:row.sources.length,
    sourceEvidenceStatus:conflict?"editorial-disagreement-disclosed":provenance.length>=2?"independent-agreement":"limited-publisher-market-support",
    modelEvidence:{modeledFrequencyPct:modeled,uncalibrated:true,disagrees:modelDisagrees},
    marketEvidence:{verified:true,sourceReviewed:true,explicitPublisherTip:provenance.some(x=>x.kind==="explicit-published-tip"),
      verifiedHistoryGamesEach:historyN,sourceProvidersChecked:row.sources.length}
  });
 }
 if(picks.length!==3||picks[0].confidenceRating<picks[1].confidenceRating||picks[1].confidenceRating<picks[2].confidenceRating)
   throw Error("Source-ranked Top 3 must have three ordered valid picks: "+g.home);
 // No market names or source urls are included in the publicly displayed rationale.
 g.top3=picks;g.top=picks[0];g.model={...g.model,top:picks[0],top3:picks,
   candidates:picks,rankedCandidates:picks,researchCandidates:picks};
 g.recoveryStatus="multi-publisher-source-reviewed-top3";
 g.editorialConsensus={sourceCount:row.sources.length,
   supportivePublishedPredictions:picks.map(p=>({market:p.label,sources:p.editorialSourceSupport,
     explicitTips:p.sourceProvenance.filter(x=>x.kind==="explicit-published-tip").length,
     caution:p.sourceEvidenceStatus!=="independent-agreement"})),
   namesAndUrlsForResearchOnly:true};
 replaced++;outrightML+=picks.filter(p=>p.category==="Match Result").length;reviewedPicks+=picks.length;
 chosenGames.add(canonicalFixtureKey(g));
}
if(replaced<11||!chosenGames.has(canonicalFixtureKey({league:"eng.league_cup",home:"Manchester City",away:"Brighton & Hove Albion",date})))throw Error("Source consensus coverage inadequate");
for(const row of ledger.fixtures){const k=canonicalFixtureKey({...row,date});if(!chosenGames.has(k))throw Error("Researched source match did not join into board: "+row.home+" - "+row.away)}
const city=draft.games.find(x=>x.league==="eng.league_cup"&&x.home==="Manchester City");
if(city?.top3?.[0]?.label!=="BTTS Yes"||!city.top3.some(x=>x.label==="Manchester City ML"))throw Error("Manchester City required research review not applied");
const byId=new Map(draft.games.map(x=>[String(x.id),x]));
const rankRefs=games=>games.filter(g=>g.top&&Number.isFinite(g.top.confidenceRating))
 .sort((a,b)=>{
  // Publicly researched match consensus beats unsupported default high-floor
  // thresholds, particularly repeated Under 4.5 goal suggestions.
  const score=g=>Number(g.top.confidenceRating)+
    (g.recoveryStatus==="multi-publisher-source-reviewed-top3"?12:0)+
    Math.min(3,Math.max(0,Number(g.top.editorialSourceSupport||0))*0.5);
  return score(b)-score(a)||String(a.date).localeCompare(String(b.date));
 })
 .slice(0,5).map((g,i)=>({rank:i+1,gameId:g.id,home:g.home,away:g.away,pick:g.top}));
draft.top5=rankRefs(draft.games);
draft.leagueTop5=Object.fromEntries([...new Set(draft.games.map(g=>g.league))]
 .map(league=>[league,rankRefs(draft.games.filter(g=>g.league===league))]));
// Dated owner publication (state changed only at final publication).
const candidate={...draft,immutable:false,state:"published"};
validateBoard(candidate,{requireFull:true});
await fs.writeFile(path.join("data","board-drafts",date+".json"),JSON.stringify(draft,null,2)+"\n");
console.log("SOURCE_CONSENSUS_TOP3",JSON.stringify({
 date,matchedFixtures:replaced,picksReviewed:reviewedPicks,outrightMLIncluded:outrightML,
 cityTop3:city.top3.map(x=>({label:x.label,researchGrade:x.confidenceRating,publisherSupport:x.editorialSourceSupport})),
 disagreementOrModelDivergence:disagreements,globalTop5:draft.top5.map(x=>x.pick.label),
 sourceSitesCredited:[...new Set(ledger.fixtures.flatMap(f=>f.sources.map(x=>x.provider)))]
}));
