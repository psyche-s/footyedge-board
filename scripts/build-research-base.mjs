import '../assets/board-availability.js';
import fs from "node:fs/promises";
import path from "node:path";
import {evaluatePlayerProps} from "./player-prop-research.mjs";
import {loadCzechSeason,eventsForCzechDate} from "../assets/czech-first-league.mjs";

const SITE=(process.env.FOOTYEDGE_URL||"https://footyedge-board.vercel.app").replace(/\/$/,"");
const TZ="America/Toronto";

const TRACKED=new Set([
  "uefa.nations","fifa.friendly","concacaf.nations.league","uefa.champions","uefa.europa","uefa.europa.conf",
  "cze.1","eng.1","eng.2","tur.1","ksa.1","esp.1","ita.1","ger.1","fra.1","ned.1","por.1","usa.1",
  "uefa.euro","uefa.euroq","fifa.world","fifa.worldq.uefa","fifa.worldq.conmebol","fifa.worldq.concacaf"
]);

function torontoDate(){
  const p=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"})
    .formatToParts(new Date());
  const o=Object.fromEntries(p.map(x=>[x.type,x.value]));
  return `${o.year}-${o.month}-${o.day}`;
}
function torontoHour(){
  return new Intl.DateTimeFormat("en-CA",{timeZone:TZ,hour:"2-digit",hour12:false}).format(new Date());
}
const DATE=process.env.RESEARCH_DATE||torontoDate();
const FORCE=process.env.FORCE_RESEARCH==="1";
const key=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const pct=(n,d)=>d?Math.round(n/d*100):null;
const scoreVal=v=>{const n=Number(typeof v==="object"&&v?v.value??v.displayValue:v);return Number.isFinite(n)?n:null};

async function json(url){
  const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{Accept:"application/json","User-Agent":"FootyEdge Research Bot/1.0"}});
  if(!r.ok)throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}
