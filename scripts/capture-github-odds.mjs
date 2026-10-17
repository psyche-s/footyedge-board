#!/usr/bin/env node
/** One-shot, capped GitHub Actions sportsbook snapshot. Never print or persist THEODDSAPI. */
import fs from 'node:fs/promises';
const BOOKS=['draftkings','fanduel','espnbet'];
const KEY_MAP={
 'eng.1':'soccer_epl','eng.2':'soccer_efl_championship','esp.1':'soccer_spain_la_liga',
 'ita.1':'soccer_italy_serie_a','ger.1':'soccer_germany_bundesliga',
 'fra.1':'soccer_france_ligue_one','ned.1':'soccer_netherlands_eredivisie',
 'por.1':'soccer_portugal_primeira_liga','usa.1':'soccer_usa_mls',
 'tur.1':'soccer_turkey_super_league','ksa.1':'soccer_saudi_arabia_league',
 'cze.1':'soccer_czech_first_league','uefa.champions':'soccer_uefa_champs_league',
 'uefa.europa':'soccer_uefa_europa_league','uefa.europa.conf':'soccer_uefa_europa_conference_league'};
const today=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const implied=n=>n>0?100/(n+100):Math.abs(n)/(Math.abs(n)+100);
const fair=prices=>{const imp=prices.map(x=>implied(x)),sum=imp.reduce((a,b)=>a+b,0);return imp.map(x=>x/sum)};
const bookLabel={draftkings:'DraftKings',fanduel:'FanDuel',espnbet:'ESPN BET'};
const chooseOutcome=(market,name)=>{const x=(market?.outcomes||[]).find(o=>norm(o.name)===norm(name));return x&&Number.isFinite(Number(x.price))&&Number(x.price)!==0?Number(x.price):null;};
function summarize(e,league,capturedAt){
 const books=e.bookmakers||[];
 let homeML=null,drawML=null,awayML=null,mlBook=null,prices=null;
 const bookRef=(bk,market,line)=>({key:bk.key,name:bookLabel[bk.key],quoteRef:'the-odds-api:'+e.id+':'+bk.key+':'+market+(line==null?'':':'+line),
  sourceProvider:'The Odds API',marketUpdatedAt:bk.markets?.find(m=>m.key===market)?.last_update||null});
 for(const key of BOOKS){
  const b=books.find(b=>b.key===key),m=b?.markets?.find(m=>m.key==='h2h');if(!m)continue;
  const h=chooseOutcome(m,e.home_team),d=chooseOutcome(m,'Draw'),a=chooseOutcome(m,e.away_team);
  if(h===null||d===null||a===null)continue;
  homeML=h;drawML=d;awayML=a;mlBook=bookRef(b,'h2h');prices=fair([h,d,a]);break;
 }
 const totals={},lines=new Set();
 for(const b of books.filter(b=>BOOKS.includes(b.key))){
  const m=b.markets?.find(m=>m.key==='totals');
  for(const o of m?.outcomes||[])if(Number.isFinite(Number(o.point)))lines.add(Number(o.point));
 }
 for(const line of [...lines].sort((a,b)=>a-b)){
  for(const key of BOOKS){
   const b=books.find(b=>b.key===key),m=b?.markets?.find(m=>m.key==='totals');if(!m)continue;
   const over=(m.outcomes||[]).find(o=>norm(o.name)==='over'&&Number(o.point)===line);
   const under=(m.outcomes||[]).find(o=>norm(o.name)==='under'&&Number(o.point)===line);
   const h=Number(over?.price),a=Number(under?.price);
   if(!over||!under||!Number.isFinite(h)||!Number.isFinite(a)||!h||!a)continue;
   const probs=fair([h,a]);
   totals[String(line)]={over:h,under:a,book:bookRef(b,'totals',line),probs:{over:probs[0],under:probs[1]}};
   break;
  }
 }
 const t25=totals['2.5'];
 return {id:e.id,league,sportKey:e.sport_key,sportTitle:e.sport_title,
  commenceTime:e.commence_time,home:e.home_team,away:e.away_team,
  provider:mlBook?.name||null,bookPriority:BOOKS,mlBook,
  quoteSource:{vendor:'The Odds API',kind:'bookmaker-attributed GitHub Actions snapshot',
    bookmakerMarket:'US',eventId:e.id,sportKey:e.sport_key,capturedAt},
  homeML,drawML,awayML,over25:t25?.over??null,under25:t25?.under??null,
  totals,spreads:[],probs:{home:prices?.[0]??null,draw:prices?.[1]??null,
  away:prices?.[2]??null,over25:t25?.probs?.over??null,under25:t25?.probs?.under??null}};
}
export {summarize};
async function main(){
 const date=process.env.BOARD_DATE||today(),file='data/daily-odds-'+date+'.json';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date!==today())throw Error('Only same-day snapshots are allowed');
 const old=await fs.readFile(file,'utf8').then(JSON.parse).catch(()=>null);
 // A completed pull or immutable official board is never automatically re-priced.
 if(old?.status==='partial-ready'||old?.status==='ready'){
  console.log('Existing verified same-day odds snapshot preserved');return;
 }
 const board=await fs.readFile('data/boards/'+date+'.json','utf8').then(JSON.parse).catch(()=>null);
 if(board?.immutable===true){console.log('Board already frozen; no extra paid calls');return}
 const key=process.env.THEODDSAPI;
 if(!key){console.log('GitHub THEODDSAPI secret not configured; no paid calls');return}
 const research=JSON.parse(await fs.readFile('data/research-base-'+date+'.json','utf8'));
 if(research.date!==date||!Array.isArray(research.fixtures)||!research.fixtures.length)throw Error('No validated same-day research slate');
 const wanted=new Map();
 for(const g of research.fixtures){if(!KEY_MAP[g.league])continue;wanted.set(g.league,(wanted.get(g.league)||0)+1)}
 const priority=['eng.1','eng.2','esp.1','ita.1','ger.1','fra.1','ned.1','por.1','usa.1','tur.1','ksa.1','cze.1','uefa.champions','uefa.europa','uefa.europa.conf'];
 const sports=priority.filter(x=>wanted.has(x));
 const maxCalls=clamp(Number(process.env.ODDS_MAX_PAID_CALLS)||8,1,8);
 const maxCredits=clamp(Number(process.env.ODDS_MAX_CREDITS)||20,2,20);
 // A free /sports call validates the secret without spending sportsbook credits.
 const endpoint='https://api.the-odds-api.com/v4';
 async function get(url){
  const res=await fetch(url,{signal:AbortSignal.timeout(22000),headers:{accept:'application/json'}});
  // Never log the URL or upstream body; both may accidentally contain credential details.
  if(!res.ok)throw Error('Provider HTTP '+res.status);
  return {data:await res.json(),headers:res.headers};
 }
 const sportsResult=await get(endpoint+'/sports/?apiKey='+encodeURIComponent(key));
 const available=new Set((Array.isArray(sportsResult.data)?sportsResult.data:[]).map(x=>x.key));
 const quotaHeader=sportsResult.headers.get('x-requests-remaining');
 let remaining=quotaHeader===null?null:Number(quotaHeader);
 if(!Number.isFinite(remaining))remaining=null;
 let used=0,calls=0,events=[],attempts=[],quotaExhausted=false;
 // The fixture preflight is free. It avoids paid requests for competitions with no matches.
 const from=new Date(date+'T00:00:00Z'),end=new Date(from.getTime()+48*3600000);
 for(const league of sports){
  const sportKey=KEY_MAP[league];
  if(!available.has(sportKey)){attempts.push({league,reason:'league_unavailable',paidRequest:false});continue}
  const eventURL=endpoint+'/sports/'+sportKey+'/events?apiKey='+encodeURIComponent(key)+'&dateFormat=iso&commenceTimeFrom='+encodeURIComponent(from.toISOString())+'&commenceTimeTo='+encodeURIComponent(end.toISOString());
  let hasFixtures=false;
  try{
   const result=await get(eventURL);
   hasFixtures=(Array.isArray(result.data)?result.data:[]).some(e=>todayOf(e.commence_time)===date);
  }catch{attempts.push({league,reason:'free_preflight_failed',paidRequest:false});continue}
  if(!hasFixtures){attempts.push({league,reason:'no_fixtures',paidRequest:false});continue}
  if(calls>=maxCalls||used+2>maxCredits||remaining!==null&&remaining<Math.max(25,2)){
   attempts.push({league,reason:'conservative_credit_budget',paidRequest:false});break;
  }
  const oddsURL=endpoint+'/sports/'+sportKey+'/odds?apiKey='+encodeURIComponent(key)+'&bookmakers='+BOOKS.join(',')+'&markets=h2h,totals&oddsFormat=american&dateFormat=iso&commenceTimeFrom='+encodeURIComponent(from.toISOString())+'&commenceTimeTo='+encodeURIComponent(end.toISOString());
  calls++;
  try{
   const r=await get(oddsURL);
   const charge=Number(r.headers.get('x-requests-last'));
   used+=Number.isFinite(charge)&&charge>0?charge:2;
   const count=Number(r.headers.get('x-requests-remaining'));
   if(Number.isFinite(count))remaining=count;
   const list=Array.isArray(r.data)?r.data:[];
   let n=0;
   for(const e of list){
    if(todayOf(e.commence_time)!==date)continue;
    const parsed=summarize(e,league,new Date().toISOString());
    if(parsed.mlBook||Object.keys(parsed.totals).length){events.push(parsed);n++}
   }
   attempts.push({league,sportKey,paidRequest:true,events:n,chargedCredits:charge||null});
  }catch(e){
   used+=2;
   attempts.push({league,sportKey,paidRequest:true,reason:'provider_request_failed'});
   if(/ 401| 403| 422| 429/.test(String(e.message)))break;
  }
 }
 const result={date,fetchedAt:new Date().toISOString(),status:events.length?'partial-ready':'blocked',
  verifiedNativeOnly:true,nativeFormat:'american',bookmakerPriority:BOOKS,markets:['h2h','totals'],
  events,attempts,quota:{remaining,estimatedSpent:used,maxCredits,maxPaidCalls:maxCalls},
  captureMode:'single GitHub secret-backed daily snapshot',note:events.length?'Dated bookmaker quotes, not live-executable guarantees.':'No independently verified sportsbook quotes; do not infer prices or EV.'};
 await fs.writeFile(file,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({date,status:result.status,quotedFixtures:events.length,paidCalls:calls,estimatedCredits:used,remaining}));
}
function todayOf(value){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)).map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
if(process.argv[1]?.endsWith('/capture-github-odds.mjs'))main().catch(e=>{console.error('Odds collector stopped safely:',e.message.replace(/apiKey=[^&\s]+/gi,'apiKey=REDACTED'));process.exitCode=1});
