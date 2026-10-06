import fs from "node:fs/promises";
import path from "node:path";

const SITE=(process.env.FOOTYEDGE_URL||"https://footyedge-board.vercel.app").replace(/\/$/,"");
const TZ="America/Toronto";
const UID_LEAGUE={
  "2395":"uefa.nations","19267":"concacaf.nations.league","3922":"fifa.friendly",
  "2021":"eng.1","760":"esp.1","730":"ita.1","740":"ger.1","773":"fra.1"
};
const TRACKED=new Set([
  "uefa.nations","fifa.friendly","concacaf.nations.league","uefa.champions","uefa.europa","uefa.europa.conf",
  "eng.1","esp.1","ita.1","ger.1","fra.1","ned.1","por.1","usa.1",
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
  const r=await fetch(url,{headers:{Accept:"application/json","User-Agent":"FootyEdge Research Bot/1.0"}});
  if(!r.ok)throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}
function leagueOf(e){
  const o=e?.competitions?.[0]?.odds?.[0];
  const tracked=o?.moneyline?.home?.close?.link?.tracking?.tags?.league||
    o?.moneyline?.away?.close?.link?.tracking?.tags?.league||
    o?.total?.over?.close?.link?.tracking?.tags?.league;
  if(tracked)return tracked;
  const m=String(e?.uid||"").match(/~l:(\d+)/);
  return m?UID_LEAGUE[m[1]]||null:null;
}
function fixtureInfo(e){
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
    if(!e?.date||new Date(e.date)>=new Date(before))continue;
    const cs=e?.competitions?.[0]?.competitors||[];
    const me=cs.find(c=>String(c?.id??c?.team?.id)===String(teamId));
    const op=cs.find(c=>String(c?.id??c?.team?.id)!==String(teamId));
    if(!me||!op)continue;
    const gf=scoreVal(me.score),ga=scoreVal(op.score);
    if(gf==null||ga==null)continue;
    out.push({
      id:String(e.id),date:e.date,venue:me.homeAway==="away"?"away":"home",
      gf,ga,result:gf>ga?"W":gf<ga?"L":"D",
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
  // Pull ESPN's all-competition team schedule directly so research-base is
  // independent of the currently deployed FootyEdge API version.
  const u=`https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${encodeURIComponent(team)}/schedule?season=${encodeURIComponent(season)}`;
  return json(u);
}
async function buildFixture(g){
  try{
    const [hp,ap]=await Promise.all([schedule(g.league,g.home.id,g.season),schedule(g.league,g.away.id,g.season)]);
    const hh=history(hp,g.home.id,g.date),ah=history(ap,g.away.id,g.date);
    const facts=[...teamFacts(g.home.name,hh,"home"),...teamFacts(g.away.name,ah,"away"),...h2hFacts(g,hh)]
      .sort((a,b)=>b.priority-a.priority).slice(0,12);
    return{...g,history:{home:hh.length,away:ah.length},facts,marketSignals:marketSignals(facts,g),generatedAt:new Date().toISOString()};
  }catch(error){
    return{...g,history:{home:0,away:0},facts:[],marketSignals:[],error:String(error),generatedAt:new Date().toISOString()};
  }
}
async function main(){
  if(!FORCE&&torontoHour()!=="06"){console.log("Skip: Toronto hour is",torontoHour(),"not 06");return}
  const board=await json(`${SITE}/api/espn-scoreboard?dates=${DATE.replaceAll("-","")}&limit=1000`);
  const games=(board.events||[]).map(fixtureInfo).filter(Boolean);
  const fixtures=[];
  for(let i=0;i<games.length;i+=4){
    fixtures.push(...await Promise.all(games.slice(i,i+4).map(buildFixture)));
  }
  const out={date:DATE,generatedAt:new Date().toISOString(),source:"FootyEdge deterministic schedule history",fixtures};
  const file=path.join("data",`research-base-${DATE}.json`);
  await fs.mkdir("data",{recursive:true});
  await fs.writeFile(file,JSON.stringify(out,null,2)+"\n");
  console.log("Wrote",file,"with",fixtures.length,"fixtures");
}
main().catch(e=>{console.error(e);process.exit(1)});
