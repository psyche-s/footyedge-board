#!/usr/bin/env node
// FootyEdge Original: verified historical ESPN event stats, no future leakage.
// Does NOT edit frozen boards, official picks or the published goal model.
import fs from "node:fs/promises";
import {pathToFileURL} from "node:url";
import path from "node:path";
import {buildAdvancedSimulations} from "./simulate-matchups-v3.mjs";
const metrics=["shots","shotsOnTarget","corners","fouls","yellowCards","tackles","passes","shotsAllowed","shotsOnTargetAllowed"];
const names={shots:["totalshots","shots"],shotsOnTarget:["shotsontarget","shotsongoal"],corners:["woncorners","corners","cornerkicks"],
 fouls:["fouls","totalfouls"],yellowCards:["yellowcards"],tackles:["totaltackles","tackles"],passes:["totalpasses","passes"]};
const norm=x=>String(x||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const timestamp=x=>{const t=Date.parse(x);return Number.isFinite(t)?t:null};
const count=x=>{
 const value=typeof x==="object"&&x!==null?x.value??x.displayValue:x;
 if(typeof value!=="number"&&!/^\s*\d+(?:\.0+)?\s*$/.test(String(value??"")))return null;
 const n=Number(value);return Number.isInteger(n)&&n>=0&&n<3000?n:null;
};
const round=x=>Math.round(x*100)/100;
function teamMetrics(row){
 const stats=row?.statistics||[],out={};
 for(const [key,aliases] of Object.entries(names)){
  const found=stats.filter(s=>aliases.includes(norm(s?.name||s?.abbreviation)));
  if(found.length!==1)continue;
  const n=count(found[0].value??found[0].displayValue);
  if(n!==null)out[key]=n;
 }
 return out;
}
export function verifyHistoryEvent(payload,old,kickoff,teamId){
 const c=payload?.header?.competitions?.[0];
 if(String(c?.id||"")!==String(old?.id||"")||c?.status?.type?.completed!==true)return null;
 const d=timestamp(c.date||payload?.header?.date||payload?.gameInfo?.date),prior=timestamp(old.date);
 if(d===null||prior===null||d>=kickoff||prior>=kickoff||Math.abs(d-prior)>2*864e5)return null;
 const sides=c.competitors||[],own=sides.find(x=>String(x.team?.id??x.id)===String(teamId)),
  opp=sides.find(x=>String(x.team?.id??x.id)!==String(teamId));
 if(sides.length!==2||!own||!opp||count(own.score)!==old.gf||count(opp.score)!==old.ga)return null;
 const box=payload?.boxscore?.teams||[],home=box.find(x=>String(x.team?.id)===String(teamId)),
  away=box.find(x=>String(x.team?.id)===String(opp.team?.id??opp.id));
 if(!home||!away)return null;
 const a=teamMetrics(home),b=teamMetrics(away),r={id:String(old.id),date:new Date(d).toISOString(),
  gf:old.gf,ga:old.ga,sourceUrl:"https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event="+old.id};
 for(const k of ["shots","shotsOnTarget","corners","fouls","yellowCards","tackles","passes"])
  if(a[k]!==undefined)r[k]=a[k];
 if(b.shots!==undefined)r.shotsAllowed=b.shots;
 if(b.shotsOnTarget!==undefined)r.shotsOnTargetAllowed=b.shotsOnTarget;
 return metrics.some(k=>r[k]!==undefined)?r:null;
}
export function summarizeEvents(rows,cutoff){
 const unique=new Map();
 for(const x of rows||[])if(x&&x.id&&!unique.has(x.id)&&timestamp(x.date)<cutoff)unique.set(x.id,x);
 const clean=[...unique.values()].sort((a,b)=>timestamp(b.date)-timestamp(a.date)).slice(0,10);
 if(clean.length<5)return null;
 const out={sample:clean.length,source:"ESPN verified finalized soccer match summaries",
  mostRecent:clean[0].date,oldest:clean.at(-1).date,metricSamples:{},
  xgFor:null,xgAgainst:null,ppda:null,fieldTilt:null};
 for(const k of metrics){
  const nums=clean.map(x=>x[k]).filter(v=>Number.isInteger(v)&&v>=0);
  if(nums.length<5)continue;
  out[k+"Avg"]=round(nums.reduce((a,b)=>a+b,0)/nums.length);
  out.metricSamples[k]=nums.length;
 }
 return Object.keys(out.metricSamples).length?out:null;
}
export function makeDatedStyle(research,eventMap,captured){
 const matches=[];
 for(const f of research.fixtures){
  const kick=timestamp(f.date);
  if(kick===null)continue;
  const profiles={},links=[];
  for(const side of ["home","away"]){
   const teamId=f[side]?.id;
   const rows=(f.last10?.[side]||[]).slice(0,10).map(x=>verifyHistoryEvent(eventMap.get(String(x.id)),x,kick,teamId)).filter(Boolean);
   profiles[side]=summarizeEvents(rows,kick);
   links.push(...rows.map(x=>x.sourceUrl));
  }
  if(!profiles.home||!profiles.away)continue;
  const common=metrics.filter(k=>(profiles.home.metricSamples[k]||0)>=5&&(profiles.away.metricSamples[k]||0)>=5);
  if(!common.length)continue;
  matches.push({fixtureId:String(f.id),league:f.league,home:f.home.name,away:f.away.name,
    verifiedJoin:true,sources:[...new Set(links)],homeStats:profiles.home,awayStats:profiles.away,
    supportedMarkets:common,sourceFamily:"ESPN completed match summaries",recordsBeforeKickoff:true});
 }
 return {schema:"footyedge-verified-event-style-v1",date:research.date,generatedAt:captured,noFutureResults:true,
  noImputedData:true,matches,coverage:{fixtures:research.fixtures.length,matched:matches.length,
  markets:Object.fromEntries(metrics.map(k=>[k,matches.filter(x=>x.supportedMarkets.includes(k)).length]))}};
}
const read=async p=>{try{return JSON.parse(await fs.readFile(p,"utf8"))}catch(e){if(e.code==="ENOENT")return null;throw e}};
async function fetchSummary(id){
 const u="https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event="+id;
 for(let i=0;i<2;i++)try{
  const r=await fetch(u,{signal:AbortSignal.timeout(13000),headers:{accept:"application/json","User-Agent":"FootyEdge-History/1.0"}});
  if(r.status===404)return null;if(r.ok)return await r.json();
 }catch{}
 return null;
}
async function main(){
 const p=process.argv.find(x=>/^--date=20\d\d-\d\d-\d\d$/.test(x));
 const date=p?.slice(7)||process.env.STYLE_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",
  year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 if(!/^\d{4}-\d\d-\d\d$/.test(date))throw Error("Bad day");
 const research=await read("data/research-base-"+date+".json");
 if(!research?.fixtures?.length||research.date!==date)throw Error("Exact-date research is required");
 const stylePath="data/style-matchups/"+date+".json",outPath="data/event-projection-overlays/"+date+".json",captured=new Date().toISOString();
 let style=await read(stylePath);
 if(style?.date!==date||!Array.isArray(style.matches)||!style.matches.length){
  const ids=new Set();
  for(const f of research.fixtures)for(const side of ["home","away"])for(const row of (f.last10?.[side]||[]).slice(0,10))
   if(/^\d+$/.test(String(row.id||""))&&timestamp(row.date)<timestamp(f.date))ids.add(String(row.id));
  let next=0,done=0,success=0;const keys=[...ids],map=new Map();
  async function worker(){while(next<keys.length){
   const id=keys[next++],body=await fetchSummary(id);map.set(id,body);done++;success+=Boolean(body);
   if(done%100===0)console.log("Historical event summaries",done,"/",keys.length,"received",success);
  }}
  await Promise.all(Array.from({length:8},()=>worker()));
  style=makeDatedStyle(research,map,captured);
  if(style.coverage.matched===0)throw Error("Zero validated fixture histories: refusing to publish fake projection data; responses="+success+"/"+keys.length);
  await fs.mkdir("data/style-matchups",{recursive:true});
  await fs.writeFile(stylePath,JSON.stringify(style,null,2)+"\n");
  console.log("Pre-kickoff history coverage:",JSON.stringify(style.coverage),"summary responses:",success);
 }
 const [analytics,h2h,teamNews,standings]=await Promise.all(["analytics/"+date+".json","h2h/"+date+".json",
  "team-intelligence/"+date+".json","experimental-inputs/"+date+"-standings.json"].map(f=>read("data/"+f)));
 const simulation=buildAdvancedSimulations({research,analytics,h2h,teamNews,standings,styleEvents:style,
  asof:captured,simulations:10000});
 const marketKeys=metrics.filter(k=>!k.endsWith("Allowed"));
 const matches=simulation.fixtures.map(f=>{
  const src=style.matches.find(x=>x.fixtureId===f.fixtureId);if(!src)return null;
  const usable=marketKeys.filter(k=>src.supportedMarkets.includes(k)&&
   f.statTotals?.[k]?.status==="modeled_from_verified_inputs"&&Number.isFinite(f.statTotals[k].projection));
  if(!usable.length)return null;
  return {fixtureId:f.fixtureId,league:f.league,home:f.home,away:f.away,kickoff:f.kickoff,notGoalModel:true,
   statTotals:Object.fromEntries(usable.map(k=>[k,f.statTotals[k]])),
   teamProjections:Object.fromEntries(["home","away"].map(side=>[side,
    Object.fromEntries(usable.filter(k=>Number.isFinite(f.teamProjections?.[side]?.[k])).map(k=>[k,f.teamProjections[side][k]]))])),
   statInputCoverage:Object.fromEntries(usable.map(k=>[k,f.statInputCoverage?.[k]||"verified"])),
   supportedMarkets:usable,
   evidence:{sampleHome:src.homeStats.sample,sampleAway:src.awayStats.sample,sourceCount:src.sources.length,
    metricSamplesHome:src.homeStats.metricSamples,metricSamplesAway:src.awayStats.metricSamples,
    opponentShotAllowedVerified:(src.homeStats.metricSamples.shotsAllowed||0)>=5&&(src.awayStats.metricSamples.shotsAllowed||0)>=5}};
 }).filter(Boolean);
 const out={schema:"footyedge-event-stat-projection-overlay-v1",date,generatedAt:new Date().toISOString(),
  immutableOriginalBoardPreserved:true,originalGoalPredictionsPreserved:true,
  derivedAfterInitialGoalSnapshot:true,notCalibrated:true,notSportsbookOdds:true,
  note:"Recovered after the original goal snapshot; event statistics only from verified prior completed matches. Not a publication-time forecast, bookmaker line or independent calibrated model.",
  coverage:{fixtures:research.fixtures.length,projected:matches.length,byMarket:Object.fromEntries(marketKeys.map(k=>[k,matches.filter(x=>x.supportedMarkets.includes(k)).length]))},
  matches};
 await fs.mkdir("data/event-projection-overlays",{recursive:true});
 await fs.writeFile(outPath,JSON.stringify(out,null,2)+"\n");
 console.log("Event overlay coverage:",JSON.stringify(out.coverage));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
 main().catch(e=>{console.error(e);process.exitCode=1});
