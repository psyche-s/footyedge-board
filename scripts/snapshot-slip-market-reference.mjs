#!/usr/bin/env node
// Bookmaker-context snapshot: ESPN-observed licensed/public feed only, never
// misrepresent this as an Ontario/bet365 executable quote.
import fs from "node:fs/promises";
import path from "node:path";
const nowToronto=()=>Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",
 year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
const t=nowToronto(),date=process.env.SLIPS_DATE||[t.year,t.month,t.day].join("-");
if(!/^\d{4}-\d\d-\d\d$/.test(date))throw Error("Invalid date");
const target=path.join("data","slip-market-snapshots",date+".json");
try{await fs.access(target);console.log("Write-once price review preserved")}catch(e){
 if(e.code!=="ENOENT")throw e;
 const url="https://footyedge-board.vercel.app/api/live-odds?date="+date;
 let raw=null,error=null;
 try{
  const res=await fetch(url,{headers:{accept:"application/json"},signal:AbortSignal.timeout(18000)});
  if(!res.ok)throw Error("HTTP "+res.status);
  const d=await res.json();
  if(d.date!==date||!Array.isArray(d.events)||!Number.isFinite(Date.parse(d.observedAt)))throw Error("Unverified response");
  raw=d;
 }catch(e){error=String(e.message||e)}
 const out={schema:"footyedge-non-ontario-reference-market-snapshot-v1",date,
  capturedAt:new Date().toISOString(),source:"ESPN-reported book quotes",notBet365:true,
  notOntarioVerified:true,combinedBuilderPriceVerified:false,
  state:raw?"observed":"unavailable",error,
  observations:raw?.observedAt||null,
  events:(raw?.events||[]).filter(g=>Array.isArray(g.prices)&&g.prices.length&&
   Date.parse(g.date)>Date.parse(raw.observedAt)).map(g=>({
    id:String(g.id),date:g.date,home:g.home,away:g.away,
    prices:g.prices.filter(x=>Number.isInteger(x.odds)&&x.observedAt&&
      ["draftkings","fanduel","espnbet"].includes(x.bookKey)).map(x=>({
      label:x.label,odds:x.odds,book:x.book,bookKey:x.bookKey,
      observedAt:x.observedAt,source:"ESPN-reported"}))
   }))};
 await fs.mkdir(path.dirname(target),{recursive:true});
 await fs.writeFile(target,JSON.stringify(out,null,2)+"\n");
 console.log("Observations:",out.events.length,"fixtures");
}
