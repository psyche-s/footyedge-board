// Read-only player information from ESPN's public soccer team roster and
// athlete endpoints. Never guess a player identity, biography, injury or stat.
// No email, phone, private address, contract or nonpublic contact information.
const LEAGUES=new Set(["eng.1","eng.2","esp.1","ita.1","ger.1","fra.1","ned.1",
 "por.1","tur.1","uefa.champions","uefa.europa","uefa.europa.conf",
 "usa.1","jpn.1","kor.1","ksa.1","cze.1","uefa.nations"]);
const escName=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const asText=x=>typeof x==="string"?x:typeof x==="number"?String(x):"";
const txt=x=>asText(x).slice(0,120).trim();
const num=x=>Number.isFinite(Number(x))&&x!==""&&x!=null?Number(x):null;
const allowedImg=x=>/^https:\/\/(?:a\.espncdn\.com|a\.espn\.com)\/[a-z0-9._~!$&'()*+,;=:@/%?-]+$/i.test(String(x||""))?x:null;
function rosterRows(payload){
 const groups=Array.isArray(payload?.athletes)?payload.athletes:[];
 const items=groups.flatMap(g=>Array.isArray(g.items)?g.items:
  Array.isArray(g.athletes)?g.athletes:(g.id||g.displayName)?[g]:[]);
 return items.map(row=>row.athlete||row).filter(a=>a&&a.id&&(a.displayName||a.fullName||a.name));
}
function matchRosterPlayer(payload,name,id){
 const rows=rosterRows(payload),input=escName(name),want=String(id||"");
 if(want){
  const matched=rows.filter(a=>String(a.id)===want);
  return matched.length===1&&(!input||escName(matched[0].displayName||matched[0].fullName||matched[0].name)===input)?matched[0]:null;
 }
 if(input.length<3)return null;
 const exact=rows.filter(a=>escName(a.displayName||a.fullName||a.name)===input);
 if(exact.length===1)return exact[0];
 if(exact.length>1)return null;
 // Allow a shorter matchday name only when uniquely identifying an athlete
 // in this exact club roster; ambiguous surnames are never resolved by guess.
 const similar=rows.filter(a=>{
  const k=escName(a.displayName||a.fullName||a.name);
  return k.endsWith(" "+input)&&input.length>=5;
 });
 return similar.length===1?similar[0]:null;
}
function parseBio(a,roster,teamName){
 const player=a&&typeof a==="object"?a:{};
 const r=roster||{};
 const candidate=player.headshot?.href||r.headshot?.href||r.headshot||player.headshot;
 const nationality=player.citizenship?.displayName||player.citizenship?.name||
  (typeof player.citizenship==="string"?player.citizenship:null)||
  player.nationality?.displayName||player.nationality||player.country?.displayName||
  player.birthPlace?.country?.name||r.citizenship?.name||r.nationality||null;
 const positions=[player.position?.displayName||player.position?.name||r.position?.displayName||
  r.position?.name||r.position||null, ...(Array.isArray(player.positions)?player.positions.map(p=>p.displayName||p.name||null):[])].filter(x=>typeof x==="string"&&x.length<80);
 const first=positions[0]||null;
 const career=Array.isArray(player.teams)?player.teams:
  Array.isArray(player.careerTeams)?player.careerTeams:[];
 return {
  id:txt(player.id||r.id),name:txt(player.fullName||player.displayName||r.fullName||r.displayName||r.name),
  shortName:txt(player.shortName||r.shortName)||null,
  team:txt(teamName),headshot:allowedImg(candidate),
  dateOfBirth: /^\d{4}-\d{2}-\d{2}/.test(asText(player.dateOfBirth||r.dateOfBirth))?
   asText(player.dateOfBirth||r.dateOfBirth).slice(0,10):null,
  nationality:typeof nationality==="string"?txt(nationality):null,
  jerseyNumber:txt(r.jersey||r.jerseyNumber||player.jersey||player.jerseyNumber)||null,
  height:txt(player.displayHeight||r.displayHeight)||null,
  weight:txt(player.displayWeight||r.displayWeight)||null,
  dominantFoot:["left","right","both"].includes(asText(player.preferredFoot||r.preferredFoot).toLowerCase())?
   asText(player.preferredFoot||r.preferredFoot).toLowerCase():null,
  position:first,secondaryPositions:positions.slice(1,4),
  career:career.map(x=>({club:txt(x.team?.displayName||x.team?.name||x.displayName||x.name),
   from:txt(x.startDate||x.startYear||"")||null,
   to:txt(x.endDate||x.endYear||"")||null}))
   .filter(x=>x.club).slice(0,12)
 };
}
const STAT_NAMES=new Map([
 ["appearances","Appearances"],["gamesplayed","Appearances"],["matchesplayed","Appearances"],
 ["starts","Starts"],["gamesstarted","Starts"],["goals","Goals"],["goalscored","Goals"],
 ["assists","Assists"],["shots","Shots"],["shotsontarget","Shots on target"],
 ["minutes","Minutes"],["minutesplayed","Minutes"],["yellowcards","Yellow cards"],
 ["redcards","Red cards"],["cleansheets","Clean sheets"]
]);
const key=x=>escName(x).replace(/\s+/g,"");
function statEntries(obj){
 if(!obj||typeof obj!=="object")return [];
 const hits=[];
 const blocks=[obj,...(Array.isArray(obj.splits)?obj.splits:[]),
  ...(Array.isArray(obj.categories)?obj.categories:[])];
 for(const block of blocks){
  const groups=[...(Array.isArray(block.categories)?block.categories:[]),block];
  for(const group of groups){
   for(const item of Array.isArray(group.stats)?group.stats:[]){
    const label=STAT_NAMES.get(key(item.name||item.abbreviation||item.label));
    const value=num(item.value??item.displayValue);
    if(label&&value!=null&&value>=0)hits.push({label,value});
   }
   const names=group.names,values=group.stats;
   if(Array.isArray(names)&&Array.isArray(values)){
    names.forEach((name,i)=>{const label=STAT_NAMES.get(key(name)),value=num(values[i]);
     if(label&&value!=null&&value>=0)hits.push({label,value});});
   }
  }
 }
 const unique=new Map();
 for(const x of hits)if(!unique.has(x.label))unique.set(x.label,x);
 return [...unique.values()];
}
function parseRecent(log){
 const entries=Array.isArray(log?.entries)?log.entries:
   Array.isArray(log?.events)?log.events: Array.isArray(log?.items)?log.items:[];
 return entries.map(x=>{
  const m=x.event||x.competition||x;
  const date=txt(m.date||x.date),opponent=txt(x.opponent?.displayName||x.opponent?.name||
    m.opponent?.name||m.opponent?.displayName);
  if(!/^\d{4}-\d{2}-\d{2}/.test(date)||!opponent)return null;
  const stats=statEntries(x.statistics||x.stats||x);
  if(!stats.length)return null;
  const value=label=>stats.find(z=>z.label===label)?.value??null;
  return {date:date.slice(0,10),opponent,goals:value("Goals"),
   assists:value("Assists"),minutes:value("Minutes"),shots:value("Shots")};
 }).filter(Boolean).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
}
async function verifyESPNHeadshot(id){
 if(!/^\d{1,12}$/.test(String(id||"")))return null;
 const url="https://a.espncdn.com/i/headshots/soccer/players/full/"+id+".png";
 try{
  const r=await fetch(url,{method:"HEAD",signal:AbortSignal.timeout(2200)});
  const type=String(r.headers.get("content-type")||"");
  return r.ok&&type.startsWith("image/")?url:null;
 }catch{return null}
}
async function getJSON(url,ms=3600){
 const r=await fetch(url,{headers:{accept:"application/json"},signal:AbortSignal.timeout(ms)});
 if(!r.ok)throw Error("Provider "+r.status);
 const v=await r.json();if(!v||typeof v!=="object")throw Error("Invalid response");
 return v;
}
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"GET required"});
 const league=String(req.query.league||""),teamId=String(req.query.teamId||""),
  name=txt(req.query.name),playerId=String(req.query.playerId||"");
 if(!LEAGUES.has(league)||! /^\d{1,10}$/.test(teamId)||
  (playerId&&!/^\d{1,12}$/.test(playerId))||(!name&&!playerId)||name.length>80)
  return res.status(400).json({error:"Invalid player request"});
 res.setHeader("Cache-Control","public, s-maxage=900, stale-while-revalidate=3600");
 const root="https://site.api.espn.com/apis/site/v2/sports/soccer/"+league;
 try{
  const team=await getJSON(root+"/teams/"+teamId+"/roster",4000);
  const player=matchRosterPlayer(team,name,playerId);
  if(!player)return res.status(200).json({schema:"footyedge-player-profile-v1",
    status:"unverified",name,team:txt(team?.team?.displayName||team?.team?.name),
    note:"We could not match this player uniquely to the verified club roster.",stats:[],recent:[]});
  const id=String(player.id),api="https://sports.core.api.espn.com/v2/sports/soccer/leagues/"+league+"/athletes/"+id;
  const [bio,stats,log]=await Promise.allSettled([
   getJSON(api,3500),getJSON(api+"/statistics",3400),getJSON(api+"/statisticslog",3400)
  ]);
  const from=x=>x.status==="fulfilled"?x.value:null;
  const profile=parseBio(from(bio),player,team?.team?.displayName||team?.team?.name||"");
  // ESPN often omits roster photo URLs while its player-ID CDN has the
  // portrait. HEAD-verify the URL first; never display a guessed image.
  if(!profile.headshot)profile.headshot=await verifyESPNHeadshot(id);
  const season=statEntries(from(stats));
  const recent=parseRecent(from(log));
  // No data is silently fabricated: each supported stat originates in ESPN.
  return res.status(200).json({schema:"footyedge-player-profile-v1",status:"verified",
   player:profile,stats:season,recent,statsVerified:season.length>0,
   recentVerified:recent.length>0,checkedAt:new Date().toISOString()});
 }catch{
  return res.status(200).json({schema:"footyedge-player-profile-v1",
   status:"unavailable",name,team:"",stats:[],recent:[],
   note:"Player details could not be verified right now."});
 }
}
export {rosterRows,matchRosterPlayer,parseBio,statEntries,parseRecent};
