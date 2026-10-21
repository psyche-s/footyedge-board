#!/usr/bin/env node
// Optional approved provider bridge for dated predicted lineups and team news.
// The absence of a licensed source is not permission to invent lineups.
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

const today=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{
  timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"
}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 return p.year+"-"+p.month+"-"+p.day;};
const clean=v=>String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .replace(/[^a-z0-9]+/g," ").trim();
const validNames=x=>Array.isArray(x)&&x.length<=11&&x.every(a=>typeof a==="string"&&a.trim().length>=2&&a.length<=90);
const validAbsences=x=>x===undefined||(Array.isArray(x)&&x.length<=35&&x.every(a=>typeof a==="string"&&a.length<=150));
const safeUrl=x=>typeof x==="string"&&/^https:\/\//i.test(x)&&x.length<=1000;
export function verifyNews(data,date,fixtures,now=Date.now()){
 if(data?.schema!=="footyedge-sourced-team-intelligence-v1"||data.date!==date||!Array.isArray(data.fixtures))return [];
 const known=new Map((fixtures||[]).map(f=>[String(f.id),f])),checked=new Set(),kept=[];
 for(const row of data.fixtures){
   const f=known.get(String(row?.fixtureId||""));
   if(!f||checked.has(String(row.fixtureId)))continue;
   const home=String(row.home?.name||""),away=String(row.away?.name||"");
   if(clean(home)!==clean(f.home?.name)||clean(away)!==clean(f.away?.name))continue;
   if(!validNames(row.home?.predictedXI)||!validNames(row.away?.predictedXI)||
      !validAbsences(row.home?.out)||!validAbsences(row.away?.out)||
      !validAbsences(row.home?.doubtful)||!validAbsences(row.away?.doubtful))continue;
   const origin=row.source;
   if(!safeUrl(origin?.url)||!Number.isFinite(Date.parse(origin.checkedAt)))continue;
   const checkedAt=Date.parse(origin.checkedAt);
   if(checkedAt>now+3600000||now-checkedAt>48*3600000)continue;
   const side=(v)=>({...v,lineupStatus:"predicted-not-confirmed",
     predictedXI:v.predictedXI.map(n=>n.trim()),out:v.out||[],doubtful:v.doubtful||[]});
   kept.push({...row,home:side(row.home),away:side(row.away),
     notes:"Predicted lineup, not an official starting XI."});
   checked.add(String(row.fixtureId));
 }
 return kept;
}
async function main(){
 const date=process.env.TEAM_NEWS_DATE||today();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Invalid date");
 const file=path.join("data","team-intelligence",date+".json");
 const base=JSON.parse(await fs.readFile(path.join("data","research-base-"+date+".json"),"utf8"));
 if(base.date!==date)throw Error("Date-matched research required");
 const url=process.env.FOOTYEDGE_TEAM_NEWS_FEED_URL;
 const approved=process.env.FOOTYEDGE_TEAM_NEWS_FEED_APPROVED==="true";
 if(!approved||!safeUrl(url)){
   console.log("Dated team news: approved provider feed not configured. Preserving existing source data; no invented XI.");
   return;
 }
 const u=new URL(url);u.searchParams.set("date",date);
 const headers={Accept:"application/json","User-Agent":"FootyEdgeApprovedTeamNews/1.0"};
 if(process.env.FOOTYEDGE_TEAM_NEWS_FEED_TOKEN)headers.Authorization="Bearer "+process.env.FOOTYEDGE_TEAM_NEWS_FEED_TOKEN;
 let data;
 try{
   const response=await fetch(u,{headers,signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error("HTTP "+response.status);
   data=await response.json();
 }catch(e){console.warn("Team news provider unavailable. Preserving dated cache:",e.message);return;}
 const rows=verifyNews(data,date,base.fixtures);
 if(!rows.length){console.warn("No current, source-verified predicted XI rows. Preserving dated cache.");return;}
 let previous=null;
 try{previous=JSON.parse(await fs.readFile(file,"utf8"));}catch(e){if(e.code!=="ENOENT")throw e;}
 const byId=new Map((previous?.date===date?previous.fixtures:[]||[]).map(x=>[String(x.fixtureId),x]));
 for(const row of rows)byId.set(String(row.fixtureId),row);
 const output={schema:"footyedge-sourced-team-intelligence-v1",date,mode:"pre-match-predicted",
   noLineupClaimsOfConfirmation:true,doNotChangeFrozenPicks:true,generatedAt:new Date().toISOString(),
   fixtures:[...byId.values()]};
 await fs.mkdir(path.dirname(file),{recursive:true});
 await fs.writeFile(file,JSON.stringify(output,null,2)+"\n");
 console.log("Updated source-backed predicted-XI/news rows:",rows.length,"/ total",output.fixtures.length);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
 main().catch(e=>{console.error(e);process.exitCode=1});
