import '../assets/board-availability.js';
import fs from 'node:fs/promises';

const SITE=(process.env.FOOTYEDGE_URL||'https://footyedge-board.vercel.app').replace(/\/$/,'');
const TZ='America/Toronto';
const FORCE_DATE=process.env.BOARD_DATE||null;
function today(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`}
function add(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
async function load(date){const r=await fetch(`${SITE}/api/espn-scoreboard?dates=${date.replaceAll('-','')}&limit=1000`,{headers:{accept:'application/json','user-agent':'FootyEdgeScheduleBot/1.0'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);const payload=await r.json();if(!Array.isArray(payload?.events))throw new Error('Invalid schedule response');return payload}
async function main(){
  const date=FORCE_DATE||today(),observations=[];
  for(let offset=0;offset<=4;offset++){
    const day=add(date,offset);
    try{const payload=await load(day),events=globalThis.FootyEdgeAvailability.eventsForDay(payload,day);observations.push({date:day,providerStatus:'verified',scheduledMensGames:new Set(events.map(e=>String(e.id))).size,status:events.length?'fixtures-confirmed':'verified-empty'});}
    catch(error){observations.push({date:day,providerStatus:'unavailable',scheduledMensGames:null,status:'schedule-unavailable',error:String(error.message||error)});}
  }
  const first=observations[0],earlierUnavailable=observations.slice(1).findIndex(x=>x.providerStatus!=='verified'),next=observations.slice(1).find((x,i)=>x.scheduledMensGames>0&&(earlierUnavailable<0||i<earlierUnavailable));
  const out={checkedAt:new Date().toISOString(),timeZone:TZ,horizonDays:4,policy:'Men’s fixtures only. Today may contain research, verified native odds and frozen picks; future dates are schedule-awareness only.',today:{...first,published:false,nextMensGameDate:first?.scheduledMensGames===0?next?.date||null:null,emptyState:first?.providerStatus!=='verified'?'schedule-unavailable':first.scheduledMensGames===0?'No games today. '+(next?`Next game on ${next.date}.`:'Next game date is not yet confirmed.'):'Today’s picks have not been published yet.'},days:observations.slice(1).map(x=>({...x,bettingContent:'not-researched-or-published-before-date'})),notes:['Women’s club and international fixtures are filtered before counting.','No future-day research, odds, confidence, props, rankings or recommendations are stored.']};
  await fs.writeFile('data/board-readiness.json',JSON.stringify(out,null,2)+'\n');
  console.log(`Wrote data/board-readiness.json: today=${first?.scheduledMensGames??'unavailable'}, next=${next?.date||'unconfirmed'}`);
}
main().catch(error=>{console.error(error);process.exit(1)});
