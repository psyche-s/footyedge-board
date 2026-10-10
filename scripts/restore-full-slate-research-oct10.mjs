#!/usr/bin/env node
import fs from 'node:fs';
const date='2026-10-10',file='data/boards/'+date+'.json',archive='data/board-revisions/'+date+'/pre-replacement-'+date+'.json';
const board=JSON.parse(fs.readFileSync(file,'utf8')),prior=JSON.parse(fs.readFileSync(archive,'utf8'));
const original=new Map(prior.games.map(g=>[String(g.id),g]));
let restored=0,unpriced=0,empty=0;
for(const g of board.games){
 const old=original.get(String(g.id));
 const existing=new Map((g.top3||[]).map(p=>[p.label,p]));
 const picks=[];
 for(const source of old?.top3||[]){
  if(source.h2hContradiction)continue;
  if(!source.reason||source.reason.length<10)continue;
  const p=structuredClone(existing.get(source.label)||source);
  const quoted=p.verifiedPrice===true&&Number.isFinite(p.odds)&&p.odds>=-500;
  const prob=Number(p.modelProb),market=Number(p.marketProb);
  const validProb=Number.isFinite(prob)&&prob>0&&prob<1;
  const ev=Number(p.ev);
  // No fake confidence: only show a probability when the stored model estimate exists.
  p.score=validProb?Math.round(prob*100):null;
  p.modelScore=p.score;
  p.confidenceType='uncalibrated_model_estimate';
  p.confidenceBasis='Indicative uncalibrated estimate, not a measured hit rate or guaranteed probability.';
  p.stars='';
  p.researchOnly=!quoted||!Number.isFinite(ev)||ev<=0;
  p.displayOnly=p.researchOnly;
  p.verifiedPrice=quoted;
  if(!quoted){p.odds=null;p.displayOdds='Not verified';unpriced++}
  p.reason=(p.reason||'').replace(/ The existing estimate trails the market-implied probability, reducing conviction\./g,'');
  if(p.researchOnly){
    p.reason+=' Research only — '+(!quoted?'no verified qualifying odds.':Number.isFinite(ev)&&ev<=0?'current stored estimate does not indicate positive value.':'insufficient evidence of value.');
  }
  p.modelVersion='research-recovery-2026-10-10';
  picks.push(p);
 }
 picks.sort((a,b)=>Number(a.researchOnly)-Number(b.researchOnly)||Number(b.score||0)-Number(a.score||0));
 g.top3=picks.slice(0,3);g.top=g.top3[0]||null;
 g.model={...(g.model||{}),top:g.top,top3:g.top3};
 if(!g.top3.length){empty++;g.researchStatus='Fixture listed; no sufficiently documented selection available.'}
 else {restored++;delete g.researchStatus}
}
const ranked=board.games.flatMap(g=>g.top3.filter(p=>!p.researchOnly&&p.verifiedPrice&&Number.isFinite(p.ev)&&p.ev>0).map(p=>({g,p}))).sort((a,b)=>b.p.ev-a.p.ev);
const used=new Set();board.top5=[];
// No Top 5 is safer than promoting uncalibrated or misleading picks as top bets.
board.modelVersion='research-recovery-2026-10-10';
board.confidenceFramework='Uncalibrated stored model estimates; research-only selections explicitly labelled';
board.correctedAt=new Date().toISOString();
board.correctionReason='Restore full-slate researched market details from archived pre-replacement board; canonicalize card and expanded rankings; do not advertise research-only picks as bets.';
board.consistencyAudit={fixtures:board.games.length,fixturesWithAnalysis:restored,fixturesWithoutSupportedMarkets:empty,unpricedResearchMarkets:unpriced,top5:board.top5.length};
if(board.games.length!==66)throw Error('Fixture count mismatch');
for(const g of board.games)if(g.top?.label!==(g.top3[0]?.label))throw Error('Top mismatch '+g.id);
fs.writeFileSync(file,JSON.stringify(board,null,2)+'\n');
console.log(board.consistencyAudit);
