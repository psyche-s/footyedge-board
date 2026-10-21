import {sgp,acca} from "../scripts/build-daily-slips.mjs";
// Source-backed, read-only 4-minute overlay. No GitHub commit or Vercel deployment.
const GH="https://raw.githubusercontent.com/psyche-s/footyedge-board/main/data/slips/";
const MAJOR=new Set(["eng.1","eng.2","esp.1","ita.1","ger.1","fra.1","ned.1","por.1","tur.1","uefa.champions","uefa.europa","uefa.europa.conf","uefa.nations","usa.1"]);
const local=()=>{const x=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(p=>[p.type,p.value]));return x.year+"-"+x.month+"-"+x.day};
const tomorrow=d=>{const x=new Date(d+"T12:00Z");x.setUTCDate(x.getUTCDate()+1);return x.toISOString().slice(0,10)};
const get=async url=>{const r=await fetch(url,{headers:{accept:"application/json"},signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error(String(r.status));return r.json()};
function eventStatus(event){
 const t=event?.status?.type||event?.competitions?.[0]?.status?.type||{};
 const state=String(t.state||"").toLowerCase(),name=String(t.name||"").toLowerCase();
 return{done:!!t.completed||state==="post"||name.includes("final"),live:state==="in"||name.includes("progress")||name.includes("half"),cancelled:/postpon|cancel|suspend/.test(name)};
}
function qualifies(leg,now,statuses){
 if(!leg||!MAJOR.has(leg.league)||!Number.isFinite(Date.parse(leg.kickoff)))return false;
 if(Date.parse(leg.kickoff)<=now+5*60000)return false;
 const s=statuses.get(String(leg.gameId));
 return !(s?.done||s?.live||s?.cancelled);
}
function rebuild(desk,now,statuses){
 const safe=(desk.eligibleSlipLegs||[]).filter(x=>qualifies(x,now,statuses));
 return{sgp:sgp(safe),acca:acca(safe),
  props:(desk.props||[]).filter(x=>Number.isFinite(Date.parse(x.kickoff))&&Date.parse(x.kickoff)>now+5*60000),
  eligible:safe.length,fixtures:new Set(safe.map(x=>x.gameId)).size};
}
async function statuses(legs,date){
 const leagues=[...new Set(legs.map(x=>x.league))].filter(x=>MAJOR.has(x)).slice(0,6),found=new Map(),verified=[];
 const responses=await Promise.allSettled(leagues.map(league=>get("https://site.api.espn.com/apis/site/v2/sports/soccer/"+league+"/scoreboard?dates="+date.replace(/-/g,"")+"&limit=100")));
 for(let i=0;i<responses.length;i++)if(responses[i].status==="fulfilled"&&Array.isArray(responses[i].value.events)){
  verified.push(leagues[i]);
  for(const e of responses[i].value.events)if(e?.id)found.set(String(e.id),eventStatus(e));
 }
 return{found,verified,attempted:leagues};
}
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"GET only"});
 const date=String(req.query.date||local()),today=local();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||![today,tomorrow(today)].includes(date))return res.status(400).json({error:"Only today and tomorrow can be refreshed."});
 res.setHeader("Cache-Control","public, s-maxage=240, stale-while-revalidate=120");
 try{
  const desk=await get(GH+date+".json");
  if(desk?.date!==date||!desk.majorLeagueRule||!Array.isArray(desk.eligibleSlipLegs))return res.status(503).json({error:"Major-league research pool not published yet."});
  const check=await statuses(desk.eligibleSlipLegs,date),now=Date.now(),result=rebuild(desk,now,check.found);
  return res.status(200).json({schema:"footyedge-live-slip-check-v1",date,checkedAt:new Date(now).toISOString(),
   source:"Officially published dated FootyEdge research; ESPN per-competition scoreboard where available",
   verifiedScoreboards:check.verified,attemptedScoreboards:check.attempted,
   dataCoverage:check.verified.length?"Partial live status verified; unsourced fixtures screened by kickoff.":"Scoreboards unavailable; conservative kickoff cutoff applied.",
   refreshWindowMinutes:4,immutableBoardsPreserved:true,noNewDeployment:true,
   sgp:result.sgp,acca:result.acca,props:result.props,candidatesRemaining:result.eligible,fixturesRemaining:result.fixtures});
 }catch{return res.status(503).json({error:"Refresh source temporarily unavailable; previously published slips remain unchanged."});}
}
export{qualifies,eventStatus,rebuild};
