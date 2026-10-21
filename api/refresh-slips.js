const norm=v=>String(v??"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
function market(p){
 const label=String(p.label||"").trim().toLowerCase().replace(/\s+/g," ");
 const m=label.match(/^(over|under) (\d+(?:\.\d+)?) goals$/);
 if(m)return{family:"total",dir:m[1],line:Number(m[2])};
 const n=label.match(/^(.+) ([123])\+ goals?$/);
 if(n)return{family:"team-goal",team:n[1],line:Number(n[2])};
 if(label.endsWith(" or draw"))return{family:"double-chance",team:label.slice(0,-8)};
 if(label.endsWith(" ml"))return{family:"winner",team:label.slice(0,-3)};
 if(label.includes("btts")||label.includes("both teams to score"))return{family:"btts",yes:!label.includes("no")};
 const cat=norm(p.category);
 if(["player","shots","shots on target","fouls","cards","corners","assists"].includes(cat))return{family:"player"};
 return null;
}

function compatible(a,b){
 if(a.gameId!==b.gameId)return true;
 if(norm(a.label)===norm(b.label))return false;
 const A=market(a),B=market(b);if(!A||!B)return false;
 if(A.family==="total"&&B.family==="total")return false;
 if(A.family==="team-goal"&&B.family==="total"||A.family==="total"&&B.family==="team-goal")return false;
 // Two "team 1+" picks just restate BTTS Yes, rather than two distinct markets.
 if(A.family==="team-goal"&&B.family==="team-goal")return false;
 if(A.family==="btts"||B.family==="btts"){
   const other=A.family==="btts"?B:A;
   return !["total","team-goal","btts"].includes(other.family);
 }
 if(A.family==="winner"&&B.family==="winner")return false;
 if(A.family==="double-chance"&&B.family==="double-chance")return false;
 if(A.family==="winner"&&B.family==="double-chance"||B.family==="winner"&&A.family==="double-chance")return false;
 if(A.family==="winner"&&B.family==="team-goal"&&A.team===B.team)return false;
 if(B.family==="winner"&&A.family==="team-goal"&&A.team===B.team)return false;
 if(A.family==="double-chance"&&B.family==="team-goal"&&A.team===B.team)return false;
 if(B.family==="double-chance"&&A.family==="team-goal"&&A.team===B.team)return false;
 // Do not implicitly claim unrelated player-event markets are combinable.
 if(A.family==="player"&&B.family==="player")return false;
 return true;
}
function correlation(a,b){
 const aF=a.family,bF=b.family;
 if(aF==="total"&&bF==="team-goal"||bF==="total"&&aF==="team-goal")return 5;
 if(aF==="winner"&&bF==="team-goal"||bF==="winner"&&aF==="team-goal")return 6;
 if(aF==="team-goal"&&bF==="team-goal")return 4;
 if(aF==="double-chance"&&bF==="team-goal"||bF==="double-chance"&&aF==="team-goal")return 3;
 return 1;
}
// SGP/ACCA are the marquee competitions only. J1, K League 1, Saudi
// Pro League, Czech and friendly slates remain on Fixtures, not on the slips.
const MAJOR_SLIP_LEAGUES=new Set([
 "eng.1","eng.2","esp.1","ita.1","ger.1","fra.1","ned.1","por.1","tur.1",
 "uefa.champions","uefa.europa","uefa.europa.conf","uefa.nations","usa.1"
]);
function isMajor(league){return MAJOR_SLIP_LEAGUES.has(String(league||""));}
function overallRating(legs,isSameGame=false){
 if(!legs.length)return null;
 const minimum=Math.min(...legs.map(x=>Number(x.rating)||0));
 // Ranking heuristic, deliberately NOT a multi-leg winning probability.
 return Math.max(0,Math.min(95,Math.round(minimum-3*Math.max(0,legs.length-1)-(isSameGame?2:0))));
}
function sgp(all){
 const groups=new Map();
 for(const x of all.filter(v=>isMajor(v.league))){if(!groups.has(x.gameId))groups.set(x.gameId,[]);groups.get(x.gameId).push(x);}
 const choices=[];
 for(const [id,group] of groups){
  const eligible=group.filter(x=>x.rating>=73).sort((a,b)=>b.rating-a.rating||a.label.localeCompare(b.label)).slice(0,11);
  let best=null;
  for(let mask=1;mask<2**eligible.length;mask++){
   const legs=eligible.filter((_,i)=>mask&(1<<i));
   if(legs.length<2||legs.length>5||legs.some((x,i)=>legs.slice(i+1).some(y=>!compatible(x,y))))continue;
   let overlap=0;for(let i=0;i<legs.length;i++)for(let j=i+1;j<legs.length;j++)overlap+=correlation(legs[i],legs[j]);
   const weakest=Math.min(...legs.map(x=>x.rating)),avg=legs.reduce((n,x)=>n+x.rating,0)/legs.length;
   const fitness=.68*weakest+.32*avg+Math.min(4,legs.length)*1.8-overlap-legs.reduce((n,x)=>n+x.risk.length,0);
   if(!best||fitness>best.fitness)best={fitness,legs,id,overlap};
  }
  if(best)choices.push(best);
 }
 choices.sort((a,b)=>b.fitness-a.fitness||a.id.localeCompare(b.id));
 const best=choices[0];
 return best?{status:"qualified",format:"Best same-game parlay",overallResearchRating:overallRating(best.legs,true),legs:best.legs.sort((a,b)=>b.rating-a.rating),
  caution:best.legs.length===2?"Two strong, compatible legs qualified. A third leg was not forced; recheck starting XIs and exact market availability.":best.overlap>5?"Some legs positively overlap; avoid treating the selection grades as an independent combination probability.":"Check confirmed lineups and availability of exact markets before placement."}:
 {status:"pass",format:"Same-game parlay",legs:[],caution:"No fixture has two compatible, sufficiently supported selections. Passing rather than forcing a slip."};
}
function acca(all){
 const sorted=all.filter(x=>isMajor(x.league)&&x.rating>=79).sort((a,b)=>b.rating-a.rating||a.gameId.localeCompare(b.gameId));
 const used=new Set(),categories=new Map(),leagues=new Map(),legs=[];
 while(legs.length<5){
  let choice=null,best=-Infinity;
  for(const x of sorted){
   if(used.has(x.gameId)||(categories.get(x.family)||0)>=2)continue;
   const fitness=x.rating-(categories.get(x.family)||0)*5-(leagues.get(x.league)||0)*2-x.risk.length;
   if(fitness>best){best=fitness;choice=x;}
  }
  if(!choice)break;
  legs.push(choice);used.add(choice.gameId);categories.set(choice.family,(categories.get(choice.family)||0)+1);
  leagues.set(choice.league,(leagues.get(choice.league)||0)+1);
 }
 return legs.length>=4?{status:"qualified",format:"Cross-game accumulator",overallResearchRating:overallRating(legs),legs,
  caution:"One leg per match; market types diversified. Weakest evidence rating "+Math.min(...legs.map(x=>x.rating))+"%. Accumulator risk compounds."}:
 {status:"pass",format:"Cross-game accumulator",legs:[],caution:"Fewer than four strong, diverse fixtures qualify."};
}


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
function sgpsByLeague(items){
 const groups=new Map();
 for(const leg of items||[])if(isMajor(leg.league)){
  if(!groups.has(leg.league))groups.set(leg.league,[]);
  groups.get(leg.league).push(leg);
 }
 return [...groups].map(([league,picks])=>({league,...sgp(picks)}))
  .filter(x=>x.status==="qualified")
  .sort((a,b)=>(b.overallResearchRating||0)-(a.overallResearchRating||0)||a.league.localeCompare(b.league));
}
function rebuild(desk,now,statuses){
 const safe=(desk.eligibleSlipLegs||[]).filter(x=>qualifies(x,now,statuses));
 return{sgp:sgp(safe),acca:acca(safe),sgpsByLeague:sgpsByLeague(safe),
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
   sgp:result.sgp,acca:result.acca,sgpsByLeague:result.sgpsByLeague,props:result.props,candidatesRemaining:result.eligible,fixturesRemaining:result.fixtures});
 }catch{return res.status(503).json({error:"Refresh source temporarily unavailable; previously published slips remain unchanged."});}
}
export{qualifies,eventStatus,rebuild};
