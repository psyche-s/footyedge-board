#!/usr/bin/env node
// Experimental-only 10,000-draw Monte Carlo forecast. Never modifies frozen official picks.
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
export function runForecast({research,analytics,h2h,teamNews,asof,simulations=10000}){
  if(!research||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(research.date||""))||!Array.isArray(research.fixtures))throw Error("Exact-date research is required");
  if(!Number.isInteger(simulations)||simulations<1000)throw Error("Invalid simulation count");
  const minMax=(x,l,u)=>Math.max(l,Math.min(u,x));
  const validScore=(x)=>Number.isInteger(x)&&x>=0&&x<=15;
  const time=Date.parse(asof);
  if(!Number.isFinite(time))throw Error("Invalid run timestamp");
  const sameDate=(s)=>String(s||"").slice(0,10);
  const metrics=new Map((analytics?.matches||[]).map(x=>[String(x.fixtureId),x]));
  const heads=new Map((h2h?.fixtures||[]).map(x=>[String(x.fixtureId),x]));
  const news=new Map((teamNews?.fixtures||[]).map(x=>[String(x.fixtureId),x]));
  const leagueGoals=new Map();
  for(const g of research.fixtures){
    let o=leagueGoals.get(g.league);
    if(!o){o={seen:new Set(),goals:0,sides:0};leagueGoals.set(g.league,o)}
    for(const side of ["home","away"]){
      for(const m of g.last10?.[side]||[]){
        const dt=Date.parse(m.date);
        if(!Number.isFinite(dt)||dt>=Date.parse(g.date)||!validScore(m.gf)||!validScore(m.ga))continue;
        const ident=String(m.id||"")+"|"+side+"|"+m.gf+"|"+m.ga;
        if(o.seen.has(ident))continue;
        o.seen.add(ident);o.goals+=m.gf;o.sides++;
      }
    }
  }
  const leagueBaseline=league=>{const q=leagueGoals.get(league);return q&&q.sides>=30?minMax(q.goals/q.sides,1.05,1.9):1.4};
  function summarize(rows,kickoff){
    const out=(rows||[]).filter(x=>Number.isFinite(Date.parse(x.date))&&Date.parse(x.date)<kickoff&&validScore(x.gf)&&validScore(x.ga)).slice(0,10);
    let sumF=0,sumA=0,weight=0,venueHome=0,venueAway=0;
    for(let j=0;j<out.length;j++){
      const m=out[j],w=(j<5?1.4:1)*(String(m.venue||"")=== "home"?1.07:1);
      sumF+=m.gf*w;sumA+=m.ga*w;weight+=w;
      if(m.venue==="home")venueHome++;if(m.venue==="away")venueAway++;
    }
    return {n:out.length,gf:weight?sumF/weight:null,ga:weight?sumA/weight:null,homeGames:venueHome,awayGames:venueAway};
  }
  function simulateMatch(g){
    const kickoff=Date.parse(g.date);
    if(!Number.isFinite(kickoff))throw Error("Unparseable kickoff fixture "+g.id);
    const home=summarize(g.last10?.home,kickoff),away=summarize(g.last10?.away,kickoff);
    const base=leagueBaseline(g.league);
    const smooth=(x,n)=>((x??base)*n+base*5)/(n+5);
    const atkH=smooth(home.gf,home.n),defH=smooth(home.ga,home.n);
    const atkA=smooth(away.gf,away.n),defA=smooth(away.ga,away.n);
    let eH=minMax(Math.sqrt(atkH*defA)*1.10,0.35,3.6),eA=minMax(Math.sqrt(atkA*defH)*0.94,0.35,3.6);
    const mm=metrics.get(String(g.id));
    const factors=["last_10_recency_weighted_goals_for_against","venue_home_advantage","league_sample_shrinkage"];
    if(mm?.verifiedJoin&&Number(mm.homeStats?.sample)>=8&&Number(mm.awayStats?.sample)>=8){
      const sh=Number(mm.homeStats?.shotsOnTargetAvg),sa=Number(mm.awayStats?.shotsOnTargetAvg);
      if(sh>0&&sa>0&&Number.isFinite(sh)&&Number.isFinite(sa)){
        eH*=minMax(Math.pow(sh/4.5,0.08),0.95,1.05);
        eA*=minMax(Math.pow(sa/4.5,0.08),0.95,1.05);
        factors.push("source_join_verified_team_shots_on_target");
      }
      const xgh=Number(mm.homeStats?.xgFor),xga=Number(mm.awayStats?.xgFor);
      if(xgh>0&&xga>0&&Number.isFinite(xgh)&&Number.isFinite(xga)){
        eH=0.85*eH+0.15*xgh;eA=0.85*eA+0.15*xga;
        factors.push("verified_team_xg_small_blend");
      }
    }
    const hRow=heads.get(String(g.id));
    const hs=(hRow?.h2h||[]).filter(x=>Date.parse(x.date)<kickoff&&validScore(x.homeScore)&&validScore(x.awayScore)).slice(0,5);
    if(hs.length>=3){
      const key=x=>String(x||"").toLowerCase().replace(/[^a-z0-9]/g,"");
      const hm=key(g.home.name);
      const allH=hs.map(x=>key(x.home)===hm?Number(x.homeScore):Number(x.awayScore));
      const allA=hs.map(x=>key(x.home)===hm?Number(x.awayScore):Number(x.homeScore));
      const hh=allH.reduce((a,b)=>a+b,0)/hs.length,aa=allA.reduce((a,b)=>a+b,0)/hs.length;
      eH=0.97*eH+0.03*minMax(hh,0,4);
      eA=0.97*eA+0.03*minMax(aa,0,4);
      factors.push("last_5_h2h_small_weight");
    }
    eH=minMax(eH,0.35,3.7);eA=minMax(eA,0.35,3.7);
    let seed=2166136261>>>0;
    for(const char of (research.date+"|"+g.id+"|experimental-10000"))seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
    if(seed===0)seed=1;
    const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296};
    const poisson=mean=>{let product=1,count=0,threshold=Math.exp(-mean);do{count++;product*=Math.max(rand(),1e-12)}while(product>threshold&&count<30);return count-1};
    let w=0,d=0,l=0,btts=0,over15=0,over25=0,under35=0;
    const scores=new Map();
    for(let i=0;i<simulations;i++){
      const a=poisson(eH),b=poisson(eA),total=a+b;
      if(a>b)w++;else if(a<b)l++;else d++;
      if(a>0&&b>0)btts++;if(total>=2)over15++;if(total>=3)over25++;if(total<=3)under35++;
      const score=a+"-"+b;scores.set(score,(scores.get(score)||0)+1);
    }
    if(w+d+l!==simulations)throw Error("Invalid WDL normalization");
    const pct=n=>Math.round(10000*n/simulations)/100;
    const likely=[...scores.entries()].sort((x,y)=>y[1]-x[1]||x[0].localeCompare(y[0])).slice(0,3).map(([score,count])=>({score,probabilityPct:pct(count)}));
    const nr=news.get(String(g.id));
    const context=nr?"Projected XIs and absences stored as context; no player-specific numerical adjustment without independently quantified impact.":"No verified matching XI/news in dated provider cache; no lineup adjustment.";
    const state=kickoff<=time?"post_kickoff_research_run_not_valid_pre_match":"pre_kickoff_experimental";
    return {fixtureId:String(g.id),league:g.league,kickoff:g.date,home:g.home.name,away:g.away.name,
      status:state,simulations,expectedGoals:{home:Number(eH.toFixed(3)),away:Number(eA.toFixed(3))},
      winDrawLossPct:{homeWin:pct(w),draw:pct(d),awayWin:pct(l)},
      predictedScore:likely[0]?.score||null,predictedScoreProbabilityPct:likely[0]?.probabilityPct||null,
      mostLikelyScores:likely,
      marketsPct:{over1_5:pct(over15),over2_5:pct(over25),under3_5:pct(under35),bttsYes:pct(btts)},
      dataQuality:{level:home.n>=8&&away.n>=8?"limited_experimental":"insufficient_history",homeHistoryGames:home.n,awayHistoryGames:away.n,verifiedShotJoin:!!(mm?.verifiedJoin&&factors.includes("source_join_verified_team_shots_on_target")),verifiedXg:factors.includes("verified_team_xg_small_blend"),h2hGames:hs.length,datedProjectedXI:!!nr,missingInputs:["opponent_adjusted_strength","calibrated_player_absence_impact",...(factors.includes("verified_team_xg_small_blend")?[]:["verified_xg"])]},
      usedFactors:factors,teamNewsContext:context,
      warning:"Exploratory Poisson Monte Carlo estimates, not calibrated probabilities or betting guarantees."};
  }
  const fixtures=research.fixtures.filter(g=>g?.home?.name&&g?.away?.name&&!/\(w\)/i.test(g.home.name+" "+g.away.name)).map(simulateMatch);
  const total=fixtures.reduce((a,x)=>a+x.simulations,0);
  return {schema:"footyedge-experimental-monte-carlo-v1",modelVersion:"experimental-poisson-10000-v1",date:research.date,generatedAt:asof,mode:"shadow_only",usedForOfficialPicks:false,simulationsPerFixture:simulations,totalSimulations:total,sourceDates:{research:research.generatedAt,analytics:analytics?.generatedAt||null,h2h:research.date,teamNews:teamNews?.generatedAt||null},assumptions:{goalDistribution:"independent Poisson with mildly shrunk recency-weighted scoring/conceding rates",homeAdvantageMultiplier:1.10,awayAdjustmentMultiplier:0.94,leagueGoalBaseline:"current date-qualified prior match snapshots in research base",xgAndShots:"only verified matched team stats; xG absent for most fixtures",h2h:"3% blend when at least three verified prior meetings",playerLineups:"context-only; no invented quantitative effect",marketOdds:"excluded",scope:"men only, all archived league fixtures"},coverage:{fixtures:fixtures.length,preKickoff:fixtures.filter(x=>x.status==="pre_kickoff_experimental").length,postKickoff:fixtures.filter(x=>x.status!=="pre_kickoff_experimental").length,atLeastEightEach:fixtures.filter(x=>x.dataQuality.level==="limited_experimental").length,shotJoined:fixtures.filter(x=>x.dataQuality.verifiedShotJoin).length,realXg:fixtures.filter(x=>x.dataQuality.verifiedXg).length,projectedXI:fixtures.filter(x=>x.dataQuality.datedProjectedXI).length},note:"Each result is a Monte Carlo simulation count, not independently validated or calibrated betting confidence. Backtests needed before production picks or price comparisons.",fixtures};
}
async function main(){
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 const day=process.env.SIMULATION_DATE||parts.year+"-"+parts.month+"-"+parts.day;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error("Invalid date");
 const root=process.cwd();
 const read=async p=>{try{return JSON.parse(await fs.readFile(path.join(root,p),"utf8"))}catch(e){if(e.code==="ENOENT")return null;throw e}};
 const research=await read("data/research-base-"+day+".json");
 if(!research||research.date!==day)throw Error("Exact-date research required");
 const dest=path.join(root,"data/experimental-simulations",day+".json");
 try{await fs.access(dest);console.log("Existing experimental snapshot preserved:",dest);return}catch(e){if(e.code!=="ENOENT")throw e}
 const analytics=await read("data/analytics/"+day+".json");
 const h2h=await read("data/h2h/"+day+".json");
 const teamNews=await read("data/team-intelligence/"+day+".json");
 // Run forecasts with historical observations restricted to before each kickoff.
 const result=runForecast({research,analytics,h2h,teamNews,asof:new Date().toISOString(),simulations:10000});
 if(result.coverage.fixtures!==research.fixtures.length||result.totalSimulations!==10000*research.fixtures.length)throw Error("Simulation coverage/normalization failure");
 await fs.mkdir(path.dirname(dest),{recursive:true});
 await fs.writeFile(dest,JSON.stringify(result,null,2)+"\n");
 console.log(JSON.stringify({date:day,file:dest,coverage:result.coverage,totalSimulations:result.totalSimulations},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e);process.exitCode=1});
