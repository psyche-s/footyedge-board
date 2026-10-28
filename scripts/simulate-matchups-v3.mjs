#!/usr/bin/env node
// FootyEdge v3: enhanced, evidence-gated opponent-conditioned 10k match simulation.
// Shadow only. Does not replace official picks; optional inputs are NEVER imputed as facts.
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {runForecast} from "./simulate-fixtures.mjs";

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const value=x=>x!==null&&x!==undefined&&x!==""&&Number.isFinite(Number(x))?Number(x):null;
const safeRate=(v,p)=>v!==null&&p>0?v/p:null;
const resultValid=m=>m&&Number.isInteger(m.gf)&&Number.isInteger(m.ga)&&m.gf>=0&&m.ga>=0&&m.gf<20&&m.ga<20;
const thresholds={
 goals:[1.5,2.5,3.5],corners:[8.5,9.5,10.5],shots:[22.5,24.5,26.5],
 shotsOnTarget:[7.5,8.5,9.5],yellowCards:[2.5,3.5,4.5],
 fouls:[19.5,21.5,23.5],tackles:[20.5,22.5,24.5],
 passes:[699.5,799.5,899.5]
};
const pct=n=>Math.round(n*10000)/100;

function seasonedTeam(table,id){
 const x=table?.find(t=>String(t.id)===String(id));
 if(!x||value(x.played)===null||x.played<5||value(x.points)===null)return null;
 return {id:String(id),ppg:x.points/x.played,
  gf:safeRate(value(x.gf),x.played),ga:safeRate(value(x.ga),x.played),sample:x.played};
}
function analogScore(rows,target,table,kickoff){
 if(!target)return null;
 const matches=(rows||[]).filter(x=>resultValid(x)&&Date.parse(x.date)<kickoff)
  .slice(0,10).map((m,i)=>{
    const opp=seasonedTeam(table,m.oppId);
    if(!opp)return null;
    const dist=Math.abs(opp.ppg-target.ppg)+
       (opp.ga!==null&&target.ga!==null?0.25*Math.abs(opp.ga-target.ga):0);
    return {...m,dist,weight:Math.exp(-dist/0.48)*Math.exp(-i/8)};
  }).filter(Boolean).filter(x=>x.dist<=0.80);
 const n=matches.length;
 if(n<2)return null;
 const total=matches.reduce((o,m)=>{o.w+=m.weight;o.for+=m.gf*m.weight;o.against+=m.ga*m.weight;return o},{w:0,for:0,against:0});
 if(total.w<0.55)return null;
 return {sample:n,goalsFor:total.for/total.w,goalsAgainst:total.against/total.w,
  matches:matches.map(x=>x.id),method:"recent league-opponents matched by verified PPG and defensive output"};
}
function opponentAdjusted(rows,table,kickoff,baseRate){
 const obs=(rows||[]).filter(x=>resultValid(x)&&Date.parse(x.date)<kickoff).slice(0,10);
 let n=0,weighted=0,acc=0;
 for(let i=0;i<obs.length;i++){
   const opp=seasonedTeam(table,obs[i].oppId);
   if(!opp||opp.ga===null)continue;
   // Relative opponent defensive strength, shrunk to the league-level baseline.
   const opposingDefense=(opp.ga*opp.sample+baseRate*8)/(opp.sample+8);
   const w=Math.exp(-i/7);
   acc+=w*clamp(obs[i].gf/(0.45+opposingDefense),0,4);weighted+=w;n++;
 }
 if(n<3||weighted===0)return null;
 return {sample:n,attackIndex:acc/weighted}; // Relative; NOT an xG measurement.
}
function fieldStats(stat,sampleName){
 if(!stat||value(stat.sample)===null||stat.sample<5)return null;
 const out={sample:stat.sample,source:stat.source||null};
 for(const [k,field] of [["shots","shotsAvg"],["shotsOnTarget","shotsOnTargetAvg"],
      ["corners","cornersAvg"],["fouls","foulsAvg"],["yellowCards","yellowCardsAvg"],
      ["tackles","tacklesAvg"],["passes","passesAvg"],
      ["shotsAllowed","shotsAllowedAvg"],["shotsOnTargetAllowed","shotsOnTargetAllowedAvg"],
      ["foulsWon","foulsWonAvg"]]){
   const v=value(stat[field]);
   if(v!==null&&v>=0&&v<3000)out[k]=v;
 }
 return out;
}
function profileFromVerified(mm,styleRow,side){
 let base=mm?.verifiedJoin?fieldStats(mm?.[side+"Stats"]):null;
 const verified=styleRow?.verifiedJoin&&Array.isArray(styleRow?.sources)&&
  styleRow.sources.every(x=>typeof x==="string"&&x.length);
 const supplements=verified?fieldStats(styleRow?.[side+"Stats"]):null;
 if(supplements)base={...(base||{}),...supplements};
 return base;
}
function formulateTeamProjections(home,away){
 const output={home:{},away:{}},availability={};
 for(const key of Object.keys(thresholds)){
   if(key==="goals")continue;
   const h=value(home?.[key]),a=value(away?.[key]);
   const hAllowed=value(away?.[key+"Allowed"]),aAllowed=value(home?.[key+"Allowed"]);
   // A missing metric on either side stays unavailable (not an inferred zero).
   if(h===null||a===null){availability[key]="no_both_side_verified_samples";continue}
   const s=key==="shots"||key==="shotsOnTarget";
   output.home[key]=Math.round((hAllowed!==null?0.65*h+0.35*hAllowed:h)*100)/100;
   output.away[key]=Math.round((aAllowed!==null?0.65*a+0.35*aAllowed:a)*100)/100;
   availability[key]=s&&(hAllowed===null||aAllowed===null)?
     "observed_own_volume_only_opponent_allowance_missing":"verified_sample_available";
 }
 return {output,availability};
}
function sourcedPlayerFouls(f,teamNews,kickoff){
 const candidates=Array.isArray(f.playerPropResearch)?f.playerPropResearch:[];
 const normal=n=>String(n||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
     .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
 const sides=["home","away"],out=[];
 for(const side of sides){
   const xi=teamNews?.[side]?.confirmedXI?.length===11?teamNews[side].confirmedXI:
     teamNews?.[side]?.predictedXI?.length===11?teamNews[side].predictedXI:[];
   const starters=xi.map(x=>normal(typeof x==="string"?x:x?.name)).filter(Boolean);
   if(!starters.length)continue;
   for(const item of candidates){
     if(String(item?.teamSide)!==side||!item?.sourceUrl||!/^https:\/\//.test(item.sourceUrl)||
       !Array.isArray(item.lastFive))continue;
     const asked=normal(item.name),matched=starters.filter(n=>n===asked||
        (asked.length>=4&&n.endsWith(" "+asked))||(n.length>=4&&asked.endsWith(" "+n)));
     if(matched.length!==1)continue;
     const games=item.lastFive.filter(x=>Number.isFinite(Date.parse(x.date))&&Date.parse(x.date)<kickoff&&
       x.foulsCommitted!==null&&Number.isInteger(x.foulsCommitted)&&
       x.foulsCommitted>=0&&x.foulsCommitted<=12).slice(0,5);
     const ids=new Set(games.map(x=>String(x.id||x.date+"-"+x.opponent)));
     if(games.length<5||ids.size<5)continue;
     const sum=games.reduce((v,x)=>v+x.foulsCommitted,0),mean=sum/games.length;
     const one=games.filter(x=>x.foulsCommitted>=1).length,two=games.filter(x=>x.foulsCommitted>=2).length;
     out.push({name:item.name,side,position:item.position||null,
       projected:Math.round(mean*100)/100,onePlusPct:one*20,twoPlusPct:two*20,
       sample:5,sourceValidated:true,modelBasis:"recorded pre-kickoff last five, descriptive frequencies with no calibration"});
   }
 }
 return out.sort((a,b)=>b.projected-a.projected);
}
export function buildAdvancedSimulations({research,analytics,h2h,teamNews,standings,styleEvents,
  asof,simulations=10000}){
 if(!research?.fixtures?.length||!/^20\d\d-\d\d-\d\d$/.test(research.date)||
    !Number.isInteger(simulations)||simulations!==10000)throw Error("Ten thousand draws and exact-date research required");
 const baseline=runForecast({research,analytics,h2h,teamNews,standings,asof,simulations});
 const byBase=new Map(baseline.fixtures.map(x=>[String(x.fixtureId),x]));
 const byMetrics=new Map((analytics?.date===research.date?analytics.matches:[]||[]).map(x=>[String(x.fixtureId),x]));
 const byStyle=new Map((styleEvents?.date===research.date?styleEvents.matches:[]||[]).map(x=>[String(x.fixtureId),x]));
 const byHead=new Map((h2h?.date===research.date?h2h.fixtures:[]||[]).map(x=>[String(x.fixtureId),x]));
 const byNews=new Map((teamNews?.date===research.date?teamNews.fixtures:[]||[]).map(x=>[String(x.fixtureId),x]));
 const out=[];
 for(const f of research.fixtures){
   const pre=byBase.get(String(f.id));
   if(!pre)throw Error("Missing baseline match "+f.id);
   const kick=Date.parse(f.date);
   const table=standings?.leagues?.[f.league]?.table||[];
   const rankH=seasonedTeam(table,f.home.id),rankA=seasonedTeam(table,f.away.id);
   const H=(f.last10?.home||[]).filter(m=>resultValid(m)&&Date.parse(m.date)<kick).slice(0,10);
   const A=(f.last10?.away||[]).filter(m=>resultValid(m)&&Date.parse(m.date)<kick).slice(0,10);
   const analogH=analogScore(H,rankA,table,kick),analogA=analogScore(A,rankH,table,kick);
   const adjH=opponentAdjusted(H,table,kick,1.45),adjA=opponentAdjusted(A,table,kick,1.45);
   let eh=pre.expectedGoals.home,ea=pre.expectedGoals.away;
   const adjustments=[],verified={lastTenH:H.length,lastTenA:A.length,
     comparableOpponentsHome:analogH?.sample||0,comparableOpponentsAway:analogA?.sample||0,
     opponentAdjustedHome:adjH?.sample||0,opponentAdjustedAway:adjA?.sample||0};
   // Gently correct the existing goal rates for current-season comparable defenses.
   if(adjH&&adjA){
     const diff=clamp(Math.log(clamp(adjH.attackIndex/Math.max(.2,adjA.attackIndex),.25,4)),-1,1)*.065;
     eh*=Math.exp(diff);ea*=Math.exp(-diff);
     adjustments.push("opponent_defensive_strength_normalization");}
   if(analogH&&analogA){
     const meanH=H.reduce((t,r)=>t+r.gf,0)/Math.max(1,H.length);
     const meanA=A.reduce((t,r)=>t+r.gf,0)/Math.max(1,A.length);
     const h=clamp((analogH.goalsFor-meanH)/(meanH+1),-.6,.6)*.10;
     const a=clamp((analogA.goalsFor-meanA)/(meanA+1),-.6,.6)*.10;
     eh*=Math.exp(h);ea*=Math.exp(a);
     adjustments.push("analog_opponents_verified_strength_bin");
   }
   const venue=(rows,want)=>rows.filter(m=>m.venue===want);
   const venueH=venue(H,"home"),venueA=venue(A,"away");
   if(venueH.length>=3&&venueA.length>=3){
     const avg=(rows,k)=>rows.reduce((t,r)=>t+r[k],0)/rows.length;
     const h=clamp((avg(venueH,"gf")-avg(H,"gf"))/(1+avg(H,"gf")),-.5,.5)*.09;
     const a=clamp((avg(venueA,"gf")-avg(A,"gf"))/(1+avg(A,"gf")),-.5,.5)*.09;
     eh*=Math.exp(h);ea*=Math.exp(a);
     adjustments.push("last10_actual_venue_split");
   }
   const yearH2H=(byHead.get(String(f.id))?.h2h||[]).filter(m=>
     Number.isFinite(Date.parse(m.date))&&Date.parse(m.date)<kick&&
     kick-Date.parse(m.date)<=366*86400000).slice(0,2);
   if(yearH2H.length){
     const flat=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
     const score=(m,side)=>flat(m.home)===flat(f.home.name)?
        Number(side==="home"?m.homeScore:m.awayScore):
        Number(side==="home"?m.awayScore:m.homeScore);
     const hh=yearH2H.map(m=>score(m,"home")).filter(Number.isFinite);
     const aa=yearH2H.map(m=>score(m,"away")).filter(Number.isFinite);
     if(hh.length&&aa.length){
       eh=.985*eh+.015*clamp(hh.reduce((x,y)=>x+y,0)/hh.length,.1,4);
       ea=.985*ea+.015*clamp(aa.reduce((x,y)=>x+y,0)/aa.length,.1,4);
       adjustments.push("past_12_months_h2h_small_modifier");
     }
   }
   const mm=byMetrics.get(String(f.id)),s=byStyle.get(String(f.id));
   const home=profileFromVerified(mm,s,"home"),away=profileFromVerified(mm,s,"away");
   if(home?.shotsOnTarget!=null&&away?.shotsOnTarget!=null){
     const a=clamp(Math.log((home.shotsOnTarget+.5)/(away.shotsOnTarget+.5))*.035,-.05,.05);
     eh*=Math.exp(a);ea*=Math.exp(-a);
     adjustments.push("verified_recent_shots_on_target_matchup");
   }
   if(home?.shotsAllowed!=null&&away?.shotsAllowed!=null){
     const h=clamp(Math.log((away.shotsAllowed+.5)/(home.shotsAllowed+.5))*.045,-.05,.05);
     eh*=Math.exp(h);ea*=Math.exp(-h);
     adjustments.push("opponent_verified_shots_allowed");
   }
   const formation=byNews.get(String(f.id));
   const bothXIs=formation?.home?.predictedXI?.length===11&&formation?.away?.predictedXI?.length===11;
   // Only use independently quantified player impacts with provenance; never make up
   // effect of a listed absence based on name/reputation/position alone.
   const impact=formation?.quantifiedLineupImpact;
   if(bothXIs&&impact?.sourceUrl&&impact?.sample>=5&&
     Number.isFinite(impact.homeGoalsDelta)&&Number.isFinite(impact.awayGoalsDelta)){
       eh*=Math.exp(clamp(impact.homeGoalsDelta,-.08,.08));
       ea*=Math.exp(clamp(impact.awayGoalsDelta,-.08,.08));
       adjustments.push("verified_quantified_lineup_impact");
   }
   eh=clamp(eh,.3,3.65);ea=clamp(ea,.3,3.65);
   const fs=formulateTeamProjections(home,away);
   fs.output.home.goals=Number(eh.toFixed(2));fs.output.away.goals=Number(ea.toFixed(2));
   const tally={homeWin:0,draw:0,awayWin:0,bttsYes:0,over15:0,over25:0,under35:0},scores=new Map();
   const props={};for(const key of Object.keys(thresholds))props[key]={total:0,counts:Object.fromEntries(thresholds[key].map(t=>[t,0]))};
   let seed=2166136261>>>0;
   for(const ch of (research.date+"|"+f.id+"|footyedge-v3-10000"))
     seed=Math.imul(seed^ch.charCodeAt(0),16777619)>>>0;
   if(!seed)seed=1;
   const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296};
   const poisson=m=>{if(m>=28){const z=Math.sqrt(-2*Math.log(Math.max(random(),1e-10)))*Math.cos(2*Math.PI*random());return Math.max(0,Math.round(m+Math.sqrt(m)*z));}let k=0,v=1,target=Math.exp(-clamp(m,0,27));do{k++;v*=Math.max(random(),1e-10)}while(v>target&&k<160);return k-1};
   for(let i=0;i<simulations;i++){
     const h=poisson(eh),a=poisson(ea),tot=h+a;
     if(h>a)tally.homeWin++;else if(h<a)tally.awayWin++;else tally.draw++;
     if(h&&a)tally.bttsYes++;if(tot>=2)tally.over15++;if(tot>=3)tally.over25++;if(tot<=3)tally.under35++;
     const score=h+"-"+a;scores.set(score,(scores.get(score)||0)+1);
     for(const [k,q] of Object.entries(props)){
       let total=tot;
       if(k!=="goals"){
         const x=value(fs.output.home[k]),y=value(fs.output.away[k]);
         if(x===null||y===null)continue;
         total=poisson(x)+poisson(y);
       }
       q.total+=total;
       for(const t of thresholds[k])if(total>t)q.counts[t]++;
     }
   }
   const tops=[...scores.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,3);
   const statTotals={};
   for(const [k,q] of Object.entries(props)){
     if(k!=="goals"&&(fs.output.home[k]==null||fs.output.away[k]==null)){
       statTotals[k]={status:"not_verified",projection:null,lines:null,source:null};continue;
     }
     statTotals[k]={status:"modeled_from_verified_inputs",projection:
       Number((q.total/simulations).toFixed(2)),
       lines:thresholds[k].map(t=>({line:t,overPct:pct(q.counts[t]/simulations)})),
       source:k==="goals"?"opponent-conditioned scoring simulations":
          "verified source-specific team match samples"};
   }
   const fmt=x=>Number(x.toFixed(2));
   out.push({...pre,modelVersion:"opponent-conditioned-monte-carlo-v3",
     expectedGoals:{home:fmt(eh),away:fmt(ea)},
     winDrawLossPct:{homeWin:pct(tally.homeWin/simulations),
       draw:pct(tally.draw/simulations),awayWin:pct(tally.awayWin/simulations)},
     predictedScore:tops[0]?.[0]||null,predictedScoreProbabilityPct:pct((tops[0]?.[1]||0)/simulations),
     mostLikelyScores:tops.map(([score,count])=>({score,probabilityPct:pct(count/simulations)})),
     marketsPct:{over1_5:pct(tally.over15/simulations),over2_5:pct(tally.over25/simulations),
       under3_5:pct(tally.under35/simulations),bttsYes:pct(tally.bttsYes/simulations)},
     statTotals,teamProjections:fs.output,statInputCoverage:fs.availability,
     playerProjections:{foulsCommitted:sourcedPlayerFouls(f,formation,kick)},
     factorsV3:adjustments,
     matchupContext:{recent12MonthH2H:yearH2H.length,analogHome:analogH,analogAway:analogA,
       opponentAdjustedHome:adjH,opponentAdjustedAway:adjA,
       formations:bothXIs?{home:formation.home.predictedFormation,away:formation.away.predictedFormation}:null,
       missingStrengthAndStyleInputs:[
         ...(home?.shotsAllowed!=null&&away?.shotsAllowed!=null?[]:["opponent_shots_allowed"]),
         ...(home?.tackles!=null&&away?.tackles!=null?[]:["tackles"]),
         ...(home?.passes!=null&&away?.passes!=null?[]:["passes"]),
         ...(impact?.sourceUrl?[]:["quantified_lineup_impact"])
       ]},
     dataQuality:{...pre.dataQuality,analogGamesHome:analogH?.sample||0,analogGamesAway:analogA?.sample||0,
       eligibleRecentH2H:yearH2H.length,verifiedStyleSample:!!home&&!!away,
       usedVerifiedLineupDelta:adjustments.includes("verified_quantified_lineup_impact")},
     warning:"Uncalibrated 10,000-draw research model; incomplete stats/lineups are disclosed, not guessed."});
 }
 if(out.length!==research.fixtures.length)throw Error("Missing simulation output");
 return {schema:"footyedge-experimental-monte-carlo-v1",modelVersion:"opponent-conditioned-monte-carlo-v3",
  date:research.date,generatedAt:asof,mode:"shadow_only",usedForOfficialPicks:false,
  simulationsPerFixture:simulations,totalSimulations:out.length*simulations,
  sourceDates:{research:research.generatedAt,analytics:analytics?.generatedAt,
    standings:standings?.capturedAt,h2h:h2h?.generatedAt,teamNews:teamNews?.generatedAt,
    styleEvents:styleEvents?.generatedAt||null},
  methodology:{last10:"exp-decayed recent form and opponent defensive normalization",
    comparableOpponents:"verified same-league season PPG and defensive goals allowed, min 2 meaningful comparables",
    h2h:"only prior 366 days, capped 1.5% goal mix on top of baseline",
    venue:"last 10 home/away results, min 3 each",
    lineup:"only quantitative player delta supported by dated verified sample and XI; otherwise coverage flag",
    possessions:"passes/tackles/fouls/shots allowed affect stat projection only with verified histories",
    simulation:"10,000 independent goal count draws per fixture; non-goal event totals independently modeled where data exists",
    noDoubleCounting:"factor shrinkage and small caps; goal outputs are uncalibrated; side market correlation still requires joint calibration"},
  coverage:{fixtures:out.length,withAnalogBoth:out.filter(x=>x.matchupContext.analogHome&&x.matchupContext.analogAway).length,
    withStyle:out.filter(x=>x.dataQuality.verifiedStyleSample).length,
    with12MonthH2H:out.filter(x=>x.matchupContext.recent12MonthH2H>0).length,
    withQuantifiedLineups:out.filter(x=>x.dataQuality.usedVerifiedLineupDelta).length},
  fixtures:out};
}
async function main(){
 const d=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",
  month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 const date=process.env.SIMULATION_DATE||d.year+"-"+d.month+"-"+d.day;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Bad date");
 const read=async name=>{try{return JSON.parse(await fs.readFile(path.join("data",name),"utf8"))}
   catch(e){if(e.code==="ENOENT")return null;throw e}};
 const research=await read("research-base-"+date+".json");
 if(!research||research.date!==date)throw Error("Current-date research required");
 const target=path.join("data","experimental-simulations",date+"-v3.json");
 if(process.env.OWNER_OVERRIDE_DATE!==date){try{await fs.access(target);console.log("Retained write-once v3 snapshot");return}catch(e){if(e.code!=="ENOENT")throw e}}
 const [analytics,h2h,teamNews,standings,styleEvents]=await Promise.all([
  read("analytics/"+date+".json"),read("h2h/"+date+".json"),
  read("team-intelligence/"+date+".json"),read("experimental-inputs/"+date+"-standings.json"),
  read("style-matchups/"+date+".json")
 ]);
 const result=buildAdvancedSimulations({research,analytics,h2h,teamNews,standings,styleEvents,
  asof:new Date().toISOString(),simulations:10000});
 await fs.mkdir(path.dirname(target),{recursive:true});
 await fs.writeFile(target,JSON.stringify(result,null,2)+"\n");
 console.log("Modeled",result.coverage);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
 main().catch(e=>{console.error(e);process.exitCode=1});
