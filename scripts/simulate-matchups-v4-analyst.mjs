#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {summarizeEventLedger} from "./event-ledger-projections.mjs";
import {simulateMinuteMatch} from "./minute-state-engine.mjs";
export function generateAnalystV4({baseline,external,asof,draws=10000}){
 if(!baseline||!external||baseline.date!==external.date||!Array.isArray(baseline.fixtures)||!Number.isInteger(draws)||draws!==10000)throw Error("Invalid dated input or draw requirement");
 const eBy=new Map(external.fixtures.map(f=>[String(f.fixtureId),f]));
 const digits=x=>Math.round(x*100)/100;
 const seeded=(s)=>{let n=2166136261>>>0;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;return n||1};
 const fixtures=baseline.fixtures.map(base=>{
  const externalFixture=eBy.get(String(base.fixtureId));
  if(externalFixture&&(base.home!==externalFixture.home||base.away!==externalFixture.away||Date.parse(externalFixture.publishedOn+"T23:59:59Z")>=Date.parse(base.kickoff)))throw Error("Unverified/mismatched pre-match external forecast "+base.fixtureId);
  const lamH=Math.max(.05,Math.min(5,Number(base.expectedGoals?.home))),lamA=Math.max(.05,Math.min(5,Number(base.expectedGoals?.away)));
  if(!Number.isFinite(lamH)||!Number.isFinite(lamA))throw Error("Expected-goal rates missing");
  const source=externalFixture;
  const vals=source?[source.homeWin,source.draw,source.awayWin]:null;
  if(vals&&(!vals.every(x=>Number.isFinite(x)&&x>0&&x<100)||Math.abs(vals.reduce((a,b)=>a+b,0)-100)>0.35))throw Error("Invalid external outcome distribution");
  const fractions=vals?vals.map(v=>v/vals.reduce((a,b)=>a+b,0)):null;
  const seed=seeded(baseline.date+"|"+base.fixtureId+"|opta-analyst-hybrid-v4");
  let state=seed;
  const rand=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296};
  const pH=[Math.exp(-lamH)],pA=[Math.exp(-lamA)];
  for(let k=1;k<=12;k++){pH[k]=pH[k-1]*lamH/k;pA[k]=pA[k-1]*lamA/k}
  const categories=[[],[],[]];
  for(let h=0;h<=12;h++)for(let a=0;a<=12;a++){
   const cat=h>a?0:h===a?1:2;
   categories[cat].push({h,a,p:pH[h]*pA[a]});
  }
  const pools=categories.map(entries=>{
    const sum=entries.reduce((n,x)=>n+x.p,0);
    let cum=0;
    return entries.map(x=>({h:x.h,a:x.a,cdf:(cum+=x.p/sum)}));
  });
  const sums=pools.map(x=>x.at(-1)?.cdf||0);
  if(sums.some(x=>Math.abs(x-1)>0.0001))throw Error("No distribution support");
  const drawFrom=arr=>{
    const u=rand();let lo=0,hi=arr.length-1;
    while(lo<hi){const mid=(lo+hi)>>1;if(u<arr[mid].cdf)hi=mid;else lo=mid+1}
    return arr[lo];
  };
  const full=[];
  let acc=0;
  for(const [i,p] of pH.entries())for(const [j,q] of pA.entries())full.push({h:i,a:j,cdf:(acc+=p*q)});
  for(const x of full)x.cdf/=acc;
  const alpha=source?Math.max(0,Math.min(.35,Number(external.forecastInputPolicy.blendWithFootyEdgeBaseline))):0;
  let wins=[0,0,0],gf=[0,0],btts=0,over15=0,over25=0,under35=0,over35=0,scoreCounts=new Map();
  const matchLedger=[];
  // Only switch to the minute engine when both teams have independently verified event profiles.
  const profiles=base.verifiedMinuteProfiles;
  const useMinuteEngine=!!(profiles?.home?.verified&&profiles?.away?.verified&&!source);
  for(let i=0;i<draws;i++){
   let pair;
   if(useMinuteEngine){
     const simulated=simulateMinuteMatch({home:{...profiles.home,goalRate:lamH},away:{...profiles.away,goalRate:lamA},rand});
     pair={h:simulated.homeGoals,a:simulated.awayGoals};
   }else if(source&&rand()<alpha){
     const u=rand();const cat=u<fractions[0]?0:u<fractions[0]+fractions[1]?1:2;
     pair=drawFrom(pools[cat]);
   }else pair=drawFrom(full);
   const h=pair.h,a=pair.a,t=h+a;
   matchLedger.push({homeGoals:h,awayGoals:a});
   gf[0]+=h;gf[1]+=a;
   wins[h>a?0:h===a?1:2]++;
   if(h&&a)btts++;if(t>=2)over15++;if(t>=3)over25++;if(t<=3)under35++;if(t>=4)over35++;
   const score=h+"-"+a;scoreCounts.set(score,(scoreCounts.get(score)||0)+1);
  }
  if(wins.reduce((a,b)=>a+b,0)!==draws)throw Error("Draw mismatch");
  const coherent=summarizeEventLedger(matchLedger,{seed,coverage:{externalForecastVerified:!!source,playerHeatmapsVerified:useMinuteEngine&&!!(profiles.home.heatmapVerified&&profiles.away.heatmapVerified),minuteByMinuteEventsSimulated:useMinuteEngine}});
  const pct=n=>digits(n*100/draws);
  const likely=[...scoreCounts.entries()].sort((x,y)=>y[1]-x[1]||x[0].localeCompare(y[0])).slice(0,5).map(([score,n])=>({score,probabilityPct:pct(n)}));
  const modelWDL={homeWin:pct(wins[0]),draw:pct(wins[1]),awayWin:pct(wins[2])};
  const eh=digits(gf[0]/draws),ea=digits(gf[1]/draws);
  const newBase={...base,coherentProjection:coherent,minuteEngineUsed:useMinuteEngine,modelVersion:"opponent-conditioned-analyst-hybrid-v4",simulations:draws,
   status:Date.parse(base.kickoff)<=Date.parse(asof)?"retrospective_rerun_not_valid_live_prematch":"pre_kickoff_experimental",
   expectedGoals:{home:eh,away:ea},
   winDrawLossPct:modelWDL,predictedScore:likely[0].score,
   predictedScoreProbabilityPct:likely[0].probabilityPct,mostLikelyScores:likely,
   marketsPct:{...base.marketsPct,over1_5:pct(over15),over2_5:pct(over25),under3_5:pct(under35),bttsYes:pct(btts)},
   teamProjections:{...base.teamProjections,home:{...base.teamProjections?.home,goals:eh},away:{...base.teamProjections?.away,goals:ea}},
   statTotals:{...base.statTotals,goals:{status:"modeled_from_verified_inputs",projection:digits((gf[0]+gf[1])/draws),
     lines:[{line:1.5,overPct:pct(over15)},{line:2.5,overPct:pct(over25)},{line:3.5,overPct:pct(over35)}],
     source:source?"FootyEdge V3 strength and Opta editorial outcome-mixture research":"FootyEdge V3 opponent-conditioned goal model"}},
   externalOpinion:source?{sourceId:"the_analyst",sourceUrl:source.article,forecastPublishedOn:source.publishedOn,
     reportedWDL:{homeWin:source.homeWin,draw:source.draw,awayWin:source.awayWin},
     modelBefore:{...base.winDrawLossPct},blendFraction:alpha,
     notes:source.qualitative,measuredContext:source.teamStats,
     caution:source.predictionCaveat||"Opta forecast is independent; published percentages do not determine an executable bookmaker price."}:null,
   usedFactors:source?[...new Set([...(base.usedFactors||[]),"independent_published_opta_outcome_anchor_capped_25pct"])]:base.usedFactors,
   warning:"Research-only 10k seeded rerun. External outcome predictions are a 25% experimental mixture, not verified xG features or calibrated outcome probabilities. Never use as independent statistical confirmation of the same forecast.",
   dataQuality:{...base.dataQuality,externalMatchForecastVerified:!!source,externalLineupNumericalAdjustment:false},
  };
  return newBase;
 });
 const covered=fixtures.filter(x=>!!x.externalOpinion).length;
 return {schema:"footyedge-experimental-monte-carlo-v1",modelVersion:"opponent-conditioned-analyst-hybrid-v4",date:baseline.date,generatedAt:asof,mode:"shadow_only",usedForOfficialPicks:false,simulationsPerFixture:draws,totalSimulations:draws*fixtures.length,
  sourceDates:{...baseline.sourceDates,externalAnalyst:external.capturedAt,v3Baseline:baseline.generatedAt},
  methodology:{...baseline.methodology,externalForecast:"Only pre-match date-verified outcome percentages from specific public Opta Analyst articles. For each affected match, 25% of simulations draw an outcome according to the external distribution and sample a score conditionally from the original V3 Poisson score distribution; the other 75% remain independent V3 score draws. Does not imply statistical independence of forecasts.",independentEventData:"V3 non-goal event forecasts preserved, no invented pass/foul/card/shots statistics",outcomeCoherence:"All WDL and goal-total frequencies recomputed from the same 10,000 score draws."},
  coverage:{...baseline.coverage,fixtures:fixtures.length,withExternalAnalystForecast:covered,withoutExternalForecast:fixtures.length-covered,retrospectiveAtRun:fixtures.filter(x=>x.status!=="pre_kickoff_experimental").length},
  limitations:[String(covered)+" date-verified published external fixture forecasts; "+String(fixtures.length-covered)+" other fixtures use V3-only outcome distributions.","Heuristic 25% blend has not been backtested or statistically calibrated.","Some source views show small internal forecast rounding or update discrepancies; fixture-specific article numbers are used.","Analyst reported team stats are recorded as provenance and qualitative diagnostics, not fabricated match-log xG or lineup effect.","Generated after kickoff for some fixtures; retrospective snapshots are not fair real-time previews."],
  fixtures};
}
async function main(){
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 const day=process.env.SIMULATION_DATE||parts.year+"-"+parts.month+"-"+parts.day;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error("Bad local date");
 const read=async p=>{try{return JSON.parse(await fs.readFile(p,"utf8"))}catch(e){if(e.code==="ENOENT")return null;throw e}};
 const baseline=await read(path.join("data","experimental-simulations",day+"-v3.json"));
 if(!baseline||baseline.date!==day)throw Error("A dated V3 forecast is required");
 const input=await read(path.join("data","external-model-research",day+"-the-analyst.json"))||
 {date:day,capturedAt:null,forecastInputPolicy:{blendWithFootyEdgeBaseline:0.25},fixtures:[]};
 const dest=path.join("data","experimental-simulations",day+"-v4.json");
 if(process.env.OWNER_OVERRIDE_DATE!==day){try{await fs.access(dest);console.log("Previously published V4 retained (no rerun overwrites)");return}catch(e){if(e.code!=="ENOENT")throw e}}
 const output=generateAnalystV4({baseline,external:input,asof:new Date().toISOString(),draws:10000});
 if(output.totalSimulations!==10000*baseline.fixtures.length)throw Error("Simulation count mismatch");
 await fs.mkdir(path.dirname(dest),{recursive:true});
 await fs.writeFile(dest,JSON.stringify(output,null,2)+"\n");
 console.log(JSON.stringify({date:day,coverage:output.coverage,totalSimulations:output.totalSimulations}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e);process.exitCode=1});
