import fs from "node:fs";
import path from "node:path";
import process from "node:process";


const ROOT=process.cwd();
const SITE=(process.env.FOOTYEDGE_URL||"https://footyedge-board.vercel.app").replace(/\/$/,"");
const PERF_DIR=path.join(ROOT,"data","performance");
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
async function verifiedScoreboardFor(date){
  const url=SITE+"/api/espn-scoreboard?dates="+date.replaceAll("-","")+"&limit=1000";
  try{
    const live=await fetchJson(url);
    if(Array.isArray(live.events)&&live.footyedgeSources?.scoreboard?.live!==false)return live;
  }catch(e){console.log("Live settlement scoreboard unavailable:",date,e.message)}
  // Only use date-scoped, actual captured ESPN results; never infer a score.
  const file=path.join(ROOT,"data",date,"scoreboard.json");
  if(fs.existsSync(file)){
    const saved=readJson(file);
    if(Array.isArray(saved.events)){
      console.log("Settling from preserved, date-scoped ESPN snapshot:",date);
      return saved;
    }
  }
  throw new Error("No verified live or saved ESPN scoreboard for "+date);
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
  const handicap=selection.match(/^(.*?)\s+([+-]\d+(?:\.\d+)?)$/);
  if(handicap){
    const team=handicap[1].trim(),line=Number(handicap[2]);
    const diff=norm(team)===norm(event.home)?hs-as:norm(team)===norm(event.away)?as-hs:null;
    if(diff!=null&&Math.abs(line*2-Math.round(line*2))<1e-9){
      if(diff+line===0)return{result:"push",finalScore};
      return hit(diff+line>0);
    }
  }
  return{result:"pending",finalScore};
}
async function settleDailyFile(file){
  const data=readJson(file);
  if(!Array.isArray(data.top5)||!data.top5.some(x=>(x.result||"pending")==="pending"))return false;
  let board;
  try{board=await verifiedScoreboardFor(data.date)}catch(e){console.log("Settlement scoreboard failed:",data.date,e.message);return false}
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
  const yearKey=today.slice(0,4),yearFiles=daily.filter(x=>x.date.startsWith(yearKey)&&x.date<=today);
  const monthKey=today.slice(0,7),monthFiles=daily.filter(x=>x.date.startsWith(monthKey)&&x.date<=today);
  const weekStart=addDays(today,-6),weekFiles=daily.filter(x=>x.date>=weekStart&&x.date<=today);
  const prior=[...daily].filter(x=>x.date<today&&Array.isArray(x.top5)&&x.top5.length).sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
  const monthStats=statsFromFiles(monthFiles),weekStats=statsFromFiles(weekFiles);
  const label=new Date(today+"T12:00:00Z").toLocaleDateString("en-US",{month:"long",timeZone:"UTC"});
  const recentDays=[...daily].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7).map(x=>({date:x.date,...statsFromFiles([x]),top5:x.top5||[]}));
  return{
    generatedAt:new Date().toISOString(),
    trackingStarted:daily.length?daily[0].date:null,
    month:{key:monthKey,label,...monthStats},
    year:{key:yearKey,label:yearKey,...statsFromFiles(yearFiles)},
    week:weekStats,
    byFamily:familyStats(monthFiles),
    previousDate:prior?.date||null,
    previousTop5:prior?.top5||[],
    monthDays:[...monthFiles].sort((a,b)=>b.date.localeCompare(a.date)).map(x=>({date:x.date,...statsFromFiles([x]),top5:x.top5||[]})),
    recentDays
  };
}
function publishedTop5(today){
  const file=path.join(ROOT,"data","boards",today+".json");
  if(!fs.existsSync(file))return null;
  const board=readJson(file);
  if(board.date!==today||board.immutable!==true)throw new Error("Tracker requires immutable published board");
  return (board.top5||[]).map(x=>({rank:x.rank,gameId:x.gameId,home:x.home,away:x.away,
    fixture:x.home+" vs "+x.away,category:x.pick.category,selection:x.pick.label,confidence:x.pick.score,
    odds:x.pick.odds??x.pick.oddsDisplay??null,book:x.pick.provider??null,result:"pending",finalScore:null}));
}

async function main(){
  const nowParts=torontoParts(),today=todayToronto();
  if(!FORCE&&nowParts.hour!=="07"){
    console.log("Skip: Toronto local hour is",nowParts.hour,"not 07");return;
  }

  fs.mkdirSync(PERF_DIR,{recursive:true});

  const dailyFiles=fs.readdirSync(PERF_DIR).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x)).map(x=>path.join(PERF_DIR,x));
  for(const file of dailyFiles)await settleDailyFile(file);

  const boardsDir=path.join(ROOT,"data","boards");
  for(const name of fs.readdirSync(boardsDir).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x))){
    const date=name.slice(0,10);if(date>today)continue;
    const dailyFile=path.join(PERF_DIR,name);
    if(fs.existsSync(dailyFile))continue;
    const top5=publishedTop5(date);
    const board=readJson(path.join(boardsDir,name));
    writeJson(dailyFile,{date,publishedAt:board.publishedAt||null,recordedAt:new Date().toISOString(),source:"Immutable FootyEdge published board",frozen:true,top5});
    console.log("Recorded",top5.length,"original published picks for",date);
    await settleDailyFile(dailyFile);
  }

  writeJson(path.join(PERF_DIR,"summary.json"),buildSummary(today));
  console.log("Performance summary updated.");
}
main().catch(err=>{console.error(err);process.exit(1)});
