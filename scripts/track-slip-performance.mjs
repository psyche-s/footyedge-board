#!/usr/bin/env node
// Grade the entire published FootyEdge slips, without modifying dated tips.
// Score-based legs use verified final match results. Player stats require an
// independently verified leg-result record; unavailable metrics remain pending.
import fs from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";

const ROOT=process.cwd();
const TORONTO="America/Toronto";
const DIR=path.join(ROOT,"data","performance","slips");
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:TORONTO,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()).replaceAll("/","-");
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const exists=p=>fs.existsSync(p);
const write=(p,value)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(value,null,2)+"\n")};
const norm=v=>String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const matchKey=(h,a)=>norm(h)+"|"+norm(a);
function dayOffset(date,n){const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function eventInfo(e){
  const cs=e?.competitions?.[0]?.competitors||[];
  const h=cs.find(x=>x.homeAway==="home"),a=cs.find(x=>x.homeAway==="away");
  const number=v=>{const n=Number(typeof v==="object"&&v!==null?v.value??v.displayValue:v);return Number.isInteger(n)&&n>=0?n:null};
  return {id:String(e.id||""),home:h?.team?.displayName||"",away:a?.team?.displayName||"",
    hs:number(h?.score),as:number(a?.score),
    completed:Boolean(e?.status?.type?.completed)||String(e?.status?.type?.state||"").toLowerCase()==="post"};
}
export function scoreLeg(leg,event){
  if(!event?.completed||!Number.isInteger(event.hs)||!Number.isInteger(event.as))return "pending";
  const label=String(leg.label||""),cat=norm(leg.category||""),h=event.home,a=event.away,hs=event.hs,as=event.as;
  const answer=x=>x?"hit":"miss";
  const teamScore=name=>norm(name)===norm(h)?hs:norm(name)===norm(a)?as:null;
  if(/\bML$/i.test(label)){
    const n=teamScore(label.replace(/\s+ML$/i,""));
    if(n!==null)return answer(n>(n===hs?as:hs));
  }
  let m=label.match(/^(.*?)\s+or\s+Draw$/i);
  if(m){const n=teamScore(m[1]);if(n!==null)return answer(n>=(n===hs?as:hs));}
  m=label.match(/^(.*?)\s+(Over|Under)\s+(\d+(?:\.\d+)?)\s+Team Goals?$/i);
  if(m){const n=teamScore(m[1]);if(n!==null){const line=Number(m[3]);return n===line?"push":answer(m[2].toLowerCase()==="over"?n>line:n<line);}}
  m=label.match(/^(.*?)\s+(\d+)\+\s+Goals?$/i);
  if(m){const n=teamScore(m[1]);if(n!==null)return answer(n>=Number(m[2]));}
  m=label.match(/\b(Over|Under)\s+(\d+(?:\.\d+)?)\s+Goals?/i);
  if(m){const total=hs+as,line=Number(m[2]);return total===line?"push":answer(m[1].toLowerCase()==="over"?total>line:total<line);}
  if(cat==="btts"||/\bBTTS\b/i.test(label))return answer(/yes/i.test(label)?hs>0&&as>0:hs===0||as===0);
  m=label.match(/^(.*?)\s+([+-]\d+(?:\.\d+)?)$/);
  if(m){const n=teamScore(m[1]);if(n!==null){const d=n-(n===hs?as:hs)+Number(m[2]);return d===0?"push":answer(d>0);}}
  return "pending";
}
export function settleTicket(legs){
  const grades=legs.map(x=>x.result||"pending");
  if(grades.includes("miss"))return "miss";
  if(grades.some(x=>x==="pending"))return "pending";
  if(grades.length===0)return "pending";
  if(grades.every(x=>x==="hit"))return "hit";
  if(grades.every(x=>["hit","push"].includes(x)))return "push";
  return "pending";
}
const ticketsOf=d=>{
  const candidates=[];
  if(d?.sgp?.status==="qualified"&&d.sgp.legs?.length)candidates.push({id:"sgp",type:"sgp",league:null,legs:d.sgp.legs});
  if(d?.acca?.status==="qualified"&&d.acca.legs?.length)candidates.push({id:"acca",type:"acca",league:null,legs:d.acca.legs});
  for(const s of d?.sgpsByLeague||[]){
    if(s.status==="qualified"&&s.legs?.length)candidates.push({id:"league:"+s.league,type:"league_sgp",league:s.league,legs:s.legs});
  }
  const seen=new Map();
  return candidates.map(s=>{
    const signature=s.legs.map(x=>String(x.gameId||"")+"|"+norm(x.label)).sort().join("||");
    const duplicateOf=seen.get(signature)||null;if(!duplicateOf)seen.set(signature,s.id);
    return {...s,duplicateOf,legs:s.legs.map(x=>({gameId:String(x.gameId||""),fixture:String(x.fixture||""),label:String(x.label||""),category:String(x.category||""),result:"pending"})),result:"pending"};
  });
};
function sourceFor(date){
  if(!exists(path.join(ROOT,"data","boards",date+".json")))return null;
  const d1=path.join(ROOT,"data","editorial-desk",date+".json"),d2=path.join(ROOT,"data","slips",date+".json");
  if(exists(d1))return {path:d1,data:read(d1)};
  if(exists(d2))return {path:d2,data:read(d2)};
  return null;
}
async function finalResultsFor(date){
  const events=new Map();
  const add=d=>{for(const e of d?.events||[]){
    const info=eventInfo(e);if(!info.id)continue;
    const prior=events.get(info.id);
    if(!prior||(info.completed&&info.hs!==null&&info.as!==null&&!prior.completed))events.set(info.id,info);
  }};
  for(const delta of [-1,0,1]){
    const day=dayOffset(date,delta),p=path.join(ROOT,"data",day,"scoreboard.json");
    if(exists(p)){try{add(read(p));}catch{}}
  }
  for(const delta of [-1,0,1]){
    const day=dayOffset(date,delta);
    try{
      const url="https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates="+day.replaceAll("-","")+"&limit=1000";
      const response=await fetch(url,{signal:AbortSignal.timeout(11000),headers:{"User-Agent":"FootyEdgeSlipTracker/1.0"}});
      if(response.ok)add(await response.json());
    }catch(e){console.warn("Result source unavailable",day,String(e.message).slice(0,120));}
  }
  return [...events.values()].filter(x=>x.completed&&x.hs!==null&&x.as!==null);
}
function reviewedLegResults(date){
  const p=path.join(ROOT,"data","verified-leg-results",date+".json");
  if(!exists(p))return new Map();
  const d=read(p),results=new Map();
  if(d.date!==date||!Array.isArray(d.results))throw Error("Invalid verified leg-results file "+date);
  for(const r of d.results){
    if(!r.gameId||!r.label||!["hit","miss","push"].includes(r.result)||
       !/^https:\/\//.test(String(r.sourceUrl||""))||!Number.isFinite(Date.parse(r.verifiedAt)))continue;
    results.set(String(r.gameId)+"|"+norm(r.label),r);
  }
  return results;
}
export function summaryOf(items){
  const unique=items.filter(x=>!x.duplicateOf);
  const hits=unique.filter(x=>x.result==="hit").length,misses=unique.filter(x=>x.result==="miss").length;
  const pushes=unique.filter(x=>x.result==="push").length,pending=unique.filter(x=>x.result==="pending").length;
  return {hits,misses,pushes,pending,settled:hits+misses,hitRate:hits+misses?Math.round(hits/(hits+misses)*10000)/100:null};
}
async function run(){
  const dateToday=today();fs.mkdirSync(DIR,{recursive:true});
  const days=new Set();
  for(const kind of ["editorial-desk","slips"]){
    const loc=path.join(ROOT,"data",kind);
    if(!exists(loc))continue;
    for(const name of fs.readdirSync(loc))if(/^\d{4}-\d{2}-\d{2}\.json$/.test(name)&&name.slice(0,10)<dateToday)days.add(name.slice(0,10));
  }
  for(const day of [...days].sort()){
    const file=path.join(DIR,day+".json");
    let snapshot;
    if(exists(file))snapshot=read(file);
    else {
      const published=sourceFor(day);
      if(!published||published.data.date!==day)continue;
      snapshot={date:day,source:published.path.replace(ROOT+path.sep,""),capturedAt:new Date().toISOString(),tickets:ticketsOf(published.data)};
    }
    if(!snapshot.tickets.some(t=>t.result==="pending")){if(!exists(file))write(file,snapshot);continue;}
    const games=await finalResultsFor(day),byId=new Map(games.map(x=>[x.id,x])),byTeams=new Map(games.map(x=>[matchKey(x.home,x.away),x]));
    const verified=reviewedLegResults(day);
    for(const ticket of snapshot.tickets){
      if(ticket.result!=="pending")continue;
      for(const leg of ticket.legs){
        if(leg.result!=="pending")continue;
        const manual=verified.get(leg.gameId+"|"+norm(leg.label));
        if(manual){leg.result=manual.result;leg.verifiedSource=manual.sourceUrl;continue;}
        let game=byId.get(leg.gameId);
        if(!game&&leg.fixture.includes(" vs ")){
          const sides=leg.fixture.split(" vs ");if(sides.length===2)game=byTeams.get(matchKey(sides[0],sides[1]));
        }
        if(game)leg.result=scoreLeg(leg,game);
      }
      ticket.result=settleTicket(ticket.legs);
      if(ticket.result!=="pending")ticket.settledAt=new Date().toISOString();
    }
    write(file,snapshot);
  }
  const docs=fs.readdirSync(DIR).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x))
    .map(x=>read(path.join(DIR,x))).filter(x=>x.date<=dateToday);
  const scope=(prefix)=>summaryOf(docs.filter(x=>x.date.startsWith(prefix)).flatMap(x=>x.tickets||[]));
  const month=dateToday.slice(0,7),year=dateToday.slice(0,4);
  const slipStats={trackingType:"entire-parlay-outcomes",generatedAt:new Date().toISOString(),month:{key:month,...scope(month)},
    year:{key:year,...scope(year)},
    recentDays:docs.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,14)
      .map(x=>({date:x.date,...summaryOf(x.tickets||[]),tickets:(x.tickets||[]).map(t=>({id:t.id,type:t.type,league:t.league,result:t.result,duplicateOf:t.duplicateOf,legResults:t.legs.map(l=>({label:l.label,result:l.result}))}))})),
    note:"Each distinct posted slip counts once, not each leg. Unverified shots, fouls and other player markets stay pending."};
  write(path.join(DIR,"summary.json"),slipStats);
  const overallPath=path.join(ROOT,"data","performance","summary.json");
  if(exists(overallPath)){const prior=read(overallPath);prior.slips=slipStats;write(overallPath,prior);}
  console.log("Whole-slip performance: "+JSON.stringify({month:slipStats.month,year:slipStats.year}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)run().catch(e=>{console.error(e);process.exitCode=1});
