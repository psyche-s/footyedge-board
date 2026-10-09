#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
const p=process.argv.indexOf("--date");
const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
const date=p>=0?process.argv[p+1]:parts.year+"-"+parts.month+"-"+parts.day;
if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Bad date");
async function read(file){try{return JSON.parse(await fs.readFile(file,"utf8"))}catch(e){if(e.code==="ENOENT")return null;throw e}}
const [board,score,odds]=await Promise.all([read("data/boards/"+date+".json"),read("data/"+date+"/scoreboard.json"),read("data/daily-odds-"+date+".json")]);
if(!board){console.log("No board available yet");process.exit(0)}
const es=new Map((score?.events||[]).map(e=>[String(e.id),e]));
const found=[],missing=[];
for(const g of board.games){
 const event=es.get(String(g.id));
 const book=event?.competitions?.[0]?.odds?.find(o=>["DraftKings"].includes(o?.provider?.name||o?.provider?.displayName));
 for(const pick of g.top3||[]){
  const item={fixtureId:String(g.id),match:g.home+" vs "+g.away,market:pick.label,quote:pick.odds??null};
  if(pick.odds!=null){found.push(item);continue}
  const l=String(pick.label).toLowerCase();
  item.reason=/or draw|double chance/.test(l)?"Saved odds do not include Double Chance"
   :/btts|both teams/.test(l)?"Saved odds do not include BTTS"
   :/over |under /.test(l)?"Only the exact posted goal total "+(book?.overUnder??"N/A")+" is available, not this alternative line"
   :/score|assist|shots|player/.test(l)?"No verified individual player-prop quote"
   :"No exact market quote in current saved sportsbook sources";
  missing.push(item);
 }
}
const report={date,selectionCount:found.length+missing.length,priced:found.length,unpriced:missing.length,
 source:"Saved native ESPN/DraftKings + The Odds API daily football snapshot",
 providerDailyEvents:odds?.events?.length??null,
 scope:"1X2 and specifically quoted totals; BTTS, double chance and alternative lines may be absent",
 note:"These are saved morning quotes, not live offers. Never infer a missing adjacent line or manufacture bookmaker odds.",
 availableQuotes:found,missingQuotes:missing};
if(!process.argv.includes("--dry-run")){
 const dir="data/odds-coverage";await fs.mkdir(dir,{recursive:true});
 const file=path.join(dir,date+".json");
 try{await fs.writeFile(file,JSON.stringify(report,null,2)+"\n",{flag:"wx"})}
 catch(e){if(e.code!=="EEXIST")throw e;console.log("Prior audit preserved")}
}
console.log(date+": "+found.length+" priced selections; "+missing.length+" missing exact quotes");
