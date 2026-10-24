#!/usr/bin/env node
// Source-matched evidence-first Top-3; date-scoped overlay, never mutates frozen archives.
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
export function buildReviewedPicks({research,simulation,news,standings,editorialCrosschecks}){
 const day=research?.date;
 if(!day||!Array.isArray(research.fixtures)||simulation?.date!==day)return {error:"Date-matched research and simulation required"};
 const simById=new Map(simulation.fixtures.map(x=>[String(x.fixtureId),x]));
 const newsById=new Map((news?.fixtures||[]).map(x=>[String(x.fixtureId),x]));
 const trim=(x,min,max)=>Math.min(max,Math.max(min,x));
 const title=t=>String(t||"");
 const data=[];
 for(const f of research.fixtures){
   const sim=simById.get(String(f.id)),H=(f.last10?.home||[]).filter(x=>Number.isInteger(x.gf)&&Number.isInteger(x.ga)&&x.gf>=0&&x.ga>=0).slice(0,10),A=(f.last10?.away||[]).filter(x=>Number.isInteger(x.gf)&&Number.isInteger(x.ga)&&x.gf>=0&&x.ga>=0).slice(0,10);
   const nh=H.length,na=A.length;
   const out={gameId:String(f.id),league:f.league,home:f.home.name,away:f.away.name,kickoff:f.date,reviewed:true,picks:[],qualifyingInputs:{homeLast10:nh,awayLast10:na,simulation:!!sim,sourceReviewed:false,news:newsById.has(String(f.id))}};
   if(!sim||nh<8||na<8){out.reviewed=false;out.reason="Historical match samples or model snapshot incomplete";data.push(out);continue}
   const h=f.home.name,a=f.away.name;const c=(arr,fn)=>arr.filter(fn).length;
   const last5=x=>x.slice(0,5);
   const score=x=>Math.round(x);
   const w=sim.winDrawLossPct;
   const e=sim.expectedGoals;
   const pct=n=>trim(Number(n),0,100);
   const both=(lh,la)=>.5*(lh/nh+la/na)*100;
   const q=(mode,modelRate,lh,la,stat,reason)=>({
     label:mode.label,category:mode.category,family:mode.family,confidenceRating:score(trim(.55*modelRate+.45*both(lh,la),45,94)),researchStrength:score(trim(.55*modelRate+.45*both(lh,la),45,94)),
     historicalSupportPct:score(both(lh,la)),experimentalFrequencyPct:Number(modelRate.toFixed(2)),homeHits:lh,homeSample:nh,awayHits:la,awaySample:na,
     reason,rank:null,sourceBackedReason:true,probabilityCalibrated:false,confidenceType:"researched_strength_not_calibrated_win_probability",score:null,odds:null,ev:null,verifiedPrice:false,researchOnly:true,marketEvidence:stat
   });
   const result=[];
   const sideH=c(H,x=>x.gf>=x.ga),sideA=c(A,x=>x.gf>=x.ga),notWinA=c(A,x=>x.gf<=x.ga),notWinH=c(H,x=>x.gf<=x.ga);
   const hwin=c(H,x=>x.gf>x.ga),awin=c(A,x=>x.gf>x.ga),homeOppLoss=c(A,x=>x.gf<x.ga),awayOppLoss=c(H,x=>x.gf<x.ga);
   const table=standings?.leagues?.[f.league]?.table||[];
   const ht=table.find(t=>String(t.id)===String(f.home.id)),at=table.find(t=>String(t.id)===String(f.away.id));
   const standingContext=ht&&at?` They enter with league positions ${ht.rank} and ${at.rank}, respectively.`:"";
   result.push(q({label:h+" or Draw",category:"Double Chance",family:"result"},pct(w.homeWin+w.draw),sideH,notWinA,{},`${h} avoided defeat in ${sideH}/${nh} recent matches, while ${a} failed to win ${notWinA}/${na}. Draw cover protects against a close contest; the 10,000-draw model supported the home-or-draw outcome in ${pct(w.homeWin+w.draw).toFixed(1)}% of its scenarios.${standingContext}`));
   result.push(q({label:a+" or Draw",category:"Double Chance",family:"result"},pct(w.awayWin+w.draw),sideA,notWinH,{},`${a} avoided defeat in ${sideA}/${na} recent games and ${h} failed to win ${notWinH}/${nh}. Draw protection reduces the need to pick an outright winner; simulated away-or-draw outcomes reached ${pct(w.awayWin+w.draw).toFixed(1)}%.${standingContext}`));
   if(w.homeWin>=56&&hwin>=5&&homeOppLoss>=3)result.push(q({label:h+" ML",category:"Match Result",family:"result"},pct(w.homeWin),hwin,homeOppLoss,{},`${h} won ${hwin}/${nh} recent matches while ${a} lost ${homeOppLoss}/${na}. Home win is supported in ${pct(w.homeWin).toFixed(1)}% of simulated outcomes, though the draw still presents risk.${standingContext}`));
   if(w.awayWin>=56&&awin>=5&&awayOppLoss>=3)result.push(q({label:a+" ML",category:"Match Result",family:"result"},pct(w.awayWin),awin,awayOppLoss,{},`${a} won ${awin}/${na} recent games and ${h} lost ${awayOppLoss}/${nh}. The modeled away-win rate was ${pct(w.awayWin).toFixed(1)}%; the straight win is less protected than double chance.${standingContext}`));
   result.sort((x,y)=>y.confidenceRating-x.confidenceRating||y.historicalSupportPct-x.historicalSupportPct);
   const chooseResult=result.find(x=>x.confidenceRating>=58)||result[0];
   const goals=[];
   function goalMarket(label,test,p,atLeast=false){
     const hitsH=c(H,test),hitsA=c(A,test);const rn=last5(H).filter(test).length,rm=last5(A).filter(test).length;
     goals.push(q({label,category:"Goals",family:"total"},pct(p),hitsH,hitsA,{},`${h} met the ${label.toLowerCase()} line in ${hitsH}/${nh} recent matches and ${a} in ${hitsA}/${na}. Across their latest five, it landed ${rn}/5 and ${rm}/5, respectively. The independent goal model produced this outcome in ${pct(p).toFixed(1)}% of runs.`));
   }
   const under45=c(H,x=>x.gf+x.ga<=4),under45a=c(A,x=>x.gf+x.ga<=4);
   const poissonCDF=(lam,limit)=>{let p=Math.exp(-lam),sum=p;for(let k=1;k<=limit;k++){p=p*lam/k;sum+=p}return sum};
   const under45Pct=pct(100*poissonCDF(e.home+e.away,4));
   goalMarket("Under 4.5 Goals",x=>x.gf+x.ga<=4,under45Pct);
   goalMarket("Under 3.5 Goals",x=>x.gf+x.ga<=3,sim.marketsPct.under3_5);
   goalMarket("Over 1.5 Goals",x=>x.gf+x.ga>=2,sim.marketsPct.over1_5);
   goalMarket("Over 2.5 Goals",x=>x.gf+x.ga>=3,sim.marketsPct.over2_5);
   goals.sort((x,y)=>y.confidenceRating-x.confidenceRating);
   // Do not always default to a trivial total when a shorter meaningful line is
   // nearly as robust and has sufficient recent observations on both sides.
   const goalChoice=goals.find(x=>x.label!=="Under 4.5 Goals"&&x.confidenceRating>=goals[0].confidenceRating-6&&x.confidenceRating>=70)||goals[0];
   const scoring=[];
   function scMarket(label,type,testH,testA,prob){
     const hhit=c(H,testH),ahit=c(A,testA);
     const mode={label,category:type==="btts"?"BTTS":"Team Goals",family:type};
     const reasoning=type==="btts"?
       `Both teams ${label.endsWith("No")?"failed to score together":"scored"} in ${hhit}/${nh} of ${h}'s recent matches and ${ahit}/${na} of ${a}'s. A separate goal model produced ${label} in ${pct(prob).toFixed(1)}% of simulations; scoring variance remains significant.`:
       (label.startsWith(h)?`${h} scored in ${hhit}/${nh} recent fixtures, while ${a} conceded in ${ahit}/${na}.`:`${a} scored in ${ahit}/${na} recent fixtures, while ${h} conceded in ${hhit}/${nh}.`)+` The simulated chance of at least one goal for that side was ${pct(prob).toFixed(1)}%, leaving room for a narrow match.`;
     scoring.push(q(mode,pct(prob),hhit,ahit,{},reasoning));
   }
   scMarket(h+" 1+ Goal","team-goal",x=>x.gf>=1,x=>x.ga>=1,pct(100*(1-Math.exp(-e.home))));
   scMarket(a+" 1+ Goal","team-goal",x=>x.ga>=1,x=>x.gf>=1,pct(100*(1-Math.exp(-e.away))));
   scMarket("BTTS Yes","btts",x=>x.gf>=1&&x.ga>=1,x=>x.gf>=1&&x.ga>=1,sim.marketsPct.bttsYes);
   scMarket("BTTS No","btts",x=>x.gf===0||x.ga===0,x=>x.gf===0||x.ga===0,100-sim.marketsPct.bttsYes);
   scoring.sort((x,y)=>y.confidenceRating-x.confidenceRating);
   let scoringChoice=scoring.find(x=>{
     if(x.confidenceRating<58)return false;
     if(goalChoice.label==="Over 1.5 Goals"&&x.label==="BTTS Yes")return false;
     if(chooseResult.label.endsWith(" ML")&&x.label===chooseResult.label.slice(0,-3)+" 1+ Goal")return false;
     return true;
   });
   // Don't invent a third play from absent shots, player or booking records.
   const picked=[chooseResult,goalChoice,scoringChoice].filter(Boolean).filter(x=>x.confidenceRating>=58);
   picked.sort((x,y)=>y.confidenceRating-x.confidenceRating||y.historicalSupportPct-x.historicalSupportPct);
   picked.forEach((x,i)=>{x.rank=i+1;});
   // A dated optional independent preview may ADD a verified contextual fact
   // to an already-supported selection. It never creates a pick or changes rating.
   const cross=(editorialCrosschecks?.date===day?editorialCrosschecks.matches:[]||[])
     .find(x=>String(x.fixtureId)===String(f.id));
   for(const pick of picked){
     const match=(cross?.context||[]).find(x=>String(x.market).toLowerCase()===String(pick.label).toLowerCase()
       &&typeof x.note==="string"&&x.note.length<=240);
     if(!match)continue;
     const cleaned=match.note.replace(/https?:\/\/\S+/g,"").replace(/\b(?:Football Whispers|Sports Mole|Forebet|Opta|ESPN|Sportskeeda|FotMob)\b/gi,"").trim();
     if(cleaned){pick.reason+=" "+cleaned;pick.contextVerified=true;out.qualifyingInputs.sourceReviewed=true;}
   }
   out.picks=picked;
   out.reviewStatus=picked.length===3?"three_supported_research_angles":"insufficient_independent_high_grade_market";
   out.qualifyingInputs.verifiedStandings=!!(ht&&at);
   out.qualifyingInputs.verifiedH2h=(sim.dataQuality?.h2hGames||0)>0;
   data.push(out);
 }
 return {schema:"footyedge-dated-researched-top3-v1",date:day,generatedAt:new Date().toISOString(),sourceNamesOnUi:false,archiveUnmodified:true,
   method:"Three market theses (protected result, one match total, one distinct scoring outcome); backed by both teams' date-filtered last 10 games and the separate 10,000-draw experiment; unsupported markets omitted rather than guessed.",
   calibration:"These ratings are graded research strengths, not calibrated probabilities.",
   totals:{fixtures:data.length,three:data.filter(x=>x.picks.length===3).length,two:data.filter(x=>x.picks.length===2).length,one:data.filter(x=>x.picks.length===1).length,zero:data.filter(x=>x.picks.length===0).length},
   matches:data};
}
async function main(){
 const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 const date=process.env.REVIEW_DATE||p.year+"-"+p.month+"-"+p.day;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Invalid research day");
 const get=async s=>{try{return JSON.parse(await fs.readFile(path.join("data",s),"utf8"))}catch(e){if(e.code==="ENOENT")return null;throw e}};
 const research=await get("research-base-"+date+".json");
 const sim=await get("experimental-simulations/"+date+"-v2.json")||await get("experimental-simulations/"+date+".json");
 const news=await get("team-intelligence/"+date+".json");
 const standings=await get("experimental-inputs/"+date+"-standings.json");
 const editorialCrosschecks=await get("research-crosschecks/"+date+".json");
 if(!research||!sim||research.date!==sim.date)throw Error("Verified dated research/sim required");
 const out=buildReviewedPicks({research,simulation:sim,news,standings,editorialCrosschecks});
 if(out.error||out.totals.fixtures!==research.fixtures.length)throw Error("Review mismatch");
 const dest=path.join("data","pick-reviews",date+".json");
 try{await fs.access(dest);console.log("Date-scoped picks already published; unchanged");return}catch(e){if(e.code!=="ENOENT")throw e}
 await fs.mkdir(path.dirname(dest),{recursive:true});
 await fs.writeFile(dest,JSON.stringify(out,null,2)+"\n");
 console.log("Picks research overlay:",JSON.stringify(out.totals));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e);process.exitCode=1});
