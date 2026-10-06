import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const ROOT=process.cwd();
const SITE=(process.env.FOOTYEDGE_URL||"https://footyedge-board.vercel.app").replace(/\/$/,"");
const PERF_DIR=path.join(ROOT,"data","performance");
const MIN_UI_VERSION=Number(process.env.MIN_UI_VERSION||38);
const FORCE=process.env.FORCE_TRACK==="1";

function torontoParts(d=new Date()){
  const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(d);
  return Object.fromEntries(p.map(x=>[x.type,x.value]));
}
function todayToronto(){
  const p=torontoParts();return p.year+"-"+p.month+"-"+p.day;
}
function addDays(s,n){
  const d=new Date(s+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);
}
function norm(v=""){
  return String(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/&/g,"and").replace(/türkiye/g,"turkey").replace(/[^a-z0-9]+/g," ").trim();
}
function fixtureKey(home,away){return norm(home)+"|"+norm(away)}
function readJson(file){return JSON.parse(fs.readFileSync(file,"utf8"))}
function writeJson(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2)+"\n")}
async function fetchJson(url){
  const r=await fetch(url,{headers:{accept:"application/json","user-agent":"FootyEdgeTracker/1.0"}});
  if(!r.ok)throw new Error("HTTP "+r.status+" for "+url);
  return r.json();
}
async function productionVersion(){
  const r=await fetch(SITE+"/picks.html",{headers:{"cache-control":"no-cache","user-agent":"FootyEdgeTracker/1.0"}});
  const html=await r.text();
  const m=html.match(/\/ui\/part0\.html\?v=(\d+)/);
  return m?Number(m[1]):0;
}
function eventInfo(e){
  const c=e?.competitions?.[0]||{},cs=c?.competitors||[];
  const h=cs.find(x=>x.homeAway==="home")||cs[0],a=cs.find(x=>x.homeAway==="away")||cs[1];
  return{
    home:h?.team?.displayName||h?.team?.name||"",
    away:a?.team?.displayName||a?.team?.name||"",
    homeScore:Number(h?.score??0),awayScore:Number(a?.score??0),
    done:Boolean(e?.status?.type?.completed)||String(e?.status?.type?.state||"").toLowerCase()==="post"
  }
}
function settlePick(p,event){
  if(!event?.done)return{result:"pending",finalScore:null};
  const hs=event.homeScore,as=event.awayScore,total=hs+as,selection=String(p.selection||""),category=String(p.category||"").toLowerCase();
  const finalScore=event.home+" "+hs+"-"+as+" "+event.away;
  const hit=r=>({result:r?"hit":"miss",finalScore});

  if(category.includes("match result")||/\sML$/i.test(selection)){
    const team=selection.replace(/\s+ML$/i,"").trim();
    if(norm(team)===norm(event.home))return hit(hs>as);
    if(norm(team)===norm(event.away))return hit(as>hs);
  }
  const totalMatch=selection.match(/\b(Over|Under)\s+(\d+(?:\.\d+)?)\s+Goals?/i);
  if(totalMatch){
    const side=totalMatch[1].toLowerCase(),line=Number(totalMatch[2]);
    if(total===line)return{result:"push",finalScore};
    return hit(side==="over"?total>line:total<line);
  }
  const teamGoals=selection.match(/^(.*?)\s+(\d+)\+\s+Goals?$/i);
  if(teamGoals){
    const team=teamGoals[1].trim(),line=Number(teamGoals[2]),score=norm(team)===norm(event.home)?hs:norm(team)===norm(event.away)?as:null;
    if(score!=null)return hit(score>=line);
  }
  if(category.includes("btts")||/BTTS/i.test(selection)){
    const both=hs>0&&as>0,yes=/yes/i.test(selection);
    return hit(yes?both:!both);
  }
  const dc=selection.match(/^(.*?)\s+or\s+Draw$/i);
  if(dc){
    const team=dc[1].trim();
    if(norm(team)===norm(event.home))return hit(hs>=as);
    if(norm(team)===norm(event.away))return hit(as>=hs);
  }
  return{result:"pending",finalScore};
}
async function settleDailyFile(file){
  const data=readJson(file);
  if(!Array.isArray(data.top5)||!data.top5.some(x=>(x.result||"pending")==="pending"))return false;
  let board;
  try{board=await fetchJson(SITE+"/api/espn-scoreboard?dates="+data.date.replaceAll("-","")+"&limit=1000")}catch(e){console.log("Settlement scoreboard failed:",data.date,e.message);return false}
  const map=new Map((board.events||[]).map(e=>{const x=eventInfo(e);return[fixtureKey(x.home,x.away),x]}));
  let changed=false;
  for(const pick of data.top5){
    if((pick.result||"pending")!=="pending")continue;
    const ev=map.get(fixtureKey(pick.home,pick.away));
    if(!ev)continue;
    const settled=settlePick(pick,ev);
    if(settled.result!=="pending"){
      pick.result=settled.result;pick.finalScore=settled.finalScore;pick.settledAt=new Date().toISOString();changed=true;
    }
  }
  if(changed)writeJson(file,data);
  return changed;
}
function statsFromFiles(files){
  const picks=files.flatMap(x=>x.top5||[]);
  const hits=picks.filter(x=>x.result==="hit").length,misses=picks.filter(x=>x.result==="miss").length;
  const pushes=picks.filter(x=>x.result==="push").length,pending=picks.filter(x=>(x.result||"pending")==="pending").length;
  const settled=hits+misses;
  return{hits,misses,pushes,pending,settled,hitRate:settled?hits/settled*100:null};
}
function trackedFamily(p){
  const cat=String(p?.category||"").toLowerCase(),sel=String(p?.selection||"").toLowerCase();
  if(cat.includes("match result"))return"match_result";
  if(cat.includes("double chance"))return"double_chance";
  if(cat.includes("team goals"))return"team_goals";
  if(cat.includes("btts"))return"btts";
  if(cat.includes("goals"))return sel.includes("under")?"goals_under":"goals_over";
  return cat.replace(/[^a-z0-9]+/g,"_")||"other"
}
function familyStats(files){
  const groups={};
  for(const p of files.flatMap(x=>x.top5||[])){
    const k=trackedFamily(p);(groups[k]||(groups[k]=[])).push(p)
  }
  return Object.fromEntries(Object.entries(groups).map(([k,picks])=>[k,statsFromFiles([{top5:picks}])]))
}
function buildSummary(today){
  const daily=fs.existsSync(PERF_DIR)?fs.readdirSync(PERF_DIR)
    .filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x))
    .map(name=>readJson(path.join(PERF_DIR,name))).sort((a,b)=>a.date.localeCompare(b.date)):[];
  const monthKey=today.slice(0,7),monthFiles=daily.filter(x=>x.date.startsWith(monthKey));
  const weekStart=addDays(today,-6),weekFiles=daily.filter(x=>x.date>=weekStart&&x.date<=today);
  const prior=[...daily].filter(x=>x.date<today&&Array.isArray(x.top5)&&x.top5.length).sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
  const monthStats=statsFromFiles(monthFiles),weekStats=statsFromFiles(weekFiles);
  const label=new Date(today+"T12:00:00Z").toLocaleDateString("en-US",{month:"long",timeZone:"UTC"});
  const recentDays=[...daily].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7).map(x=>({date:x.date,...statsFromFiles([x]),top5:x.top5||[]}));
  return{
    generatedAt:new Date().toISOString(),
    trackingStarted:daily.length?daily[0].date:null,
    month:{key:monthKey,label,...monthStats},
    week:weekStats,
    byFamily:familyStats(monthFiles),
    previousDate:prior?.date||null,
    previousTop5:prior?.top5||[],
    recentDays
  };
}
async function scrapeTop5(today){
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    await page.goto(SITE+"/picks.html",{waitUntil:"domcontentloaded",timeout:90000});
    await page.waitForFunction(()=>{
      const best=document.querySelectorAll(".bestRow").length;
      const text=document.querySelector("#best")?.textContent||"";
      return best>0||/No pick has cleared/i.test(text);
    },{timeout:90000});
    const picks=await page.$$eval(".bestRow",rows=>rows.slice(0,5).map((row,i)=>{
      const fixture=(row.querySelector(".bestFixture")?.textContent||"").trim();
      const parts=fixture.split(/\s+vs\s+/i);
      const oddsBox=row.querySelector(".oddsMetric");
      return{
        rank:i+1,gameId:row.getAttribute("data-game-id")||null,
        home:(parts[0]||"").trim(),away:(parts[1]||"").trim(),
        fixture,league:(row.querySelector(".bestLeague")?.textContent||"").trim(),
        category:(row.querySelector(".bestCategory")?.textContent||"").trim(),
        selection:(row.querySelector(".bestSelection")?.textContent||"").trim(),
        confidence:Number((row.querySelector(".bestConfidence b")?.textContent||"").replace(/[^0-9.]/g,""))||null,
        odds:(oddsBox?.querySelector("b")?.textContent||"").trim()||null,
        book:oddsBox?.querySelector("img.bookLogo")?.getAttribute("alt")||null,
        result:"pending",finalScore:null
      };
    }));
    return picks;
  }finally{await browser.close()}
}

