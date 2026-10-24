#!/usr/bin/env node
// Optional approved match-event provider only. This does not scrape reference websites.
// Output is composed strictly from completed pre-kickoff verified match records.
import fs from "node:fs/promises";
import path from "node:path";
const date=process.env.STYLE_DATE||Object.fromEntries(new Intl.DateTimeFormat("en-CA",
 {timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date())
 .map(x=>[x.type,x.value]));
const day=typeof date==="string"?date:[date.year,date.month,date.day].join("-");
if(!/^\d{4}-\d\d-\d\d$/.test(day))throw Error("Invalid day");
const dest=path.join("data","style-matchups",day+".json");
try{await fs.access(dest);console.log("Retaining verified dated style input");}
catch(err){
 if(err.code!=="ENOENT")throw err;
 const approved=String(process.env.FOOTYEDGE_STYLE_FEED_APPROVED||"").toLowerCase()==="true";
 const endpoint=String(process.env.FOOTYEDGE_STYLE_FEED_URL||"");
 const token=String(process.env.FOOTYEDGE_STYLE_FEED_TOKEN||"");
 if(!approved||!endpoint||!/^https:\/\//.test(endpoint)){
   console.log("No rights-approved style feed enabled. Shots-allowed, tackles and passes remain unavailable when not natively verified.");
 }else{
   const study=JSON.parse(await fs.readFile(path.join("data","research-base-"+day+".json"),"utf8"));
   const byId=new Map(study.fixtures.map(x=>[String(x.id),x]));
   const response=await fetch(endpoint+(endpoint.includes("?")?"&":"?")+"date="+encodeURIComponent(day),
    {headers:{accept:"application/json",...(token?{authorization:"Bearer "+token}:{})},
     signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw Error("Approved style feed failed HTTP "+response.status);
   const data=await response.json();
   if(data.date!==day||!Array.isArray(data.matches))throw Error("Style response date/schema mismatch");
   const metrics=["shots","shotsOnTarget","shotsAllowed","shotsOnTargetAllowed","fouls",
      "foulsWon","corners","yellowCards","tackles","passes"];
   function aggregate(rows,kickoff){
     if(!Array.isArray(rows)||rows.length<5)return null;
     const completed=rows.filter(x=>x&&Date.parse(x.date)<kickoff&&
        Number.isFinite(Date.parse(x.date))&&String(x.status)==="completed"&&
        x.opponentId!=null).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,10);
     if(completed.length<5)return null;
     const seen=new Set(),valid=[];
     for(const r of completed){const key=String(r.eventId||r.date+"|"+r.opponentId);if(seen.has(key))continue;seen.add(key);valid.push(r)}
     if(valid.length<5)return null;
     const out={sample:valid.length,source:"approved match-event feed",
        mostRecent:valid[0].date,oldest:valid.at(-1).date};
     for(const k of metrics){
       const usable=valid.filter(r=>r[k]!==null&&r[k]!==undefined&&
         Number.isFinite(Number(r[k]))&&Number(r[k])>=0&&Number(r[k])<3000);
       if(usable.length<5)continue;
       const vals=usable.map(r=>Number(r[k]));
       out[k+"Avg"]=Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*100)/100;
       out[k+"Sample"]=vals.length;
     }
     return out;
   }
   const matched=[];
   for(const row of data.matches){
     const f=byId.get(String(row.fixtureId));if(!f||f.date==null)continue;
     if(!row.sourceUrl||!/^https:\/\//.test(row.sourceUrl)||!row.licenseApproved)continue;
     const cutoff=Date.parse(f.date);
     const homeStats=aggregate(row.homeMatches,cutoff),awayStats=aggregate(row.awayMatches,cutoff);
     if(!homeStats||!awayStats)continue;
     matched.push({fixtureId:String(f.id),league:f.league,home:f.home.name,away:f.away.name,
       verifiedJoin:true,sources:[row.sourceUrl],homeStats,awayStats});
   }
   const out={schema:"footyedge-licensed-style-matchups-v1",date:day,generatedAt:new Date().toISOString(),
    licensing:"Provider attested; do not republish proprietary raw event rows",matches:matched,
    coverage:{fixtures:study.fixtures.length,matched:matched.length}};
   await fs.mkdir(path.dirname(dest),{recursive:true});
   await fs.writeFile(dest,JSON.stringify(out,null,2)+"\n");
   console.log("Accepted verified event profiles",matched.length,"/",study.fixtures.length);
 }
}
