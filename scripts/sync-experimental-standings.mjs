#!/usr/bin/env node
// Supplemental pre-match ESPN table snapshot solely for shadow simulations.
// A missing or stale source never triggers guessed standings.
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
async function main(){
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 const day=process.env.SIMULATION_DATE||parts.year+"-"+parts.month+"-"+parts.day;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error("Invalid day");
 const base=JSON.parse(await fs.readFile(path.join("data","research-base-"+day+".json"),"utf8"));
 if(base.date!==day||!Array.isArray(base.fixtures))throw Error("Dated research required");
 const dest=path.join("data","experimental-inputs",day+"-standings.json");
 try{await fs.access(dest);console.log("Retaining already archived pre-match standing snapshot");return}catch(e){if(e.code!=="ENOENT")throw e}
 const leagues=[...new Set(base.fixtures.map(f=>f.league).filter(x=>/^[a-z]+\.[a-z0-9.]+$/.test(x)))];
 const result={schema:"footyedge-experimental-standing-inputs-v1",date:day,capturedAt:new Date().toISOString(),
  use:"Shadow research only; current-season verified tables are supplemental",leagues:{}};
 const origin=(process.env.FOOTYEDGE_URL||"https://footyedge-board.vercel.app").replace(/\/$/,"");
 if(!/^https:\/\/footyedge-board\.vercel\.app$/i.test(origin))throw Error("Unexpected standings origin");
 const queries=leagues.map(async league=>{
  const season=Number(base.fixtures.find(f=>f.league===league)?.season)||Number(day.slice(0,4));
  const u=origin+"/api/espn-standings?league="+encodeURIComponent(league)+"&season="+season;
  try{
   const response=await fetch(u,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error("HTTP "+response.status);
   const data=await response.json();
   if(data?.status!=="verified"||data.season!==season||data.league!==league||!Array.isArray(data.table)||data.table.length<8)
    throw Error("Season or table unverified");
   const table=data.table.filter(x=>String(x.id)&&Number.isInteger(x.rank)&&x.rank>0
       &&Number.isFinite(x.played)&&x.played>=0&&Number.isFinite(x.points)).map(x=>({
       id:String(x.id),name:String(x.name||""),rank:x.rank,played:x.played,won:x.won,drawn:x.drawn,
       lost:x.lost,points:x.points,gf:x.gf,ga:x.ga}));
   return [league,{source:"ESPN season standings via own verified API",fetchedAt:data.fetchedAt,season,table}];
  }catch(e){return [league,{status:"unavailable",reason:String(e.message||e).slice(0,110)}]}
 });
 for(const [league,value] of await Promise.all(queries))result.leagues[league]=value;
 await fs.mkdir(path.dirname(dest),{recursive:true});
 await fs.writeFile(dest,JSON.stringify(result,null,2)+"\n");
 console.log("Archived experiment-only league standings:",Object.values(result.leagues).filter(x=>x.table?.length).length,"/",leagues.length);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e);process.exitCode=1});