async function main(){
  const nowParts=torontoParts(),today=todayToronto();
  if(!FORCE&&nowParts.hour!=="07"){
    console.log("Skip: Toronto local hour is",nowParts.hour,"not 07");return;
  }
  const version=await productionVersion();
  if(version<MIN_UI_VERSION){
    console.log("Skip: production UI v"+version+" is below required v"+MIN_UI_VERSION);return;
  }
  fs.mkdirSync(PERF_DIR,{recursive:true});

  const dailyFiles=fs.readdirSync(PERF_DIR).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x)).map(x=>path.join(PERF_DIR,x));
  for(const file of dailyFiles)await settleDailyFile(file);

  const todayFile=path.join(PERF_DIR,today+".json");
  if(!fs.existsSync(todayFile)){
    const top5=await scrapeTop5(today);
    writeJson(todayFile,{date:today,publishedAt:new Date().toISOString(),source:"FootyEdge published Top 5",frozen:true,top5});
    console.log("Archived",top5.length,"Top Picks for",today);
  }else{
    console.log("Today's Top 5 already archived; leaving frozen snapshot unchanged.");
  }

  writeJson(path.join(PERF_DIR,"summary.json"),buildSummary(today));
  console.log("Performance summary updated.");
}
main().catch(err=>{console.error(err);process.exit(1)});
