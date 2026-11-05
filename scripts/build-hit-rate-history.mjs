#!/usr/bin/env node
// The Hit Rate page reads posted selections and verified settlements only.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {summaryOf,ticketsOf,playerResearchTicketsOf} from './track-slip-performance.mjs';

const cleanResult=value=>['hit','miss','push'].includes(value)?value:'pending';
export function outcomeStats(rows){
 const hits=rows.filter(x=>x.result==='hit').length,misses=rows.filter(x=>x.result==='miss').length;
 return {hits,misses,pushes:rows.filter(x=>x.result==='push').length,pending:rows.filter(x=>!['hit','miss','push'].includes(x.result)).length,settled:hits+misses,hitRate:hits+misses?Math.round(hits/(hits+misses)*10000)/100:null};
}
export function buildHistory({date,performanceDays=[],slipDays=[],candidates=[],playerGoalResearch=[]}){
 const month=date.slice(0,7),year=date.slice(0,4),byDate=new Map();
 const dayFor=day=>{if(!byDate.has(day))byDate.set(day,{date:day,top5:[],tickets:[]});return byDate.get(day)};
 const eligible=day=>/^\d{4}-\d{2}-\d{2}$/.test(day||'')&&day.startsWith(month)&&day<=date;
 for(const record of performanceDays){
  if(!eligible(record.date))continue;
  dayFor(record.date).top5=(record.top5||[]).slice().sort((a,b)=>a.rank-b.rank).slice(0,5).map(p=>({...p,result:cleanResult(p.result)}));
 }
 const candidatesByDate=new Map(candidates.map(record=>[record.date,record]));
 const playerByDate=new Map(playerGoalResearch.map(record=>[record.date,record]));
 const slipsByDate=new Map(slipDays.map(record=>[record.date,record]));
 for(const day of new Set([...slipsByDate.keys(),...candidatesByDate.keys(),...playerByDate.keys()])){
  const record=slipsByDate.get(day)||{date:day};
  if(!eligible(record.date))continue;
  const seen=new Set();
  const captured=record.tickets||[];
  // Older snapshots may lack research slips. Prefer the captured ticket
  // and its verified results when both the snapshot and desk have a copy.
  const uncaptured=ticketsOf(candidatesByDate.get(day)).filter(t=>t.trackable===false&&!captured.some(saved=>saved.id===t.id));
  const untrackedPlayers=playerResearchTicketsOf(playerByDate.get(day)).filter(t=>!captured.some(saved=>saved.id===t.id));
  const tickets=[...captured,...uncaptured,...untrackedPlayers].sort((a,b)=>Number(a.trackable===false)-Number(b.trackable===false));
  dayFor(record.date).tickets=tickets.filter(t=>{
   const signature=t.signature||(t.legs||[]).map(l=>l.gameId+'|'+String(l.label).toLowerCase()).sort().join('||');
   if(t.duplicateOf||t.supersededBy||seen.has(signature)||!t.legs?.length)return false;seen.add(signature);return true;
  }).map(t=>({id:t.id,type:t.type,league:t.league,bestSgp:t.bestSgp===true,trackable:t.trackable!==false,
   result:cleanResult(t.result),settledAt:t.settledAt||null,
   combinedReferenceAmerican:t.combinedReferenceAmerican??null,combinedReferenceDecimal:t.combinedReferenceDecimal??null,
   verifiedCombinedPrice:t.verifiedCombinedPrice===true,combinedOntarioOdds:t.combinedOntarioOdds??null,
   sourcePublishedAt:captured.includes(t)?record.capturedAt||null:null,
   legs:t.legs.map(l=>({...l,result:cleanResult(l.result)}))}));
 }
 const days=[...byDate.values()].filter(d=>d.top5.length||d.tickets.length).sort((a,b)=>b.date.localeCompare(a.date));
 const allTickets=prefix=>slipDays.filter(d=>d.date<=date&&d.date.startsWith(prefix)).flatMap(d=>d.tickets||[]);
 const monthTickets=days.flatMap(d=>d.tickets||[]);
 const playerKind=(tickets,kind)=>outcomeStats(tickets.filter(x=>x.type===kind&&!x.duplicateOf).flatMap(x=>x.legs||[]));
 const allYearPlayer=[...allTickets(year),...monthTickets.filter(t=>["player_atgs","player_soa"].includes(t.type)&&!allTickets(year).some(x=>x.id===t.id))];
 return {schema:'footyedge-tracking-history-v1',date,generatedAt:new Date().toISOString(),month,
  top5:{month:{key:month,...outcomeStats(days.flatMap(d=>d.top5))},year:{key:year,...outcomeStats(performanceDays.filter(d=>d.date<=date&&d.date.startsWith(year)).flatMap(d=>d.top5||[]))}},
  slips:{month:{key:month,...summaryOf(allTickets(month))},year:{key:year,...summaryOf(allTickets(year))}},
  playerGoals:{month:{key:month,atgs:playerKind(monthTickets,"player_atgs"),scoreOrAssist:playerKind(monthTickets,"player_soa")},
   year:{key:year,atgs:playerKind(allYearPlayer,"player_atgs"),scoreOrAssist:playerKind(allYearPlayer,"player_soa")}},
  days,note:'Top 5 selections count individually. Each distinct published slip counts once as a whole; unpriced candidates do not count. Missing verified player stats remain pending.'};
}
function readDays(root,folder){
 const dir=path.join(root,'data',folder);if(!fs.existsSync(dir))return [];
 return fs.readdirSync(dir).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));
}
export function main(root=process.cwd()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 const date=process.env.TRACKING_DATE||[parts.year,parts.month,parts.day].join('-');
 const output=buildHistory({date,performanceDays:readDays(root,'performance'),slipDays:readDays(root,'performance/slips'),candidates:readDays(root,'slips-reviewed'),playerGoalResearch:readDays(root,'player-goal-slips')});
 const file=path.join(root,'data','performance','history.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(output,null,2)+'\n');
 console.log(JSON.stringify({date,days:output.days.length,top5:output.days.reduce((n,d)=>n+d.top5.length,0),slips:output.days.reduce((n,d)=>n+d.tickets.filter(t=>t.trackable).length,0)}));return output;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main();