function leagueOf(e){return globalThis.FootyEdgeAvailability.leagueOf(e)}
function fixtureInfo(e){
  if(globalThis.FootyEdgeAvailability.excludedTaggedEvent?.(e))return null;
  const c=e?.competitions?.[0]||{},cs=c.competitors||[];
  const h=cs.find(x=>x.homeAway==="home")||cs[0],a=cs.find(x=>x.homeAway==="away")||cs[1];
  const league=leagueOf(e);
  if(!h||!a||!TRACKED.has(league))return null;
  return{
    id:String(e.id),date:e.date,league,
    season:Number(e?.season?.year||DATE.slice(0,4)),
    home:{id:String(h?.id??h?.team?.id??""),name:h?.team?.displayName||"Home"},
    away:{id:String(a?.id??a?.team?.id??""),name:a?.team?.displayName||"Away"}
  };
}
function history(payload,teamId,before){
  const out=[];
  for(const e of payload?.events||[]){
    if(!e?.date||new Date(e.date)>=new Date(before)||!(e.status?.type?.completed||e.competitions?.[0]?.status?.type?.completed))continue;
    const cs=e?.competitions?.[0]?.competitors||[];
    const me=cs.find(c=>String(c?.id??c?.team?.id)===String(teamId));
    const op=cs.find(c=>String(c?.id??c?.team?.id)!==String(teamId));
    if(!me||!op)continue;
    const gf=scoreVal(me.score),ga=scoreVal(op.score);
    if(gf==null||ga==null)continue;
    out.push({
      id:String(e.id),date:e.date,venue:me.homeAway==="away"?"away":"home",
      gf,ga,league:leagueOf(e),result:gf>ga?"W":gf<ga?"L":"D",
      oppId:String(op?.id??op?.team?.id??""),oppName:op?.team?.displayName||"Opponent"
    });
  }
  const seen=new Set();
  return out.sort((a,b)=>new Date(b.date)-new Date(a.date))
    .filter(x=>!seen.has(x.id)&&seen.add(x.id)).slice(0,10);
}
function run(items,fn){let n=0;for(const x of items){if(!fn(x))break;n++}return n}
function record(items){return{
  w:items.filter(x=>x.result==="W").length,
  d:items.filter(x=>x.result==="D").length,
  l:items.filter(x=>x.result==="L").length
}}
function addFact(out,text,tags,evidence,priority=0){
  if(!text)return;
  const k=key(text);
  if(out.some(x=>key(x.text)===k))return;
  out.push({text,tags:[...new Set(tags)],evidence,priority});
}
function teamFacts(name,items,venue){
  const out=[],n=Math.min(10,items.length),s=items.slice(0,n);
  if(n<3)return out;
  const r=record(s),winless=run(s,x=>x.result!=="W"),unbeaten=run(s,x=>x.result!=="L");
  const scoreless=run(s,x=>x.gf===0),concededRun=run(s,x=>x.ga>0),clean=s.filter(x=>x.ga===0).length;
  const failed=s.filter(x=>x.gf===0).length,u25=s.filter(x=>x.gf+x.ga<=2).length,u35=s.filter(x=>x.gf+x.ga<=3).length;
  const o15=s.filter(x=>x.gf+x.ga>=2).length,o25=s.filter(x=>x.gf+x.ga>=3).length,btts=s.filter(x=>x.gf>0&&x.ga>0).length;
  addFact(out,`${name} are ${r.w}-${r.d}-${r.l} across their last ${n} matches.`,["form","result"],{type:"record",sample:n,w:r.w,d:r.d,l:r.l},1);
  if(winless>=4)addFact(out,`${name} are winless in their last ${winless} matches.`,["form","result"],{type:"streak",metric:"winless",games:winless},5);
  else if(unbeaten>=4)addFact(out,`${name} are unbeaten in their last ${unbeaten} matches.`,["form","result"],{type:"streak",metric:"unbeaten",games:unbeaten},5);
  if(scoreless>=3)addFact(out,`${name} have failed to score in ${scoreless} straight matches.`,["team goals","btts","under"],{type:"streak",metric:"scoreless",games:scoreless},6);
  else if(n>=5&&failed>=Math.ceil(n*.5))addFact(out,`${name} failed to score in ${failed} of their last ${n} matches.`,["team goals","btts","under"],{type:"rate",metric:"failed_to_score",hits:failed,sample:n},5);
  if(concededRun>=4)addFact(out,`${name} have conceded in ${concededRun} straight matches.`,["defense","team goals","btts"],{type:"streak",metric:"conceded",games:concededRun},4);
  if(n>=5&&clean>=Math.ceil(n*.5))addFact(out,`${name} kept a clean sheet in ${clean} of their last ${n} matches.`,["defense","btts"],{type:"rate",metric:"clean_sheet",hits:clean,sample:n},4);
  if(n>=5&&u25>=Math.ceil(n*.7))addFact(out,`${u25} of ${name}'s last ${n} matches finished under 2.5 goals.`,["under"],{type:"rate",metric:"under_2_5",hits:u25,sample:n},5);
  else if(n>=5&&u35>=Math.ceil(n*.8))addFact(out,`${u35} of ${name}'s last ${n} matches finished under 3.5 goals.`,["under"],{type:"rate",metric:"under_3_5",hits:u35,sample:n},4);
  if(n>=5&&o25>=Math.ceil(n*.7))addFact(out,`${o25} of ${name}'s last ${n} matches produced over 2.5 goals.`,["over"],{type:"rate",metric:"over_2_5",hits:o25,sample:n},5);
  else if(n>=5&&o15>=Math.ceil(n*.8))addFact(out,`${o15} of ${name}'s last ${n} matches produced at least two goals.`,["over"],{type:"rate",metric:"over_1_5",hits:o15,sample:n},4);
  if(n>=5&&btts>=Math.ceil(n*.7))addFact(out,`Both teams scored in ${btts} of ${name}'s last ${n} matches.`,["btts"],{type:"rate",metric:"btts",hits:btts,sample:n},4);
  const split=s.filter(x=>x.venue===venue);
  if(split.length>=4){
    const sr=record(split),loc=venue==="home"?"home":"away";
    if(sr.w>=Math.ceil(split.length*.65))addFact(out,`${name} won ${sr.w} of their last ${split.length} ${loc} matches in this sample.`,["form","result",loc],{type:"split",venue,w:sr.w,d:sr.d,l:sr.l,sample:split.length},4);
    if(sr.w===0&&split.length>=4)addFact(out,`${name} are winless across their last ${split.length} ${loc} matches in this sample.`,["form","result",loc],{type:"split",venue,w:0,d:sr.d,l:sr.l,sample:split.length},4);
  }
  return out
}
function h2hFacts(g,homeHist){
  const out=[],h=homeHist.filter(x=>String(x.oppId)===String(g.away.id)).slice(0,5),n=h.length;
  if(n<2)return out;
  const r=record(h),u25=h.filter(x=>x.gf+x.ga<=2).length,u35=h.filter(x=>x.gf+x.ga<=3).length,btts=h.filter(x=>x.gf>0&&x.ga>0).length;
  addFact(out,`Last ${n} H2Hs: ${g.home.name} ${r.w} wins, ${g.away.name} ${r.l} wins, ${r.d} draws.`,["h2h","result"],{type:"h2h_record",sample:n,homeWins:r.w,awayWins:r.l,draws:r.d},6);
  if(u25>=Math.ceil(n*.6))addFact(out,`${u25} of the last ${n} H2Hs finished under 2.5 goals.`,["h2h","under"],{type:"h2h_rate",metric:"under_2_5",hits:u25,sample:n},6);
  else if(u35>=Math.ceil(n*.8))addFact(out,`${u35} of the last ${n} H2Hs finished under 3.5 goals.`,["h2h","under"],{type:"h2h_rate",metric:"under_3_5",hits:u35,sample:n},5);
  if(btts>=Math.ceil(n*.7))addFact(out,`Both teams scored in ${btts} of the last ${n} H2Hs.`,["h2h","btts"],{type:"h2h_rate",metric:"btts",hits:btts,sample:n},5);
  return out
}
function marketSignals(facts,g){
  const count=tag=>facts.filter(f=>f.tags.includes(tag)).reduce((s,f)=>s+Math.max(1,f.priority||1),0);
  const sig=[];
  if(count("under")>=8)sig.push("Under 3.5 Goals");
  if(count("over")>=8)sig.push("Over 1.5 Goals");
  if(count("btts")>=8)sig.push("BTTS — Yes");
  const resultFacts=facts.filter(f=>f.tags.includes("result"));
  const homePositive=resultFacts.some(f=>key(f.text).includes(key(g.home.name))&&(/unbeaten|won /.test(f.text.toLowerCase())));
  const awayPositive=resultFacts.some(f=>key(f.text).includes(key(g.away.name))&&(/unbeaten|won /.test(f.text.toLowerCase())));
  if(homePositive)sig.push(g.home.name+" or Draw");
  if(awayPositive)sig.push(g.away.name+" or Draw");
  return [...new Set(sig)].slice(0,4)
}
async function schedule(league,team,season){
  const years=[Number(season),Number(season)-1].filter((x,i,a)=>Number.isFinite(x)&&a.indexOf(x)===i);
  const payloads=await Promise.all(years.map(async y=>{
    const base=`${SITE}/api/espn-schedule?league=${encodeURIComponent(league)}&team=${encodeURIComponent(team)}&season=${encodeURIComponent(y)}`;
    try {
      const result=await json(base+"&scope=all");
      if(Array.isArray(result?.events)&&result.events.length)return result;
    } catch(error) {
      console.warn("Cross-competition history unavailable; trying league schedule:",league,team,y,String(error).slice(0,80));
    }
    try {return await json(base+"&scope=competition")} catch{return {events:[]}}
  }));
  return{events:payloads.flatMap(x=>x?.events||[])}
}
let czechFixtures=[];
function czechHistory(teamId,before){
  return czechFixtures.filter(m=>Array.isArray(m.score)&&new Date(m.kickoff)<new Date(before))
    .filter(m=>"cz1-"+key(m.home).replace(/ /g,"-")===teamId||"cz1-"+key(m.away).replace(/ /g,"-")===teamId)
    .map(m=>{
      const isHome=("cz1-"+key(m.home).replace(/ /g,"-"))===teamId;
      const gf=isHome?m.score[0]:m.score[1],ga=isHome?m.score[1]:m.score[0];
      const other=isHome?m.away:m.home;
      return{id:m.id,date:m.kickoff,venue:isHome?"home":"away",gf,ga,league:"cze.1",
        result:gf>ga?"W":gf<ga?"L":"D",
        oppId:"cz1-"+key(other).replace(/ /g,"-"),oppName:other};
    }).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,10);
}

