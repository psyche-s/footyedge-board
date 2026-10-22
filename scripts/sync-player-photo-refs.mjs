/**
 * Read-only ESPN player-photo reference collector for original FootyEdge.
 * Retains metadata and checked CDN URLs, NEVER copyrighted image bytes.
 * Fixture, club and athlete identity must be sourced; no image-search guessing.
 *
 * Run: node scripts/sync-player-photo-refs.mjs
 * Can run repeatedly. Preserves previously verified references.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT=process.cwd();
const SOURCE="https://site.api.espn.com/apis/site/v2/sports/soccer/";
const CDN="https://a.espncdn.com/i/headshots/soccer/players/full/";
const GOOD_LEAGUES=new Set(["eng.1","eng.2","esp.1","ita.1","ger.1","fra.1",
 "ned.1","por.1","tur.1","uefa.champions","uefa.europa","uefa.europa.conf",
 "usa.1","jpn.1","kor.1","ksa.1","cze.1","uefa.nations"]);
const SCOPE_DAYS=Math.max(1,Math.min(7,Number(process.env.PHOTO_DAYS||5)));
const MAX_TEAMS=Math.max(1,Math.min(550,Number(process.env.PHOTO_MAX_TEAMS||120)));
const POOL_SIZE=8;
const n=x=>String(x??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const numeric=x=>/^[1-9]\d{0,11}$/.test(String(x??""));
function day(offset){
 const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",
  year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 const d=new Date(p.year+"-"+p.month+"-"+p.day+"T12:00:00Z");
 d.setUTCDate(d.getUTCDate()+offset);
 return d.toISOString().slice(0,10);
}
function read(filename){try{return JSON.parse(fs.readFileSync(path.join(ROOT,filename),"utf8"));}catch{return null;}}
async function get(url,timeout=4500){
 const response=await fetch(url,{headers:{"accept":"application/json"},signal:AbortSignal.timeout(timeout)});
 if(!response.ok)throw Error("HTTP "+response.status);
 return response.json();
}
async function inPool(items,job,count=POOL_SIZE){
 let next=0;
 const output=new Array(items.length);
 await Promise.all(Array.from({length:Math.min(count,items.length)},async()=>{
  while(next<items.length){const i=next++;try{output[i]=await job(items[i]);}
   catch(e){output[i]={error:String(e)};}}
 }));
 return output;
}

/* Team directories cover every club in every tracked men's competition.
   Dated fixtures are fallback/priority seeds, never the total collection scope. */
