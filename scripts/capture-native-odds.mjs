import fs from "node:fs/promises";
import path from "node:path";

// One native-bookmaker odds capture per Toronto publication day.
// A retry never refreshes a same-day successful capture, preserving the lock.
const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
const date=parts.year+"-"+parts.month+"-"+parts.day;
const file=path.join("data","daily-odds-"+date+".json");
const groups=[
  ["eng.1","eng.2","tur.1","ksa.1"],
  ["esp.1","ita.1","ger.1","fra.1"],
  ["ned.1","por.1","usa.1","cze.1"]
];
const books=["draftkings","fanduel","espnbet"];
const existing=await fs.readFile(file,"utf8").then(JSON.parse).catch(()=>null);
if(existing&&String(existing.fetchedAt||"").startsWith(date)&&existing.verifiedNativeOnly===true){
  console.log("One-time native odds capture already exists for "+date+"; preserving it.");
}else{
  const site=(process.env.FOOTYEDGE_URL||"https://footyedge-board.vercel.app").replace(/\/$/,"");
  const events=[],attempts=[];
  let anyEnabled=false,quota=null;
  for(const leagues of groups){
    const url=site+"/api/the-odds?live=1&publish=1&date="+encodeURIComponent(date)+"&leagues="+encodeURIComponent(leagues.join(","));
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(65000),headers:{accept:"application/json"}});
      if(!response.ok)throw new Error("HTTP "+response.status);
      const data=await response.json();
      if(data.enabled!==true){attempts.push({leagues,reason:data.reason||"native_source_unavailable"});continue}
      anyEnabled=true;
      if(data.quota)quota=data.quota;
      attempts.push(...(data.attempts||[]));
      for(const event of data.events||[]){
        if(!event||!event.home||!event.away||!event.commenceTime)continue;
        if(event.mlBook?.key&&!books.includes(event.mlBook.key))continue;
        events.push(event);
      }
    }catch(error){
      attempts.push({leagues,error:String(error)});
    }
  }
  const uniq=new Map(events.map(x=>[x.league+"|"+x.home+"|"+x.away,x]));
  const result={
    date,fetchedAt:new Date().toISOString(),status:uniq.size?"partial-ready":"blocked",
    verifiedNativeOnly:true,nativeFormat:"american",bookmakerPriority:books,
    markets:["h2h","totals","spreads"],events:[...uniq.values()],attempts,quota,
    captureMode:"one-time publication or audited recovery",
    note:uniq.size?"Prices are time-stamped at capture; a late recovery is not the original 00:30 quote.":"Native sportsbook markets unavailable. Show No line available; never fill from stale ESPN or estimated odds."
  };
  await fs.writeFile(file,JSON.stringify(result,null,2)+"\n");
  console.log("Native odds capture:",{date,events:uniq.size,anyEnabled,attempts:attempts.length});
}