// Licensed domestic match history mirrored from psyche-s/football-data-hub.
// This supplements, but never masquerades as, all-competition results.
const HUB_LEAGUES=["eng.1","eng.2","ger.1","esp.1","fra.1","ita.1","ned.1","por.1","tur.1"];
const HUB_ALIAS=new Map([["man city","manchester city"],["man utd","manchester united"],["psg","paris saint germain"],["bayern munich","bayern munchen"],["inter milan","internazionale"],["bournemouth","afc bournemouth"],["lyon","olympique lyonnais"],["braga","sporting clube de braga"]]);
const hubKey=name=>{const v=key(name).replace(/ (fc|afc|sc|cf)$/,"");return HUB_ALIAS.get(v)||v};
let hubRows=null;
async function getHubRows(){
 if(hubRows)return hubRows;
 const byLeague=new Map();
 for(const league of HUB_LEAGUES){
  try{
   const doc=JSON.parse(await fs.readFile(path.join("data","football-hub",league+".json"),"utf8"));
   if(doc.schema!=="footyedge-history-v1"||doc.license!=="CC0-1.0"||doc.competition!==league||!Array.isArray(doc.games))continue;
   byLeague.set(league,doc.games.filter(m=>/^\\d{4}-\\d{2}-\\d{2}$/.test(m.d||"")&&Number.isInteger(m.hs)&&Number.isInteger(m.as)));
  }catch(error){if(error.code!=="ENOENT")console.warn("Hub archive not usable",league,String(error).slice(0,90))}
 }
 hubRows=byLeague;return byLeague;
}
async function hubEvidence(g){
 const byLeague=await getHubRows(),cutoff=String(g.date||"").slice(0,10);
 const h=hubKey(g.home.name),a=hubKey(g.away.name);
 const matches=[];
 for(const [league,rows] of byLeague)for(const m of rows){
  if(m.d>=cutoff)continue;
  const home=hubKey(m.h),away=hubKey(m.a);
  if(home!==h&&away!==h&&home!==a&&away!==a)continue;
  matches.push({date:m.d,home:m.h,away:m.a,homeScore:m.hs,awayScore:m.as,league,source:"OpenFootball CC0 via Football Data Hub",sourceId:m.id});
 }
 matches.sort((x,y)=>y.date.localeCompare(x.date));
 const side=name=>matches.filter(m=>hubKey(m.home)===name||hubKey(m.away)===name).slice(0,10).map(m=>{
  const isHome=hubKey(m.home)===name,gf=isHome?m.homeScore:m.awayScore,ga=isHome?m.awayScore:m.homeScore;
  return {...m,venue:isHome?"home":"away",gf,ga,result:gf>ga?"W":gf<ga?"L":"D"};
 });
 const h2h=matches.filter(m=>(hubKey(m.home)===h&&hubKey(m.away)===a)||(hubKey(m.home)===a&&hubKey(m.away)===h)).slice(0,5);
 return {license:"CC0-1.0",warehouse:"psyche-s/football-data-hub",coverage:"domestic-league-completed-results-only",homeLast10:side(h),awayLast10:side(a),h2h};
}

