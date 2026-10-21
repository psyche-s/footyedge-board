#!/usr/bin/env node
// Licensed J1 League / K League 1 research importer for the ORIGINAL FootyEdge.
// Never scrape FotMob, bypass robots, reuse unverifiable publisher HTML or invent matches.
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const LEAGUES={223:{code:'jpn.1',name:'J1 League',country:'Japan'},9080:{code:'kor.1',name:'K League 1',country:'South Korea'}};
const keys=['goals_per_match','conceded_per_match','xg_per_match','xga_per_match','shots_per_match','shots_on_target_per_match','big_chances_per_match','corners_per_match','possession_pct','clean_sheet_pct','btts_pct','over_2_5_pct','ppda'];
function assert(x,msg){if(!x)throw Error(msg)}
function isUrl(u){try{const v=new URL(u);return v.protocol==='https:'&&!!v.hostname}catch{return false}}
function torontoDate(t){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(t)).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day}
const name=t=>{assert(t&&typeof t.name==='string'&&t.name.trim().length>1&&t.name.length<=120,'Missing team name');assert(typeof t.id==='number'&&Number.isSafeInteger(t.id)&&t.id>0,'Missing verified team ID');return{id:String(t.id),name:t.name.trim(),logo:isUrl(t.logo)?t.logo:null}};
function series(rows,date,code){
 assert(Array.isArray(rows)&&rows.length<=10,'Invalid last-ten sample');
 const seen=new Set();
 const out=rows.map((r,i)=>{
   assert(/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&r.date<date,'Future/undated match in historical form');
   assert(Number.isInteger(r.goals_for)&&Number.isInteger(r.goals_against)&&r.goals_for>=0&&r.goals_for<=20&&r.goals_against>=0&&r.goals_against<=20,'Invalid recorded score');
   assert(r.venue==='home'||r.venue==='away','Unknown venue');
   const id=String(r.id||r.date+'-'+i);
   assert(!seen.has(id),'Duplicate historical match');seen.add(id);
   return{id,date:r.date,gf:r.goals_for,ga:r.goals_against,venue:r.venue,
     result:r.goals_for>r.goals_against?'W':r.goals_for<r.goals_against?'L':'D',
     opp:String(r.opponent||''),league:code,source:'licensed-asian-data'};
 });
 return out.sort((a,b)=>b.date.localeCompare(a.date));
}
function metrics(data){
 assert(data===undefined||data===null||typeof data==='object','Invalid metric object');
 const out={};
 for(const [k,v] of Object.entries(data||{})){
   if(!keys.includes(k)||v==null)continue;
   assert(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=(k.endsWith('_pct')?100:k==='ppda'?80:k==='possession_pct'?100:50),'Invalid metric '+k);
   out[k]=Math.round(v*1000)/1000;
 }
 return out;
}
function normalizeMatch(m,day){
 const meta=LEAGUES[m.league_id];assert(meta,'Unsupported or women’s competition');
 const kickoff=new Date(m.kickoff);
 assert(typeof m.kickoff==='string'&&/Z$|[+-]\d{2}:\d{2}$/.test(m.kickoff)&&Number.isFinite(+kickoff),'Unverified kickoff timezone');
 assert(torontoDate(kickoff)===day,'Fixture date must match Toronto board date');
 assert(/^[a-z0-9_-]{1,80}$/i.test(String(m.provider_id||'')),'Missing stable provider fixture ID');
 assert(isUrl(m.source_url),'Missing fixture provenance URL');
 const home=name(m.team_home),away=name(m.team_away);
 assert(home.id!==away.id,'Identical teams');
 const h=series(m.recent_results?.home||[],day,meta.code),a=series(m.recent_results?.away||[],day,meta.code);
 const h2h=(m.h2h||[]).map((v,i)=>{
   assert(v.date&&v.date<day&&/^\d{4}-\d{2}-\d{2}$/.test(v.date),'Invalid H2H date');
   assert(Number.isInteger(v.goals_home)&&Number.isInteger(v.goals_away)&&v.goals_home>=0&&v.goals_away>=0&&v.goals_home<=20&&v.goals_away<=20,'Invalid H2H result');
   return{id:String(v.id||'asia-h2h-'+i),date:v.date,home:String(v.home||home.name),away:String(v.away||away.name),homeScore:v.goals_home,awayScore:v.goals_away,sourceUrl:m.source_url};
 }).sort((x,y)=>y.date.localeCompare(x.date)).slice(0,5);
 const stats={home:metrics(m.team_metrics?.home),away:metrics(m.team_metrics?.away),
   sourceUrl:isUrl(m.team_metrics?.source_url)?m.team_metrics.source_url:m.source_url};
 const teamNews=(m.team_news||[]).filter(x=>['home','away'].includes(x.side)&&isUrl(x.source_url)&&x.headline)
   .slice(0,10).map(x=>({type:x.confirmed?'confirmed':'reported',side:x.side,text:String(x.headline).slice(0,250),
     source:x.source_url,sourceUrl:x.source_url,verified:x.confirmed===true}));
 const facts=[];
 for(const [side,club,list] of [['home',home,h],['away',away,a]]){
   if(list.length>=5){const gf=list.reduce((s,x)=>s+x.gf,0)/list.length,ga=list.reduce((s,x)=>s+x.ga,0)/list.length;
     facts.push({text:club.name+' scored '+gf.toFixed(2)+' and conceded '+ga.toFixed(2)+' per match across the last '+list.length+' recorded games.',tags:['form','result','team goals','defense'],source:m.source_url,priority:10});}
   const sm=stats[side];if(sm.xg_per_match!=null||sm.xga_per_match!=null)
     facts.push({text:club.name+' season xG '+(sm.xg_per_match??'N/A')+' and xGA '+(sm.xga_per_match??'N/A')+' per match.',tags:['team goals','defense'],source:stats.sourceUrl,priority:4});
 }
 if(h2h.length)facts.push({text:'Last '+h2h.length+' recorded head-to-head meetings are available for this fixture.',tags:['h2h'],source:m.source_url,priority:2});
 return {id:'asia-'+m.league_id+'-'+m.provider_id,date:kickoff.toISOString(),league:meta.code,
   leagueName:meta.name,sourceUrl:m.source_url,season:kickoff.getUTCFullYear(),home,away,
   history:{home:h.length,away:a.length},last10:{home:h,away:a},last5:{home:h.slice(0,5),away:a.slice(0,5)},
   h2h,teamNews,teamMetrics:stats,facts,marketSignals:[],dataQuality:{verifiedFixture:true,licensedSource:true,verifiedHistory:h.length>=5&&a.length>=5},
   generatedAt:new Date().toISOString()};
}
export function normalizeAsianFeed(input,date){
 assert(input&&input.date===date&&Array.isArray(input.matches),'Wrong-date or missing licensed feed');
 assert(input.rights?.authorized===true&&typeof input.rights.license==='string'&&input.rights.license.trim()&&
   typeof input.rights.permission_reference==='string'&&input.rights.permission_reference.trim(),'Publication rights not confirmed');
 const fixtures=input.matches.map(m=>normalizeMatch(m,date));
 const seen=new Set();for(const f of fixtures){assert(!seen.has(f.id),'Duplicate Asian fixture');seen.add(f.id)}
 return {schema:'footyedge-authorized-asia-research-v1',date,license:input.rights.license,
   permissionReference:input.rights.permission_reference,source:'authorized-structured-feed',fixtures};
}
async function main(){
 const date=process.env.RESEARCH_DATE||torontoDate(new Date());
 const lock='data/boards/'+date+'.json';
 if(await fs.access(lock).then(()=>true).catch(()=>false)){console.log('Frozen board preserved:',date);return}
 const approved=process.env.FOOTYEDGE_ASIA_FEED_APPROVED==='1';
 const url=(process.env.FOOTYEDGE_ASIA_FEED_URL||'').trim();
 if(!approved||!url){console.log('J1/K League integration ready, licensed feed not configured; no fixture invented');return}
 assert(isUrl(url),'Asian feed URL must use HTTPS');
 const host=new URL(url).hostname.toLowerCase();
 assert(!/(^|\.)fotmob\.com$/.test(host)&&!/(^|\.)jleague\.jp$/.test(host)&&!/(^|\.)kleague\.com$/.test(host),'Direct publisher scraping prohibited; use separately licensed structured JSON');
 const headers={accept:'application/json'};if(process.env.FOOTYEDGE_ASIA_FEED_TOKEN)headers.Authorization='Bearer '+process.env.FOOTYEDGE_ASIA_FEED_TOKEN;
 const r=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});
 assert(r.ok&&String(r.headers.get('content-type')||'').includes('application/json'),'Authorized feed unavailable');
 const raw=await r.text();assert(raw.length<2000000,'Feed too large');
 const checked=normalizeAsianFeed(JSON.parse(raw),date);
 await fs.mkdir('data/asia',{recursive:true});
 const dst='data/asia/'+date+'.json';
 await fs.writeFile(dst,JSON.stringify(checked,null,2)+'\n','utf8');
 console.log('Source-verified Asian fixtures:',checked.fixtures.length,'for',date);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1});
