#!/usr/bin/env node
// Create date-gated RESEARCH ONLY SGP and cross-game watchlists.
// Never infer bet365 Ontario odds, price, or hit probabilities from component markets.
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {ownerPickCompatible} from "./owner-top3-ranking.mjs";
const excluded=new Set(["eng.2","jpn.1","kor.1","ksa.1"]);
const unique=(a)=>[...new Set(a)];
export function buildHolds({day,source,research,existing,asof}){
  if(!source||!research||source.date!==day||research.date!==day||!Array.isArray(source.matches))throw Error("Date-matched research mandatory");
  const input=new Map(research.fixtures.map(f=>[String(f.id),f]));
  const qualified=[];
  for(const row of source.matches){
    if(excluded.has(row.league)||!Array.isArray(row.picks))continue;
    const f=input.get(String(row.gameId));
    if(!f||f.league!==row.league||f.home.name!==row.home||f.away.name!==row.away||!f.date||Date.parse(f.date)<=Date.parse(asof))continue;
    if((f.last10?.home||[]).length<8||(f.last10?.away||[]).length<8)continue;
    const scored=row.picks.filter(x=>x.sourceBackedReason===true&&x.probabilityCalibrated===false&&x.verifiedPrice===false&&
      Number.isFinite(x.confidenceRating)&&x.confidenceRating>=60&&Number(x.homeSample)>=8&&Number(x.awaySample)>=8);
    const groups=[];
    for(let i=0;i<scored.length;i++)for(let j=i+1;j<scored.length;j++){
      const a=scored[i],b=scored[j];
      if(!ownerPickCompatible(a,b))continue;
      // Over 1.5 Goals plus a team's 1+ Goal often duplicates the same scoring thesis.
      if([a,b].some(p=>p.label==="Over 1.5 Goals")&&[a,b].some(p=>/ 1\+ Goal$/.test(p.label)))continue;
      const points=(a.confidenceRating+b.confidenceRating)
        +[a,b].reduce((n,p)=>n+(/ ML$/.test(p.label)?15:0)
          +(/^Over 2.5 Goals$|^Under 3.5 Goals$/.test(p.label)?10:0)
          +(/^Under 4.5 Goals$/.test(p.label)?-15:0),0);
      groups.push({legs:[a,b],points});
    }
    groups.sort((a,b)=>b.points-a.points);
    const best=groups[0];if(!best)continue;
    const fixture=row.home+" vs "+row.away;
    const legs=best.legs.map(p=>({gameId:String(row.gameId),fixture,league:row.league,kickoff:f.date,
      label:p.label,category:p.category,family:p.family,rating:p.confidenceRating,
      why:p.reason,experimentalFrequencyPct:p.experimentalFrequencyPct,
      verifiedPrice:false,odds:null,priceStatus:"ontario_joint_price_pending",
      risk:["Combined Ontario bet-builder price and exact executable leg lines are not verified.",
        "10,000-draw model event frequencies are not calibrated hit probabilities; within-game legs can correlate."]}));
    qualified.push({league:row.league,score:best.points,fixture,gameId:String(row.gameId),
      ticket:{id:"candidate:sgp:"+row.gameId+":"+day.replaceAll("-",""),
      gameId:String(row.gameId),league:row.league,
      title:fixture+" · source-sample research watch",
      fixture,format:"Same-game research watchlist",status:"hold",researchQualified:true,trackable:false,
      why:"Both markets have pre-kickoff date-matched team histories (at least eight matches each) and exploratory model context; check current lineup, odds and availability before use.",
      legs,overallResearchRating:null,verifiedCombinedPrice:false,combinedOntarioOdds:null,
      combinedReferenceAmerican:null,jointProbability:null,modelCalibrated:false,
      caution:"HOLD / PRICE PENDING — this is not an executable Ontario SGP. Target +150 unverified."}});
  }
  const byLeague=new Map();
  for(const x of qualified.sort((a,b)=>b.score-a.score))if(!byLeague.has(x.league))byLeague.set(x.league,x);
  const sgpsByLeague=[...byLeague.values()].sort((a,b)=>a.league.localeCompare(b.league)).map(x=>x.ticket);
  // One match per cross-game leg; prefer confident result market and non-trivial totals.
  const cross=[];
  const top=qualified.flatMap(x=>x.ticket.legs.map(p=>({...p,
    crossScore:p.rating+(/ ML$/.test(p.label)?7:0)+(/ or Draw$/.test(p.label)?4:0)
      +(p.label==="Under 4.5 Goals"?-15:0)}))).sort((a,b)=>b.crossScore-a.crossScore);
  const picked=new Set(),leagues=new Set();
  for(const p of top){
    if(cross.length>=5)break;
    if(picked.has(p.gameId)||leagues.has(p.league)||p.rating<70)continue;
    cross.push(p);picked.add(p.gameId);leagues.add(p.league);
  }
  const acca={id:"candidate:acca:"+day+"-reviewed",title:"Cross-game · model research watch",
    format:"Cross-game research candidate",status:"hold",trackable:false,legs:cross,
    verifiedCombinedPrice:false,combinedOntarioOdds:null,combinedReferenceAmerican:null,
    jointProbability:null,modelCalibrated:false,overallResearchRating:null,
    caution:"HOLD / PRICE PENDING — distinct fixtures only, no verified executable Ontario price; +300 target unverified. This is not a placed or settled bet."};
  return {...existing,date:day,checkedAt:asof,state:"reviewed_research",
    sportsbookAvailability:"Exact individual and combined bet365 Ontario markets unverified",
    sportsBookAvailability:"Exact individual and combined bet365 Ontario markets unverified",
    noSportsbookOddsOnMatchCards:true,gradedResearchNotCalibrated:true,
    sgp:sgpsByLeague[0]||null,sgpsByLeague,acca,props:existing?.props||[],
    publicationStatus:"research_candidates_not_executable",
    audits:{...existing?.audits,unpricedResearchSgpWatchlists:sgpsByLeague.length,
      crossGameDistinctFixtureLegs:cross.length,pricedOntarioSgpTickets:0,
      sourceOpinionRecords:source.totals?.sourceOpinionRecords||0,
      missingXisAreNotInferred:true,excludedLeagues:[...excluded]}};
}
async function main(){
 const day=process.argv[2];
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day||""))throw Error("Pass YYYY-MM-DD");
 const read=async p=>JSON.parse(await fs.readFile(p,"utf8"));
 const [source,research,existing]=await Promise.all([
  read(path.join("data/source-led",day+".json")),
  read(path.join("data","research-base-"+day+".json")),
  read(path.join("data/slips-reviewed",day+".json"))]);
 const result=buildHolds({day,source,research,existing,asof:new Date().toISOString()});
 await fs.writeFile(path.join("data/slips-reviewed",day+".json"),JSON.stringify(result,null,2)+"\n");
 console.log(JSON.stringify({day,leagues:result.sgpsByLeague.map(x=>x.league),watchlists:result.sgpsByLeague.length,cross:result.acca.legs.length}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e);process.exitCode=1});
