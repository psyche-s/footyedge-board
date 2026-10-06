import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const SITE=(process.env.FOOTYEDGE_URL||"https://footyedge-board.vercel.app").replace(/\/$/,"");
const TZ="America/Toronto";
const FORCE=process.env.FORCE_ARCHIVE==="1";

function torontoParts(){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false})
    .formatToParts(new Date());
  return Object.fromEntries(parts.map(x=>[x.type,x.value]));
}
const tp=torontoParts();
const DATE=process.env.ARCHIVE_DATE||`${tp.year}-${tp.month}-${tp.day}`;
const HOUR=Number(tp.hour);
const allowedHour=HOUR===7||HOUR===8||HOUR===23;

async function exists(f){try{await fs.access(f);return true}catch{return false}}
async function main(){
  if(!FORCE&&!allowedHour){
    console.log("Skip archive: Toronto hour",HOUR,"is outside capture windows.");
    return;
  }
  const dir=path.join("data","boards"),file=path.join(dir,DATE+".json");
  await fs.mkdir(dir,{recursive:true});
  if(await exists(file)){
    console.log("Archive already exists and is immutable:",file);
    return;
  }

  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1200}});
    await page.goto(SITE+"/picks.html?archiveCapture="+Date.now(),{waitUntil:"networkidle",timeout:120000});
    await page.waitForFunction(()=>typeof window.FootyEdgeArchive==="function",{timeout:120000});
    await page.waitForFunction(()=>{
      try{const x=window.FootyEdgeArchive();return x&&x.date&&Array.isArray(x.games)&&x.games.length>0}catch{return false}
    },{timeout:120000});
    const payload=await page.evaluate(()=>window.FootyEdgeArchive());
    if(!payload||payload.date!==DATE)throw new Error(`Archive date mismatch: expected ${DATE}, got ${payload?.date}`);
    if(!Array.isArray(payload.games)||!payload.games.length)throw new Error("Archive has no games");
    if(!Array.isArray(payload.top5)||payload.top5.length>5)throw new Error("Invalid Top 5 archive");
    payload.capturedBy="GitHub Actions";
    payload.captureUrl=SITE;
    await fs.writeFile(file,JSON.stringify(payload,null,2)+"\n");
    console.log("Archived",DATE,"with",payload.games.length,"games and",payload.top5.length,"Top Picks.");
  }finally{
    await browser.close();
  }
}
main().catch(e=>{console.error(e);process.exit(1)});
