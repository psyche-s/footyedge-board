#!/usr/bin/env node
// This audit never edits picks or model probabilities. It makes conflicts visible.
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

const finite = n => typeof n==="number"&&Number.isFinite(n)?n:null;
const round = n => n==null?null:Math.round(n*100)/100;

export function modelFrequency(p,s){
  if(!p||s?.status!=="pre_kickoff_experimental")return null;
  const w=s.winDrawLossPct||{},m=s.marketsPct||{};
  const name=String(p.label||"");
  const key=String(p.key||"")||
    (name===s.home+" ML"?"home_win":name===s.away+" ML"?"away_win":
    name===s.home+" or Draw"?"home_or_draw":name===s.away+" or Draw"?"away_or_draw":
    name==="Over 1.5 Goals"?"over_1_5":name==="Over 2.5 Goals"?"over_2_5":
    name==="Under 3.5 Goals"?"under_3_5":name==="BTTS Yes"?"btts_yes":
    name==="BTTS No"?"btts_no":"");
  if(key==="home_win")return finite(w.homeWin);
  if(key==="away_win")return finite(w.awayWin);
  if(key==="draw")return finite(w.draw);
  if(key==="home_or_draw")return finite(w.homeWin)!=null&&finite(w.draw)!=null?w.homeWin+w.draw:null;
  if(key==="away_or_draw")return finite(w.awayWin)!=null&&finite(w.draw)!=null?w.awayWin+w.draw:null;
  if(key==="over_1_5")return finite(m.over1_5);
  if(key==="over_2_5")return finite(m.over2_5);
  if(key==="under_3_5")return finite(m.under3_5);
  if(key==="btts_yes")return finite(m.bttsYes);
  if(key==="btts_no")return finite(m.bttsYes)!=null?100-m.bttsYes:null;
  return null;
}

export function auditPickModel({date,review,simulations}){
  if(review?.date!==date||simulations?.date!==date||
      !Array.isArray(review.matches)||!Array.isArray(simulations.fixtures))
    throw Error("Dated review and experimental simulation must agree exactly");
  const byId=new Map(simulations.fixtures.map(s=>[String(s.fixtureId),s]));
  const rows=[],alertRows=[];
  for(const match of review.matches){
    if(match.league==="eng.2")continue;
    const sim=byId.get(String(match.gameId));
    for(const pick of match.picks||[]){
      const probability=modelFrequency(pick,sim);
      const grade=finite(pick.confidenceRating);
      const flags=[];
      if(probability==null)flags.push("no_direct_matching_market_distribution");
      if(probability!=null&&grade!=null&&grade-probability>=20)
        flags.push("research_grade_exceeds_model_frequency_by_20pts");
      if(probability!=null&&grade!=null&&grade>=70&&probability<45)
        flags.push("high_grade_but_model_probability_below_45");
      const other=pick.key==="home_win"?finite(sim?.winDrawLossPct?.awayWin):
        pick.key==="away_win"?finite(sim?.winDrawLossPct?.homeWin):null;
      if(other!=null&&probability!=null&&other-probability>=15)
        flags.push("recommended_outcome_opposes_model_favorite");
      if(sim?.dataQuality?.usedVerifiedLineupDelta!==true)
        flags.push("no_quantified_verified_lineup_impact");
      const row={gameId:String(match.gameId),league:match.league,fixture:match.home+" vs "+match.away,
        label:pick.label,key:pick.key||null,rank:pick.rank||null,
        researchGrade:grade,experimentalModelFrequencyPct:round(probability),
        gradeIsCalibratedProbability:false,flags,
        modelEvidenceQuality:sim?.dataQuality?.level||"unknown"};
      rows.push(row);
      if(flags.some(f=>f==="research_grade_exceeds_model_frequency_by_20pts"||
        f==="high_grade_but_model_probability_below_45"||
        f==="recommended_outcome_opposes_model_favorite"))
        alertRows.push(row);
    }
  }
  return {
    schema:"footyedge-pick-model-coherence-v2",date,
    sourceReview:"data/consensus-reviewed/"+date+".json",
    sourceSimulation:"data/experimental-simulations/"+date+"-v4.json",
    noAutomaticRetuning:true,archiveUnchanged:true,
    interpretation:"Research confidence is a heuristic strength grade, NOT a calibrated hit probability. Alert flags call for human review and cannot be used to manipulate model predictions.",
    requiredForModelPromotion:"Chronological holdout, 50+ verified settled markets per family, Brier/log loss improvement and no material calibration regression.",
    totals:{fixtures:review.matches.filter(x=>x.league!=="eng.2").length,
      picks:rows.length,marketComparable:rows.filter(x=>x.experimentalModelFrequencyPct!=null).length,
      unsupportedMarketCount:rows.filter(x=>x.experimentalModelFrequencyPct==null).length,
      requiresReview:alertRows.length,
      withoutVerifiedLineupModelEffect:rows.filter(x=>x.flags.includes("no_quantified_verified_lineup_impact")).length},
    alerts:alertRows,allPicks:rows
  };
}

async function main(){
  const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",
    {timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"})
    .formatToParts(new Date()).map(x=>[x.type,x.value]));
  const date=process.env.BOARD_DATE||process.env.PICKS_DATE||process.argv[2]||[p.year,p.month,p.day].join("-");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Bad audit date");
  const review=JSON.parse(await fs.readFile("data/consensus-reviewed/"+date+".json","utf8"));
  const sims=JSON.parse(await fs.readFile("data/experimental-simulations/"+date+"-v4.json","utf8"));
  const report={...auditPickModel({date,review,simulations:sims}),generatedAt:new Date().toISOString()};
  const target=path.join("data","model-reviews",date+".json");
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.writeFile(target,JSON.stringify(report,null,2)+"\n");
  console.log("Model/pick coherence audit",date,JSON.stringify(report.totals));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(e=>{console.error(e);process.exitCode=1});