let derivedHubCache;
async function derivedHubMetrics(g){
 if(derivedHubCache===undefined){
   derivedHubCache=await fs.readFile(path.join("data","football-hub","derived-latest.json"),"utf8").then(JSON.parse).catch(e=>{if(e.code!=="ENOENT")console.warn("Derived hub unavailable:",e.message);return null});
 }
 const doc=derivedHubCache,cutoff=String(g.date||"").slice(0,10);
 if(!doc||doc.schema!=="footyedge-hub-derived-v1"||doc.rights!=="CC0-1.0"||doc.notCalibrated!==true||doc.asOfExclusive>cutoff)return null;
 const league=g.league,byLeague=await getHubRows(),rows=byLeague.get(league)||[];
 function matchTeam(name){
   const ids=new Set(rows.flatMap(m=>[[m.h,m.hi],[m.a,m.ai]]).filter(([n,id])=>hubKey(n)===hubKey(name)&&id).map(([,id])=>id));
   if(ids.size!==1)return null;
   return doc.teams[league+"|"+[...ids][0]]||null;
 }
 const home=matchTeam(g.home.name),away=matchTeam(g.away.name);
 if(!home&&!away)return null;
 return {asOfExclusive:doc.asOfExclusive,rights:"CC0-1.0",historicalOnly:true,notCalibrated:true,home,away};
}
async function buildFixture(g){
  try{
    let hh,ah;
    if(g.league==="cze.1"){
      // ESPN has no reliable Czech team-history endpoint; use completed
      // matches strictly predating this kickoff from the same dated source.
      hh=czechHistory(g.home.id,g.date);
      ah=czechHistory(g.away.id,g.date);
    }else{
      const [hp,ap]=await Promise.all([schedule(g.league,g.home.id,g.season),schedule(g.league,g.away.id,g.season)]);
      hh=history(hp,g.home.id,g.date);
      ah=history(ap,g.away.id,g.date);
    }
    const facts=[...teamFacts(g.home.name,hh,"home"),...teamFacts(g.away.name,ah,"away"),...h2hFacts(g,hh)]
      .sort((a,b)=>b.priority-a.priority).slice(0,12);
    const hub=await hubEvidence(g);
    const hubDerived=await derivedHubMetrics(g);
    return{...g,hubHistory:hub,hubDerived,history:{home:hh.length,away:ah.length},last10:{home:hh,away:ah},last5:{home:hh.slice(0,5),away:ah.slice(0,5)},facts,marketSignals:marketSignals(facts,g),generatedAt:new Date().toISOString()};
  }catch(error){
    return{...g,history:{home:0,away:0},facts:[],marketSignals:[],error:String(error),generatedAt:new Date().toISOString()};
  }
}
// Source-labelled fallback for research continuity only; never treat snapshots as live.
function datedSnapshotEvents(snapshot){
  const codes=new Map([[700,"eng.1"],[3914,"eng.2"],[3946,"tur.1"],[21231,"ksa.1"],[740,"esp.1"],[730,"ita.1"],[720,"ger.1"],[710,"fra.1"],[725,"ned.1"],[715,"por.1"],[770,"usa.1"],[775,"uefa.champions"],[776,"uefa.europa"],[20296,"uefa.europa.conf"]]);
  return (snapshot?.response||[]).flatMap(row=>{
    const home=row?.teams?.home,away=row?.teams?.away,fixture=row?.fixture;
    const code=codes.get(Number(row?.league?.id));
    if(!code||!home?.name||!away?.name||!fixture?.id||!fixture?.date||/women|female/i.test(String(row?.league?.name||"")))return [];
    return [{id:String(fixture.id),date:fixture.date,footyedgeLeague:code,
      league:{name:row.league.name},season:{year:Number(row.league.season)||Number(DATE.slice(0,4))},
      status:{type:{completed:false,state:"pre"}},
      competitions:[{competitors:[
        {id:String(home.id),homeAway:"home",team:{id:String(home.id),displayName:home.name}},
        {id:String(away.id),homeAway:"away",team:{id:String(away.id),displayName:away.name}}
      ]}]}];
  });
}
async function main(){
  // Explicit owner-specified October 9 league expansion: write a NEW research
  // source, never modify the frozen original deterministic research base.
  const correction=process.env.OWNER_SCOPE_EXPANSION==="2026-10-09"&&DATE==="2026-10-09";
  if(!correction){
    try{await fs.access(path.join('data','boards',DATE+'.json'));console.log('Published research remains frozen:',DATE);return}catch(e){if(e.code!=='ENOENT')throw e}
  }
  if(!FORCE&&torontoHour()!=="06"){console.log("Skip: Toronto hour is",torontoHour(),"not 06");return}
  let board;
  try{board=await json(`${SITE}/api/espn-scoreboard?dates=${DATE.replaceAll("-","")}&limit=1000`)}
  catch(error){
    try{
      board=JSON.parse(await fs.readFile(path.join("data",DATE,"scoreboard.json"),"utf8"));
      console.warn("Scoreboard API unavailable; using committed same-day scoreboard snapshot:",String(error));
    }catch(snapshotError){
      try{
        const saved=JSON.parse(await fs.readFile(path.join("data",DATE,"fixtures.json"),"utf8"));
        const events=datedSnapshotEvents(saved);
        if(!events.length)throw Error("No identifiable men's fixtures in dated snapshot");
        board={events,footyedgeSources:{scoreboard:{live:false,kind:"dated-snapshot-research-only",date:DATE}}};
        console.warn("Live scoreboard unavailable; dated fixture snapshot used for research only, NOT verified live data:",String(error));
      }catch(fixtureError){
        console.warn("No trustworthy fixture source; do not manufacture research or picks:",String(fixtureError));
        throw error;
      }
    }
  }
  // The public Czech top-flight source is independent from ESPN.
  // The site may already have these events after a deploy: dedupe by stable ID.
  try{
    const supplement=await loadCzechSeason(DATE);
    czechFixtures=supplement.matches;
    const events=eventsForCzechDate(czechFixtures,DATE);
    const seen=new Set((board.events||[]).map(e=>String(e.id)));
    if(!Array.isArray(board.events))board.events=[];
    for(const event of events)if(!seen.has(String(event.id))){
      board.events.push(event);seen.add(String(event.id));
    }
  }catch(error){
    console.warn("Czech public-domain results unavailable; do not invent this league's form or fixtures",String(error));
  }
  const games=globalThis.FootyEdgeAvailability.eventsForDay(board,DATE).map(fixtureInfo).filter(Boolean);
  const fixtures=[];
  for(let i=0;i<games.length;i+=4){
    fixtures.push(...await Promise.all(games.slice(i,i+4).map(buildFixture)));
  }
  // Merge ONLY authorized, date-matched regional rows into upcoming research.
  // Never synthesize Asian fixtures from FotMob website data or amend frozen boards.
  try{
    const doc=JSON.parse(await fs.readFile(path.join("data","asia",DATE+".json"),"utf8"));
    if(doc.schema==="footyedge-authorized-asia-research-v1"&&doc.date===DATE&&doc.license&&doc.permissionReference&&Array.isArray(doc.fixtures)){
      const ids=new Set(fixtures.map(x=>String(x.id)));
      for(const row of doc.fixtures){
        if(!["jpn.1","kor.1"].includes(row.league)||!row.id||!row.date||!row.home?.name||!row.away?.name)continue;
        if(ids.has(String(row.id)))continue;
        fixtures.push(row);ids.add(String(row.id));
      }
    }
  }catch(e){if(e.code!=="ENOENT")throw e}
  let learningIngested=null;try{const x=JSON.parse(await fs.readFile(path.join("data","postmortems","diagnostics.json"),"utf8"));learningIngested={generatedAt:x.generatedAt,decision:x.decision,modelChange:x.modelChange}}catch(e){if(e.code!=="ENOENT")throw e}
  // Player props require their own sourced event-level goals/assists and confirmed starters.
  // The domestic scores hub has neither, so no player is inferred from team trends.
  let playerFeed=null;
  try{playerFeed=JSON.parse(await fs.readFile(path.join("data",DATE,"verified-player-events.json"),"utf8"))}catch(e){if(e.code!=="ENOENT")throw e}
  const propCoverage={feedAvailable:playerFeed?.date===DATE&&Array.isArray(playerFeed.fixtures),markets:["ATGS","Score or Assist"],note:"Unverified player minutes, lineups or exact market quotes => PASS; no confidence/EV inferred."};
  for(const fixture of fixtures){
    const row=propCoverage.feedAvailable?playerFeed.fixtures.find(x=>String(x.fixtureId)===String(fixture.id)):null;
    fixture.playerPropResearch=evaluatePlayerProps({fixture,players:row?.players||[],quotes:row?.quotes||[]});
  }
  const out={date:DATE,modelVersion:"v69-gates",learningIngested,generatedAt:new Date().toISOString(),source:"FootyEdge deterministic all-competition history",playerPropCoverage:propCoverage,fixtures};
  const file=path.join("data",correction?`research-base-expanded-${DATE}.json`:`research-base-${DATE}.json`);
  await fs.mkdir("data",{recursive:true});
  await fs.writeFile(file,JSON.stringify(out,null,2)+"\n");
  console.log("Wrote",file,"with",fixtures.length,"fixtures");
}
main().catch(e=>{console.error(e);process.exit(1)});
