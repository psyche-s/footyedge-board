#!/usr/bin/env node
// Export ONLY CC0-completed scores from private Football Data Hub to public
// FootyEdge. The GitHub token never reaches the browser or committed files.
// Without a read-only hub token, keep already-imported older seasons and
// update the current/previous seasons directly from public OpenFootball.
import fs from "node:fs/promises";
import {createHash} from "node:crypto";
import path from "node:path";

const ROOT=process.cwd(),DEST=path.join(ROOT,"data","football-hub");
const SOURCE="psyche-s/football-data-hub";
const UPSTREAM="https://raw.githubusercontent.com/openfootball/football.json/master";
const COMP=Object.freeze({"en.1":"eng.1","en.2":"eng.2","de.1":"ger.1","es.1":"esp.1","fr.1":"fra.1","it.1":"ita.1","nl.1":"ned.1","pt.1":"por.1","tr.1":"tur.1"});
const token=process.env.FOOTBALL_DATA_HUB_TOKEN||"";
function isoToday(now=new Date()){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return p.year+"-"+p.month+"-"+p.day}
function validateSource(doc,code){
 if(!doc||doc.source!=="openfootball/football.json"||doc.license!=="CC0-1.0"||doc.competition_id!==code||!Array.isArray(doc.matches))throw Error("Rejected untrusted or unlicensed match source "+code);
 return true;
}
function toCompact(game,today){
 const [hs,as]=game?.score?.full_time||[];
 if(game?.status!=="final"||typeof game.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(game.date)||game.date>=today||
    !Number.isInteger(hs)||!Number.isInteger(as)||Math.min(hs,as)<0||Math.max(hs,as)>20||
    typeof game.id!=="string"||typeof game.home_name!=="string"||typeof game.away_name!=="string")return null;
 return {id:game.id,d:game.date,h:game.home_name,a:game.away_name,hi:game.home_team_id,ai:game.away_team_id,hs,as,s:game.season};
}
const COUNTRIES={"en.1":"England","en.2":"England","de.1":"Germany","es.1":"Spain","fr.1":"France","it.1":"Italy","nl.1":"Netherlands","pt.1":"Portugal","tr.1":"Turkey"};
function slug(s){return String(s).normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"unknown";}
function toCompactPublic(game,code,season,today){
 if(!game||typeof game.team1!=="string"||!game.team1.trim()||typeof game.team2!=="string"||!game.team2.trim())return null;
 const [hs,as]=game?.score?.ft||[];
 if(!Number.isInteger(hs)||!Number.isInteger(as)||Math.min(hs,as)<0||Math.max(hs,as)>20||typeof game.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(game.date)||game.date>=today)return null;
 const home=game.team1.trim(),away=game.team2.trim();
 const hash=createHash("sha256").update(["openfootball/football.json",season,code,home,away,String(game.round||"")].join("\x1f")).digest("hex").slice(0,24);
 const country=slug(COUNTRIES[code]);
 return {id:"of:"+hash,d:game.date,h:home,a:away,hi:"club:"+country+":"+slug(home),ai:"club:"+country+":"+slug(away),hs,as,s:season};
}
function mergeGames(old,newRows,today){
 const all=new Map();
 for(const game of [...old,...newRows]){
   if(!game||typeof game.id!=="string"||typeof game.d!=="string"||game.d>=today||!Number.isInteger(game.hs)||!Number.isInteger(game.as))continue;
   all.set(game.id,game);
 }
 return [...all.values()].sort((a,b)=>a.d.localeCompare(b.d)||a.id.localeCompare(b.id));
}
async function getJson(url,auth){
 let response;
 for(let n=0;n<3;n++){
   response=await fetch(url,{headers:{"Accept":"application/vnd.github+json","User-Agent":"FootyEdge-CC0-History/1.0",...(auth?{Authorization:"Bearer "+auth}:{})},signal:AbortSignal.timeout(25000)});
   if(response.status===404)return null;
   if(response.ok)break;
   if(![429,500,502,503,504].includes(response.status)||n===2)throw Error("Historical source HTTP "+response.status+" "+new URL(url).pathname);
   await new Promise(resolve=>setTimeout(resolve,500*(n+1)));
 }
 return response.json();
}
async function getPrivateFile(file,sha){
 const uri="https://api.github.com/repos/"+SOURCE+"/contents/"+file+"?ref="+sha;
 const body=await getJson(uri,token);
 if(!body)return null;
 if(body.encoding!=="base64"||typeof body.content!=="string")throw Error("Unexpected private file encoding");
 return JSON.parse(Buffer.from(body.content.replace(/\s/g,""),"base64").toString("utf8"));
}
async function atomicWrite(filename,doc){
 const content=JSON.stringify(doc)+"\n";
 let previous=null;try{previous=await fs.readFile(filename,"utf8")}catch(error){if(error.code!=="ENOENT")throw error}
 if(previous===content)return false;
 await fs.mkdir(path.dirname(filename),{recursive:true});
 await fs.writeFile(filename+".tmp",content,"utf8");
 await fs.rename(filename+".tmp",filename);
 return true;
}
function recentYears(today){
 const y=Number(today.slice(0,4)),m=Number(today.slice(5,7)),first=m>=7?y:y-1;
 return [first-1,first].map(n=>n+"-"+String(n+1).slice(-2));
}
function historicYears(today,fromYear=2015){
 const y=Number(today.slice(0,4)),month=Number(today.slice(5,7)),latest=month>=7?y:y-1;
 if(!Number.isInteger(fromYear)||fromYear<1900||fromYear>latest)throw Error("Invalid historical starting year");
 return Array.from({length:latest-fromYear+1},(_,index)=>{const start=fromYear+index;return start+"-"+String(start+1).slice(-2)});
}
function plannedPublicYears(today,oldManifest,mode="daily",fromYear=2015){
 const recent=recentYears(today),all=historicYears(today,fromYear),older=all.filter(s=>!recent.includes(s));
 if(mode==="full")return [...new Set([...older,...recent])];
 if(mode!=="daily")throw Error("Unrecognized history sync mode");
 const done=new Set(Array.isArray(oldManifest?.attemptedHistoricSeasons)?oldManifest.attemptedHistoricSeasons:[]);
 const next=older.find(s=>!done.has(s));
 return [...new Set([...(next?[next]:[]),...recent])];
}
async function main(){
 const today=isoToday();
 const oldManifest=await fs.readFile(path.join(DEST,"manifest.json"),"utf8").then(JSON.parse).catch(error=>{
   if(error.code==="ENOENT")return null;
   throw new Error("Historical manifest unreadable: "+error.message);
 });
 const warehouse=Boolean(token),mode=process.env.HUB_HISTORY_MODE||"daily",startYear=Number(process.env.HUB_HISTORY_START_YEAR||"2015");
 let specs=[],sha=null,publicYears=[];
 if(warehouse){
   const ref=await getJson("https://api.github.com/repos/"+SOURCE+"/git/ref/heads/main",token);
   sha=ref?.object?.sha;
   if(!/^[a-f0-9]{40}$/.test(sha||""))throw Error("Missing private hub revision; no files modified");
   const manifest=await getPrivateFile("data/manifest.json",sha);
   if(!manifest||!Array.isArray(manifest.files)||!manifest.licenses?.some(s=>String(s).includes("CC0")))throw Error("Private hub manifest not validated");
   specs=manifest.files.filter(f=>Object.hasOwn(COMP,f.competition_id)&&/^data\/matches\/\d{4}-\d{2}\/[a-z]{2}\.\d\.json$/.test(f.path))
     .map(f=>({code:f.competition_id,uri:f.path}));
 }else{
   console.warn("FOOTBALL_DATA_HUB_TOKEN not configured: refreshing current/previous seasons from public CC0 OpenFootball; older Hub archive remains preserved.");
   publicYears=plannedPublicYears(today,oldManifest,mode,startYear);
   specs=Object.keys(COMP).flatMap(code=>publicYears.map(season=>({code,uri:season+"/"+code+".json"})));
   console.log("Public-domain backfill: "+publicYears.join(", ")+", mode="+mode);
 }
 const grouped=new Map();let seenFiles=0;
 for(const file of specs){
   let doc;
   try{
     doc=warehouse?await getPrivateFile(file.uri,sha):await getJson(UPSTREAM+"/"+file.uri);
     if(doc===null)continue;
     if(warehouse)validateSource(doc,file.code);
     else if(!doc||!Array.isArray(doc.matches))throw Error("Unexpected public OpenFootball schema");
   }catch(error){
     console.warn("Source fetch skipped for "+file.uri+" ("+error.message+"); retaining previous archive");
     continue;
   }
   let result=grouped.get(file.code)||[];
   const season=file.uri.split("/")[0];
   for(const match of doc.matches){
     const row=warehouse?toCompact(match,today):toCompactPublic(match,file.code,season,today);
     if(row)result.push(row);
   }
   grouped.set(file.code,result);seenFiles++;
 }
 if(!seenFiles)throw Error("No verified CC0 source files fetched. Existing mirror preserved.");
 let totals=0,changes=0,leagues=[];
 for(const [up,code] of Object.entries(COMP)){
   const file=path.join(DEST,code+".json");
   let prior=null;try{prior=JSON.parse(await fs.readFile(file,"utf8"))}catch(error){if(error.code!=="ENOENT")throw Error("Malformed existing hub mirror: "+file)}
   if(prior&&!(prior.schema==="footyedge-history-v1"&&prior.license==="CC0-1.0"&&prior.competition===code))throw Error("Existing source verification failed");
   const newRows=grouped.get(up)||[];
   if(!newRows.length&&!prior)continue;
   const games=mergeGames(prior?.games||[],newRows,today);
   const doc={schema:"footyedge-history-v1",competition:code,license:"CC0-1.0",originalSource:"OpenFootball/football.json",
     warehouseSource:SOURCE,warehouseRevision:sha||prior?.warehouseRevision||null,
     throughDateExclusive:today,games};
   changes+=Number(await atomicWrite(file,doc));
   totals+=games.length;leagues.push({league:code,games:games.length});
 }
 const manifest={schema:"footyedge-history-manifest-v1",license:"CC0-1.0",
   originalSource:"OpenFootball/football.json",warehouseRevision:sha,throughDateExclusive:today,
   syncMode:warehouse?"private-hub-read-only":mode==="full"?"public-openfootball-full-backfill":"public-openfootball-incremental",
   attemptedHistoricSeasons:warehouse?oldManifest?.attemptedHistoricSeasons||[]:[
     ...new Set([...(oldManifest?.attemptedHistoricSeasons||[]),
       ...publicYears.filter(year=>!recentYears(today).includes(year))])].sort(),
   notes:"Only completed CC0 match scores, before current Toronto date. All other providers remain separate. No private entity mappings, unreviewed logos, odds, picks or player data.",
   totalCompleted:totals,leagues};
 changes+=Number(await atomicWrite(path.join(DEST,"manifest.json"),manifest));
 console.log("Verified CC0 archive: "+totals+" completed matches, "+leagues.length+" leagues, "+changes+" changed files; mode="+manifest.syncMode);
}
export{isoToday,validateSource,toCompact,toCompactPublic,mergeGames,recentYears,historicYears,plannedPublicYears};
if(process.argv[1]&&import.meta.url===new URL("file://"+path.resolve(process.argv[1])).href){
 main().catch(error=>{console.error("History sync failed:",error.message);process.exitCode=1});
}
