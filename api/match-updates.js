// Read-only live matchday check. ESPN summary is source-labelled; no source,
// confirmed starters or fresh injuries are invented when ESPN lacks coverage.
const LEAGUES=new Set(["eng.1","eng.2","esp.1","ita.1","ger.1","fra.1","ned.1","por.1","tur.1","uefa.champions","uefa.europa","uefa.europa.conf","uefa.nations","usa.1","jpn.1","kor.1","ksa.1","cze.1"]);
const local=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));return p.year+"-"+p.month+"-"+p.day};
const plusDay=d=>{const x=new Date(d+"T12:00Z");x.setUTCDate(x.getUTCDate()+1);return x.toISOString().slice(0,10)};
function extractStarters(summary){
 const groups=[...(Array.isArray(summary?.rosters)?summary.rosters:[]),...(Array.isArray(summary?.boxscore?.players)?summary.boxscore.players:[])];
 const checked=[];
 for(const g of groups){
  const teamId=String(g?.team?.id||g?.teamId||"");
  const rows=[...(Array.isArray(g.roster)?g.roster:[]),...(Array.isArray(g.players)?g.players:[]),
   ...((g.statistics||[]).flatMap(x=>Array.isArray(x.athletes)?x.athletes:[]))];
  const starters=rows.filter(p=>p?.starter===true||p?.isStarter===true||p?.starting===true).map(p=>{
   const athlete=p.athlete||p.player||p;
   const name=String(athlete?.displayName||athlete?.fullName||athlete?.name||"").trim();
   const link=String(athlete?.headshot?.href||athlete?.headshot||"");
   return {id:/^\d{1,12}$/.test(String(athlete.id||""))?String(athlete.id):null,
    name,photoUrl:/^https:\/\/a\.espncdn\.com\//.test(link)?link:null,
    jersey:athlete.jersey||athlete.jerseyNumber||null,
    position:String(athlete.position?.displayName||athlete.position?.abbreviation||"")||null};
  }).filter(p=>p.name).filter((p,i,a)=>a.findIndex(x=>x.name===p.name)===i);
  if(teamId&&starters.length===11)checked.push({teamId,players:starters});
 }
 return checked;
}
function injuries(summary){
 const groups=Array.isArray(summary?.injuries)?summary.injuries:[];
 const result={};
 for(const group of groups){
  const teamId=String(group?.team?.id||group?.teamId||"");
  if(!teamId||!Array.isArray(group.injuries))continue;
  const values=group.injuries.map(p=>{
   const who=String(p.athlete?.displayName||p.athlete?.name||p.player?.displayName||"").trim();
   const state=String(p.status||p.type?.name||p.details?.type||"").trim();
   return who&&state?who+" ("+state+")":null;
  }).filter(Boolean).slice(0,9);
  if(values.length)result[teamId]=values;
 }
 return result;
}
function rosterPhotos(payload){
 const groups=Array.isArray(payload?.athletes)?payload.athletes:[];
 const rows=groups.flatMap(g=>Array.isArray(g.items)?g.items:Array.isArray(g.athletes)?g.athletes:(g.id||g.displayName)?[g]:[]);
 return rows.map(entry=>{
  const a=entry.athlete||entry;
  const name=String(a.displayName||a.fullName||a.name||"").trim();
  const href=String(a.headshot?.href||a.headshot||"");
  return name?{id:/^\d{1,12}$/.test(String(a.id||""))?String(a.id):null,
    name,photoUrl:/^https:\/\/a\.espncdn\.com\//.test(href)?href:null,
    jersey:a.jersey||a.jerseyNumber||null,position:a.position?.displayName||null}:null;
 }).filter(Boolean).filter((row,i,a)=>a.findIndex(x=>x.name===row.name)===i).slice(0,40);
}
async function verifiedRosterPhotos(league,competition,requested=[]){
 const ids=[...new Set([...(competition?.competitors||[]).map(x=>String(x.team?.id||x.id||"")),
   ...requested.map(x=>String(x.teamId||""))].filter(x=>/^\d{1,10}$/.test(x)))].slice(0,2);
 const results=await Promise.allSettled(ids.map(async id=>{
  const request=requested.find(x=>String(x.teamId)===id);
  const competitions=[...new Set([league,request?.fallbackLeague].filter(x=>LEAGUES.has(x)))];
  const players=new Map();
  for(const tournament of competitions){
   try{
    const url="https://site.api.espn.com/apis/site/v2/sports/soccer/"+tournament+"/teams/"+id+"/roster";
    const r=await fetch(url,{headers:{accept:"application/json"},signal:AbortSignal.timeout(3400)});
    if(!r.ok)continue;
    const payload=await r.json(),officialId=String(payload?.team?.id||"");
    if(officialId&&officialId!==id)continue;
    for(const p of rosterPhotos(payload)){const k=p.id||p.name;
      const previous=players.get(k);if(!previous||(!previous.photoUrl&&p.photoUrl))players.set(k,p);
    }
    // Always merge domestic and cup rosters; the cup roster can be sparse even when it has one valid headshot.
   }catch{}
  }
  return {id,players:[...players.values()]};
 }));
 return Object.fromEntries(results.filter(x=>x.status==="fulfilled"&&x.value.players.length)
   .map(x=>[x.value.id,x.value.players]));
}
function requestedTeams(query){
 return ["home","away"].map(side=>({teamId:String(query[side+"TeamId"]||""),
   fallbackLeague:String(query[side+"FallbackLeague"]||"")})).filter(t=>/^\d{1,10}$/.test(t.teamId)&&
     (!t.fallbackLeague||LEAGUES.has(t.fallbackLeague)));
}

