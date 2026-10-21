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
  if(matched.length!==1)return null;
  const full=escName(matched[0].displayName||matched[0].fullName||matched[0].name);
  // Sourced lineups often print just a surname. Require that surname to be
  // an unambiguous match *within this club* even when ESPN supplied an ID.
  const suffix=input.length>=4&&full.endsWith(" "+input);
  const unique=rows.filter(a=>escName(a.displayName||a.fullName||a.name).endsWith(" "+input));
  return !input||full===input||(suffix&&unique.length===1)?matched[0]:null;
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
 ["starts","Starts"],["gamesstarted","Starts"],["goals","Goals"],["goalscored","Goals"],["totalgoals","Goals"],
 ["assists","Assists"],["goalassists","Assists"],["shots","Shots"],["totalshots","Shots"],["shotsontarget","Shots on target"],
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

/* ESPN's /overview exposes actual per-competition 2026-27 stats. The older
   core /statistics endpoint often has no usable data for football athletes. */
function parseOverviewSeason(overview,league,teamId,gameLog){
 const root=overview?.statistics;
 if(!root||!Array.isArray(root.splits)||!Array.isArray(root.names))return {stats:[],competition:null};
 const sameTeam=root.splits.filter(s=>String(s.teamId)===String(teamId));
 const options=sameTeam.length?sameTeam:root.splits;
 // Prioritise the match competition, then the player's domestic club league,
 // never claim national-team records are club stats.
 const current=options.filter(s=>/2026[-–]27|2026/i.test(String(s.displayName||"")));
 const choice=current.find(s=>s.leagueSlug===league)||
  (current.length===1?current[0]:current.find(s=>!String(s.leagueSlug).includes("nations")&&!String(s.leagueSlug).includes("friendly")))||
  sameTeam.find(s=>s.leagueSlug===league)||sameTeam[0]||null;
 if(!choice||!Array.isArray(choice.stats))return {stats:[],competition:null};
 const chosen=new Map();
 root.names.forEach((raw,i)=>{
  const label=STAT_NAMES.get(key(raw));
  const v=num(choice.stats[i]);
  if(label&&v!=null&&v>=0)chosen.set(label,{label,value:v});
 });
 const appearances=Array.isArray(gameLog?.seasonTypes)?gameLog.seasonTypes
   .filter(g=>String(g.displayName||"")===String(choice.displayName||""))
   .flatMap(g=>Array.isArray(g.categories)?g.categories:[])
   .flatMap(g=>Array.isArray(g.events)?g.events:[])
   .filter(x=>x?.eventId).length:0;
 if(appearances>0)chosen.set("Appearances",{label:"Appearances",value:appearances});
 return {stats:[...chosen.values()],competition:String(choice.displayName||"")||null};
}
/* Different ESPN pages expose compact per-game stat arrays with separate
   labels and an eventId->game metadata map, not an entries[] array. */
function parseESPNLastFive(overview,gameLog,competition){
 const recent=overview?.gameLog;
 let names=recent?.statistics?.[0]?.names||[],rows=recent?.statistics?.[0]?.events||[],
  events=recent?.events||{};
 if(!Array.isArray(rows)||!rows.length){
  const collection=(gameLog?.seasonTypes||[]).find(g=>g.displayName===competition)||
    gameLog?.seasonTypes?.[0];
  rows=(collection?.categories||[]).flatMap(c=>c.events||[]);
  events=gameLog?.events||{};names=gameLog?.names||[];
 }
 const now=Date.now();
 return rows.flatMap(row=>{
  const match=events[String(row.eventId)]||gameLog?.events?.[String(row.eventId)];
  const date=String(match?.gameDate||"");
  if(!/^\d{4}-\d{2}-\d{2}/.test(date)||Date.parse(date)>now)return [];
  const opponent=String(match?.opponent?.displayName||"").trim();
  if(!opponent||!Array.isArray(row.stats))return [];
  const keyed=new Map();
  names.forEach((name,i)=>{
   const k=STAT_NAMES.get(key(name)),n=num(row.stats[i]);
   if(k&&n!=null)keyed.set(k,n);
  });
  if(!keyed.size)return [];
  return [{date:date.slice(0,10),opponent,goals:keyed.get("Goals")??null,
    assists:keyed.get("Assists")??null,shots:keyed.get("Shots")??null,
    shotsOnTarget:keyed.get("Shots on target")??null,
    minutes:keyed.get("Minutes")??null,appearance:row.stats?.[0]==="Started"?"Started":
      row.stats?.[0]==="Sub"?"Sub":null}];
 }).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
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
  const v3="https://site.web.api.espn.com/apis/common/v3/sports/soccer/"+league+"/athletes/"+id;
  const [bio,stats,log,overview,gameLog]=await Promise.allSettled([
   getJSON(api,3500),getJSON(api+"/statistics",3400),getJSON(api+"/statisticslog",3400),
   getJSON(v3+"/overview",3800),getJSON(v3+"/gamelog",3600)
  ]);
  const from=x=>x.status==="fulfilled"?x.value:null;
  const profile=parseBio(from(bio),player,team?.team?.displayName||team?.team?.name||"");
  // ESPN often omits roster photo URLs while its player-ID CDN has the
  // portrait. HEAD-verify the URL first; never display a guessed image.
  if(!profile.headshot)profile.headshot=await verifyESPNHeadshot(id);
  const verified=from(overview),matches=from(gameLog);
  const summary=parseOverviewSeason(verified,league,teamId,matches);
  const season=summary.stats.length?summary.stats:statEntries(from(stats));
  const recent=parseESPNLastFive(verified,matches,summary.competition);
  const actualRecent=recent.length?recent:parseRecent(from(log));
  // Every number comes from a dated, independently retrieved provider field.
  return res.status(200).json({schema:"footyedge-player-profile-v1",status:"verified",
   player:profile,competition:summary.competition,stats:season,recent:actualRecent,
   statsVerified:season.length>0,recentVerified:actualRecent.length>0,
   checkedAt:new Date().toISOString()});
 }catch{
  return res.status(200).json({schema:"footyedge-player-profile-v1",
   status:"unavailable",name,team:"",stats:[],recent:[],
   note:"Player details could not be verified right now."});
 }
}
export {rosterRows,matchRosterPlayer,parseBio,statEntries,parseRecent,parseOverviewSeason,parseESPNLastFive};