function parseLeagueTeams(payload,league){
 const rows=payload?.sports?.[0]?.leagues?.[0]?.teams||payload?.teams||[];
 if(!Array.isArray(rows))return [];
 const teams=new Map();
 for(const entry of rows){
  const t=entry?.team||entry;
  const id=String(t?.id||"");
  if(!numeric(id)||t?.isActive===false)continue;
  const key=league+":"+id;
  teams.set(key,{key,league,teamId:id,teamName:String(t.displayName||t.name||"").trim(),
   source:"ESPN competition team directory"});
 }
 return [...teams.values()];
}
function fixtureTeams(){
 const targets=new Map();
 for(let offset=-7;offset<SCOPE_DAYS;offset++){
  const date=day(offset);
  const board=read("data/boards/"+date+".json");
  const intel=read("data/team-intelligence/"+date+".json");
  const slugs=new Map();
  for(const game of board?.games||[]){
   if(!GOOD_LEAGUES.has(game.league))continue;
   slugs.set(String(game.id),game.league);
   // Published boards already contain source IDs even if fixture snapshots
   // haven't been generated or are temporarily unavailable.
   for(const side of ["home","away"]){
    const team=game.teams?.[side];
    if(!numeric(team?.id))continue;
    const key=game.league+":"+team.id;
    targets.set(key,{key,league:game.league,teamId:String(team.id),
     teamName:String(team.name||""),date,source:"FootyEdge sourced board"});
   }
  }
  for(const game of intel?.fixtures||[])
   if(GOOD_LEAGUES.has(game.league))slugs.set(String(game.fixtureId),game.league);
  for(const item of read("data/"+date+"/fixtures.json")?.response||[]){
   const league=slugs.get(String(item.fixture?.id));
   if(!league)continue;
   for(const t of [item.teams?.home,item.teams?.away]){
    const id=String(t?.id||"");if(!numeric(id))continue;
    const key=league+":"+id;
    if(!targets.has(key))targets.set(key,{key,league,teamId:id,
     teamName:String(t?.name||""),date,source:"FootyEdge sourced fixture"});
   }
  }
 }
 return [...targets.values()];
}
async function targetTeams(previous={}){
 const fixtures=fixtureTeams();
 const todayKeys=new Set(fixtures.filter(x=>x.date===day(0)).map(x=>x.key));
 const targets=new Map(fixtures.map(x=>[x.key,x]));
 const attempts=await inPool([...GOOD_LEAGUES],async league=>{
  const payload=await get(SOURCE+encodeURIComponent(league)+"/teams?limit=1000",7500);
  return {league,teams:parseLeagueTeams(payload,league)};
 },5);
 const coverage={};
 for(let i=0;i<attempts.length;i++){
  const league=[...GOOD_LEAGUES][i],attempt=attempts[i];
  if(!Array.isArray(attempt?.teams)){coverage[league]={status:"unavailable",teams:0};continue;}
  coverage[league]={status:attempt.teams.length?"ok":"empty",teams:attempt.teams.length};
  for(const t of attempt.teams)targets.set(t.key,{...targets.get(t.key),...t});
 }
 if(!targets.size)throw Error("No team directories or fixture-backed team IDs available.");
 // Spread collection capacity across leagues instead of stopping after the
 // first domestic league. Prefer clubs never checked before, then oldest.
 const byLeague=new Map([...GOOD_LEAGUES].map(l=>[l,[]]));
 for(const t of targets.values())byLeague.get(t.league)?.push(t);
 for(const arr of byLeague.values())arr.sort((a,b)=>{
  const x=previous[a.key],y=previous[b.key];
  if(Boolean(x)!==Boolean(y))return x?1:-1;
  const da=Date.parse(x?.checkedAt||"2000-01-01"),db=Date.parse(y?.checkedAt||"2000-01-01");
  return da-db||a.teamName.localeCompare(b.teamName);
 });
 // Prioritize the verified clubs playing today; prior round-robin discovery
 // was mostly researching unrelated rosters while 39 live XIs had no pictures.
 const chosen=[...todayKeys].map(key=>targets.get(key)).filter(Boolean)
   .sort((a,b)=>{
      const ap=previous[a.key],bp=previous[b.key];
      const da=Date.parse(ap?.checkedAt||"2000-01-01"),db=Date.parse(bp?.checkedAt||"2000-01-01");
      return da-db||a.teamName.localeCompare(b.teamName);
   }).slice(0,MAX_TEAMS);
 const priority=new Set(chosen.map(x=>x.key));
 for(const rows of byLeague.values()){
  for(let i=rows.length-1;i>=0;i--)if(priority.has(rows[i].key))rows.splice(i,1);
 }
 while(chosen.length<MAX_TEAMS){
  let progress=false;
  for(const list of byLeague.values()){
   if(chosen.length>=MAX_TEAMS)break;
   if(list.length){chosen.push(list.shift());progress=true;}
  }
  if(!progress)break;
 }
 return {targets:chosen,available:targets.size,coverage};
}
function rosterPlayers(payload){
 const groups=Array.isArray(payload?.athletes)?payload.athletes:[];
 const rows=groups.flatMap(g=>Array.isArray(g?.items)?g.items:
  Array.isArray(g?.athletes)?g.athletes:g?.id||g?.displayName?[g]:[]);
 const unique=new Map();
 for(const entry of rows){
  const a=entry?.athlete||entry;
  const id=String(a?.id||""),name=String(a?.displayName||a?.fullName||a?.name||"").trim();
  if(!numeric(id)||!name||a?.gender==="FEMALE"||unique.has(id))continue;
  const raw=String(a.headshot?.href||"");
  const explicit=/^https:\/\/a\.espncdn\.com\/[a-z0-9._~/?=&%-]+$/i.test(raw)?raw:null;
  unique.set(id,{id,name,explicit});
 }
 return [...unique.values()];
}
async function verifyImage(item){
 const url=item.explicit||CDN+item.id+".png";
 if(!/^https:\/\/a\.espncdn\.com\/[a-z0-9._~/?=&%-]+$/i.test(url))return null;
 try{
  const response=await fetch(url,{headers:{accept:"image/png,image/jpeg,image/webp,image/*"},
   signal:AbortSignal.timeout(3500)});
  if(!response.ok||!/^image\/(png|jpeg|webp)/i.test(response.headers.get("content-type")||""))return null;
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<3000||bytes.length>1_500_000)return null;
  return {id:item.id,name:item.name,url,bytes:bytes.length,
   digest:crypto.createHash("sha256").update(bytes).digest("hex"),
   provider:"ESPN",checkedAt:new Date().toISOString()};
 }catch{return null;}
}
async function main(){
 const current=read("data/player-photo-refs.json")||{schema:"footyedge-player-photo-refs-v1",teams:{}};
 const previous=current.teams||{};
 const discovery=await targetTeams(previous);
 const targets=discovery.targets;
 if(!targets.length)throw Error("No source-backed club rosters available for player-photo collection.");
 const collected=await inPool(targets,async target=>{
  const info=await get(SOURCE+encodeURIComponent(target.league)+"/teams/"+target.teamId+"/roster",5000);
  const players=rosterPlayers(info);
  const photos=await inPool(players,verifyImage,POOL_SIZE);
  return {target,players,photos:photos.filter(x=>x&&x.url)};
 },4);
 // A common blank silhouette is returned under different athlete URLs by some
 // CDNs. Reject matching pixel digests; true duplicate image files are also
 // conservatively excluded until a source explicitly verifies identity.
 const digestIds=new Map();
 for(const entry of collected){
  if(!entry?.photos)continue;
  for(const photo of entry.photos){
   if(!digestIds.has(photo.digest))digestIds.set(photo.digest,new Set());
   digestIds.get(photo.digest).add(photo.id);
  }
 }
 const badDigests=new Set([...digestIds].filter(([,ids])=>ids.size>1).map(([hash])=>hash));
 const teams={...previous};
 let fetched=0,approved=0,discarded=0;
 for(const entry of collected){
  if(!entry?.photos)continue;
  fetched++;
  const {target,photos}=entry;
  const prior=teams[target.key]?.players||{};
  const rosterIds=new Set(entry.players.map(p=>p.id));
  const players=Object.fromEntries(Object.entries(prior).filter(([id])=>rosterIds.has(id)));
  for(const photo of photos){
   if(badDigests.has(photo.digest)){discarded++;continue;}
   approved++;
   players[photo.id]={id:photo.id,name:photo.name,url:photo.url,
    source:"ESPN roster and player-id CDN",verifiedAt:photo.checkedAt,
    sha256:photo.digest};
  }
  teams[target.key]={league:target.league,teamId:target.teamId,
   teamName:target.teamName,source:target.source,
   checkedAt:new Date().toISOString(),
   roster:Object.fromEntries(entry.players.map(p=>[p.id,{name:p.name}])),players};
 }
 if(!fetched)throw Error("ESPN roster collection returned zero readable teams; existing references not replaced.");
 const result={schema:"footyedge-player-photo-refs-v1",checkedAt:new Date().toISOString(),
  policy:"Source URL references only; no third-party image files stored. Player identity matched to roster.",
  collection:{targets:targets.length,allDiscoveredTeams:discovery.available,
   leagueCoverage:discovery.coverage,rostersFetched:fetched,photosChecked:approved,
   duplicatePlaceholderRejected:discarded},teams};
 const file=path.join(ROOT,"data/player-photo-refs.json");
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,JSON.stringify(result,null,2)+"\n");
 const registry={};
 for(const [key,t] of Object.entries(teams)){
  const list=Object.values(t.players||{}).filter(x=>numeric(x.id)&&
   /^https:\/\/a\.espncdn\.com\//.test(x.url)).map(p=>[p.id,p.name,p.url]);
  if(list.length)registry[key]=list;
 }
 fs.writeFileSync(path.join(ROOT,"assets/player-photo-registry.js"),
  "/* Generated ESPN verified roster/image references; no image bytes distributed. */\n"+
  "window.FE_PLAYER_PHOTOS="+JSON.stringify(registry)+";\n");
 console.log(JSON.stringify({date:day(0),...result.collection,teamsIndexed:Object.keys(registry).length,
  playerRefs:Object.values(registry).reduce((n,r)=>n+r.length,0)}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname))
 main().catch(e=>{console.error("Photo collection failed:",e);process.exitCode=1;});
export{targetTeams,rosterPlayers,parseLeagueTeams,fixtureTeams};
