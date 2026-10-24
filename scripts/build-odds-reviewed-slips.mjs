#!/usr/bin/env node
// Dated, research-graded SGP/ACCA slip research based on observed market quotes.
// Never claim ESPN-reported US-provider odds are available at bet365 Ontario,
// or that multiplying correlated SGP legs produces executable builder odds.
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
const safe=number=>Number.isFinite(number)?Math.round(number*100)/100:null;
const clip=(x,a,b)=>Math.min(b,Math.max(a,x));
const E=["jpn.1","kor.1","ksa.1"];
function marketProbability(label,m){
 const n=m.marketsPct||{},w=m.winDrawLossPct||{};
 if(label===m.home+" ML")return w.homeWin;
 if(label===m.away+" ML")return w.awayWin;
 if(label==="Draw")return w.draw;
 const over=label.match(/^Over (\d+\.5) Goals$/);
 const under=label.match(/^Under (\d+\.5) Goals$/);
 const v=Number((over||under)?.[1]);
 if(over)return v===1.5?n.over1_5:v===2.5?n.over2_5:v===3.5?100-n.under3_5:null;
 if(under)return v===1.5?100-n.over1_5:v===2.5?100-n.over2_5:v===3.5?n.under3_5:null;
 return null;
}
function breakeven(american){return american<0?100*(-american)/(-american+100):10000/(american+100)}
function historicalSupport(label,fixture){
 const H=fixture.last10?.home||[],A=fixture.last10?.away||[];
 if(H.length<8||A.length<8)return null;
 const o=label.match(/^(Over|Under) (\d+\.5) Goals$/);
 let hit;
 if(o){const limit=Number(o[2]);hit=r=>o[1]==="Over"?r.gf+r.ga>limit:r.gf+r.ga<limit}
 else if(label===fixture.home.name+" ML"){hit=(r,isHome)=>isHome?r.gf>r.ga:r.gf<r.ga}
 else if(label===fixture.away.name+" ML"){hit=(r,isHome)=>isHome?r.gf<r.ga:r.gf>r.ga}
 else if(label==="Draw"){hit=r=>r.gf===r.ga}
 else return null;
 let h=0,a=0;
 for(const r of H.slice(0,10))if(hit(r,true))h++;
 for(const r of A.slice(0,10))if(hit(r,false))a++;
 return {h,a,total:H.length+A.length,rate:100*(h+a)/(H.length+A.length)};
}
function shortlistPriceCandidates(fixture,sim,quotes){
 const names=new Set([fixture.home.name+" ML",fixture.away.name+" ML","Draw",
 "Over 1.5 Goals","Over 2.5 Goals","Over 3.5 Goals","Under 2.5 Goals","Under 3.5 Goals"]);
 const result=[];
 for(const q of quotes||[]){
  if(!names.has(q.label)||!Number.isInteger(q.odds)||q.odds<=-420||q.odds>450)continue;
  const prob=marketProbability(q.label,{...sim,home:fixture.home.name,away:fixture.away.name});
  const hist=historicalSupport(q.label,fixture);
  if(prob==null||hist==null||hist.h<4||hist.a<4)continue;
  const breakEven=breakeven(q.odds);
  // This is a conservative selection screen, NOT validated expected value.
  if(prob<61||hist.rate<59||prob-breakEven<2.5)continue;
  const grade=Math.round(clip(.55*prob+.45*hist.rate-2.5,55,89));
  if(grade<68)continue;
  const rationale=fixture.home.name+" and "+fixture.away.name+" met this exact market in "+
   hist.h+"/"+fixture.last10.home.length+" and "+hist.a+"/"+fixture.last10.away.length+
   " recent matches. The opponent-conditioned research model returned "+prob.toFixed(1)+
   "%. A reference market price was observed, but Ontario bet-builder availability and combined odds are not verified.";
  result.push({gameId:String(fixture.id),fixture:fixture.home.name+" vs "+fixture.away.name,
   kickoff:fixture.date,league:fixture.league,label:q.label,category:q.label.endsWith(" ML")?"Match Result":"Goals",
   family:q.label.endsWith(" ML")?"result":"total",
   rating:grade,why:rationale,sourceBackedReason:true,
   researchModelPct:safe(prob),recentSamplePct:safe(hist.rate),
   observedReferenceOdds:q.odds,observedReferenceBook:q.book,
   verifiedPrice:false,odds:null,priceStatus:"observed_us_reference_not_bet365_ontario",
   risk:["Bookmaker price is a market-reference quote, not a confirmed Ontario/bet365 executable line.",
      "The research model is not independently calibrated."]});
 }
 return result.sort((a,b)=>b.rating-a.rating||b.researchModelPct-a.researchModelPct);
}
function suitableSgp(m){
 if(E.includes(m.league)||m.picks?.length<3)return null;
 const picks=m.picks.filter(p=>Number.isFinite(p.confidenceRating)&&p.confidenceRating>=63
  &&typeof p.reason==="string"&&p.reason.length>30);
 const group=[];const families=new Set();
 for(const p of picks){
  const f=p.family||p.category;
  if(families.has(f))continue;
  if(f==="btts"&&p.label==="BTTS Yes"&&picks.some(x=>x.label==="Over 1.5 Goals"))continue;
  if(f==="team-goal"&&group.some(x=>x.label===p.label.replace(/ 1\+ Goal$/," ML")))continue;
  if(f==="result"&&group.some(x=>p.label===x.label.replace(/ 1\+ Goal$/," ML")))continue;
  group.push(p);families.add(f);
  if(group.length===3)break;
 }
 if(group.length!==3)return null;
 const legs=group.map(p=>({
  gameId:String(m.gameId),fixture:m.home+" vs "+m.away,league:m.league,
  kickoff:m.kickoff,label:p.label,category:p.category,family:p.family,
  rating:p.confidenceRating,why:p.reason,
  verifiedPrice:false,odds:null,priceStatus:"bet_builder_quote_not_verified",
  risk:["Correlated same-match events; the combined probability is not the product of research grades.",
      "Check the exact market and displayed payout directly with your sportsbook."]}));
 const overall=clip(Math.round(Math.min(...legs.map(x=>x.rating))-10),45,84);
 return {status:"qualified",format:"Same-game parlay",gameId:String(m.gameId),fixture:m.home+" vs "+m.away,league:m.league,
  legs,overallResearchRating:overall,
  caution:"Research-built three-leg SGP, not an executable sportsbook ticket. Exact bet365 Ontario odds and combined bet-builder quote are unavailable; correlated legs can make the actual risk much higher."};
}
export function generateReviewedSlipDesk({date,review,research,simulation,markets,asof}){
 if(review?.date!==date||research?.date!==date||simulation?.date!==date||markets?.date!==date)
   throw Error("Slip sources must share the exact local date");
 const simBy=new Map(simulation.fixtures.map(x=>[String(x.fixtureId),x]));
 const researchBy=new Map(research.fixtures.map(x=>[String(x.id),x]));
 const quotes=new Map((markets.events||[]).map(x=>[String(x.id),x]));
 const now=Date.parse(asof);
 const eligible=review.matches.filter(x=>x.reviewed&&x.picks.length>=2&&!E.includes(x.league)
   &&Date.parse(x.kickoff)>now);
 const candidates=eligible.map(suitableSgp).filter(Boolean).sort((a,b)=>
  b.overallResearchRating-a.overallResearchRating||
  Math.min(...b.legs.map(x=>x.rating))-Math.min(...a.legs.map(x=>x.rating)));
 const leagueBest=new Map();
 for(const x of candidates)if(!leagueBest.has(x.league))leagueBest.set(x.league,x);
 const sgpsByLeague=[...leagueBest.values()].sort((a,b)=>a.league.localeCompare(b.league));
 const sgp=candidates[0]||{status:"pass",format:"Same-game parlay",legs:[],
    caution:"No supported three-market same-game research combination is qualified; do not force an SGP."};
 const candidatesPrice=[];
 for(const x of eligible){
  const raw=researchBy.get(String(x.gameId)),sim=simBy.get(String(x.gameId));
  if(!raw||!sim||sim.status!=="pre_kickoff_experimental")continue;
  const got=quotes.get(String(x.gameId));
  if(!got||Date.parse(got.date)<=Date.parse(markets.observations||0))continue;
  candidatesPrice.push(...shortlistPriceCandidates(raw,sim,got.prices));
 }
 // At most one leg per match; avoid overlapping the best-SGP match.
 const unique=new Map();
 for(const x of candidatesPrice.sort((a,b)=>b.rating-a.rating))
  if(!unique.has(x.gameId)&&x.gameId!==sgp.gameId)unique.set(x.gameId,x);
 const cross=[];const perLeague=new Map();
 const all=[...unique.values()];
 for(const leg of all){
   if(cross.length>=7)break;
   if((perLeague.get(leg.league)||0)>=2&&cross.length<4)continue;
   cross.push(leg);perLeague.set(leg.league,(perLeague.get(leg.league)||0)+1);
 }
 if(cross.length<4){
   // Avoid presenting a false priced multi-game slip. Keep a research-only
   // shortlist as HOLD instead of inventing a bookmaker price.
   const fallback=eligible.filter(x=>String(x.gameId)!==sgp.gameId)
    .sort((a,b)=>(b.picks?.[0]?.confidenceRating||0)-(a.picks?.[0]?.confidenceRating||0));
   for(const row of fallback){
     if(cross.length>=5)break;
     if(cross.some(l=>String(l.gameId)===String(row.gameId)))continue;
     const pick=row.picks[0];
     if(!pick||pick.confidenceRating<72)continue;
     cross.push({gameId:row.gameId,fixture:row.home+" vs "+row.away,kickoff:row.kickoff,
      league:row.league,label:pick.label,category:pick.category,family:pick.family,
      rating:pick.confidenceRating,why:pick.reason,verifiedPrice:false,odds:null,
      priceStatus:"no_exact_reference_quote",risk:["Exact sportsbook line and price unavailable. This leg remains a research watch."]});
   }
 }
 const eligibleCross=cross.length>=4?cross:[];
 const acca=eligibleCross.length?{status:"qualified",format:"Cross-game parlay",
  legs:eligibleCross,overallResearchRating:clip(Math.min(...cross.map(x=>x.rating))-
    4*(cross.length-1),40,80),caution:"Research-screened cross-game ACCA: one leg per fixture, with independent reference prices checked where obtainable. No verified bet365 Ontario execution or combined odds. Unpriced legs must be verified before use."}:
  {status:"pass",format:"Cross-game parlay",legs:[],caution:"Fewer than four supported games after odds and availability checks; no fabricated parlay."};
 return {schema:"footyedge-odds-reviewed-slips-v1",date,checkedAt:asof,state:"reviewed_research",
  quotesObservedAt:markets.observations||null,priceSource:markets.source,
  sportsbookAvailability:"Not verified at bet365 Ontario; no SGP combined quote",
  noSportsbookOddsOnMatchCards:true,
  gradedResearchNotCalibrated:true,sgp,acca,sgpsByLeague,props:[],
  audits:{eligibleMajorFixtures:eligible.length,priceScreenCandidates:candidatesPrice.length,
   sgpQualifiedLeagues:sgpsByLeague.length,pricedCrossLegs:cross.filter(x=>x.observedReferenceOdds!=null).length,
   crossLegs:acca.legs.length,excludedLeagues:E}};
}
async function main(){
 const now=new Date(),t=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",
  year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now).map(x=>[x.type,x.value]));
 const day=process.env.SLIPS_DATE||[t.year,t.month,t.day].join("-");
 const read=async name=>JSON.parse(await fs.readFile(path.join("data",name),"utf8"));
 const dest=path.join("data","slips-reviewed",day+".json");
 try{await fs.access(dest);console.log("Existing dated slip review retained");return}catch(e){if(e.code!=="ENOENT")throw e}
 const [review,research,simulation,markets]=await Promise.all([
  fs.readFile(path.join("data","consensus-reviewed",day+".json"),"utf8").then(JSON.parse).catch(e=>{if(e.code!=="ENOENT")throw e;return read("pick-reviews/"+day+".json")}),read("research-base-"+day+".json"),
  read("experimental-simulations/"+day+"-v3.json"),
  read("slip-market-snapshots/"+day+".json")
 ]);
 const out=generateReviewedSlipDesk({date:day,review,research,simulation,markets,asof:now.toISOString()});
 await fs.mkdir(path.dirname(dest),{recursive:true});
 await fs.writeFile(dest,JSON.stringify(out,null,2)+"\n");
 console.log("Researched slips:",out.audits);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
 main().catch(e=>{console.error(e);process.exitCode=1});