export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"GET only"});
 const id=String(req.query.id||""),league=String(req.query.league||""),date=String(req.query.date||local()),today=local();
 const hints=requestedTeams(req.query);
 if(!/^\d{5,12}$/.test(id)||!LEAGUES.has(league)||![today,plusDay(today)].includes(date))return res.status(400).json({error:"Invalid or out-of-range match."});
 res.setHeader("Cache-Control","public, s-maxage=240, stale-while-revalidate=120");
 const url="https://site.api.espn.com/apis/site/v2/sports/soccer/"+encodeURIComponent(league)+"/summary?event="+encodeURIComponent(id);
 try{
  const response=await fetch(url,{headers:{accept:"application/json"},signal:AbortSignal.timeout(5500)});
  if(!response.ok)throw Error("Provider "+response.status);
  const data=await response.json();
  const competition=data?.header?.competitions?.[0]||data?.boxscore?.teams?.[0]?.competition||null;
  const eventId=String(data?.header?.id||competition?.id||data?.header?.competitions?.[0]?.id||"");
  if(eventId&&eventId!==id)throw Error("Provider returned another match");
  const statuses=data?.header?.competitions?.[0]?.status?.type||data?.header?.status?.type||{};
  const verified=extractStarters(data);
  const reported=injuries(data);
  const rosterHeadshots=await verifiedRosterPhotos(league,competition,hints).catch(()=>({}));
  return res.status(200).json({schema:"footyedge-match-check-v1",id,league,date,checkedAt:new Date().toISOString(),
    available:true,provider:"ESPN match summary",sourceUrl:"https://www.espn.com/soccer/match/_/gameId/"+id,
    liveState:String(statuses.state||"unknown"),confirmedXIs:verified,reportedInjuries:reported,rosterHeadshots,
    note:verified.length?"Only complete source-marked starting XIs are treated as confirmed.":"No complete confirmed XI was provided; previously sourced predictions remain labelled as predictions."});
 }catch{
  const rosterHeadshots=await verifiedRosterPhotos(league,null,hints).catch(()=>({}));
  return res.status(200).json({schema:"footyedge-match-check-v1",id,league,date,checkedAt:new Date().toISOString(),
   available:false,provider:"ESPN match summary",confirmedXIs:[],reportedInjuries:{},rosterHeadshots,
   note:"No confirmed match XI; verified club roster details may still be available."});
 }
}
export{extractStarters,injuries,rosterPhotos,requestedTeams};
