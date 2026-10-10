#!/usr/bin/env node
import fs from 'node:fs';
const file='data/boards/2026-10-10.json',b=JSON.parse(fs.readFileSync(file,'utf8'));
let duplicates=0,withdrawn=0,uncalibrated=0,contradictions=0;
const h2hStats=g=>{const rows=(g.h2h||[]).filter(x=>Number.isFinite(Number(x.homeScore))&&Number.isFinite(Number(x.awayScore)));return {n:rows.length,yes:rows.filter(x=>Number(x.homeScore)>0&&Number(x.awayScore)>0).length}};
for(const g of b.games){
 const next=[];
 for(const p of g.top3||[]){
  let reason=String(p.reason||'');
  const boiler='Research only — ';
  const first=reason.indexOf(boiler);
  if(first>=0){const second=reason.indexOf(boiler,first+boiler.length);if(second>=0){reason=reason.slice(0,second).trim();duplicates++}}
  p.reason=reason;
  const h=h2hStats(g);
  const bttsNo=/^BTTS No$/i.test(p.label);
  const conflict=bttsNo&&(h.n<3||h.yes/h.n>=0.6);
  if(conflict){contradictions++;withdrawn++;continue}
  if(p.researchOnly){p.score=null;p.modelScore=null;p.stars='';p.confidenceType='unrated_research_only';uncalibrated++}
  else if(p.confidenceType==='uncalibrated_model_estimate'){p.score=null;p.modelScore=null;p.stars='';p.confidenceType='unrated_uncalibrated';uncalibrated++}
  if(!p.verifiedPrice){p.odds=null;p.displayOdds='Not verified'}
  next.push(p);
 }
 g.top3=next;g.top=next[0]||null;
 g.model={...(g.model||{}),top:g.top,top3:next};
 if(!next.length)g.researchStatus='No supported picks currently available.';
}
b.top5=(b.top5||[]).filter(item=>{const g=b.games.find(g=>String(g.id)===String(item.gameId));return g?.top3?.some(p=>p.label===item.pick?.label&&p.verifiedPrice&&!p.researchOnly)});
b.top5.forEach((x,i)=>{x.rank=i+1;x.pick={...b.games.find(g=>String(g.id)===String(x.gameId)).top3.find(p=>p.label===x.pick.label)}});
b.consistencyAudit={...b.consistencyAudit,duplicatesRemoved:duplicates,contradictoryBttsNoWithdrawn:contradictions,uncalibratedScoresHidden:uncalibrated,remainingPicks:b.games.reduce((n,g)=>n+g.top3.length,0),top5:b.top5.length};
b.correctionReason='Full-slate audit removed unsupported BTTS No markets, repeated disclaimers and uncalibrated percentage ratings. Preserve other analysis pending independent verification.';
for(const g of b.games)if(g.top?.label!==g.top3[0]?.label&&g.top3.length)throw Error('Mismatch '+g.id);
fs.writeFileSync(file,JSON.stringify(b,null,2)+'\n');
console.log(b.consistencyAudit);
