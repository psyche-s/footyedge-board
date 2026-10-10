#!/usr/bin/env node
import fs from 'node:fs';
const file='data/boards/2026-10-10.json';
const board=JSON.parse(fs.readFileSync(file,'utf8'));
let mismatches=0,withdrawn=0,retained=0;
const eligible=p=>p&&p.verifiedPrice===true&&Number.isFinite(p.odds)&&p.odds>=-500&&Number.isFinite(p.score)&&p.score>=65&&!p.h2hContradiction&&!(Number.isFinite(p.ev)&&p.ev<0)&&typeof p.reason==='string'&&p.reason.length>12;
for(const g of board.games){
 const old=g.top?.label||null;
 g.top3=(g.top3||[]).filter(eligible).sort((a,b)=>b.score-a.score);
 withdrawn+=(g.model?.top3||[]).length-g.top3.length;
 g.top=g.top3[0]||null;
 if(!g.model||typeof g.model!=='object')g.model={};
 g.model.top=g.top;
 g.model.top3=g.top3;
 if(old!==(g.top?.label||null))mismatches++;
 if(!g.top3.length)g.researchStatus='No qualifying verified selection. The available evidence does not support a recommended bet.';
 else {retained+=g.top3.length;delete g.researchStatus}
 if(g.top?.label!==g.top3[0]?.label&&g.top3.length)throw Error('Card mismatch '+g.id);
 if(g.model.top?.label!==g.top?.label)throw Error('Model mismatch '+g.id);
}
const ranked=board.games.flatMap(g=>g.top3.map(p=>({g,p}))).sort((a,b)=>b.p.score-a.p.score||String(a.g.id).localeCompare(String(b.g.id)));
const seen=new Set();board.top5=[];
for(const {g,p} of ranked){if(seen.has(g.id))continue;seen.add(g.id);board.top5.push({rank:board.top5.length+1,gameId:g.id,home:g.home,away:g.away,pick:structuredClone(p)});if(board.top5.length===5)break}
board.correctedAt=new Date().toISOString();
board.correctionReason='Full-slate canonical pick reconciliation: card, filter, and expanded analysis share identical ranked picks; unsupported and unpriced selections withdrawn.';
board.consistencyAudit={fixtures:board.games.length,cardMismatchesCorrected:mismatches,qualifyingPicks:retained,top5:board.top5.length};
if(board.games.length!==66)throw Error('Incomplete fixture slate');
fs.writeFileSync(file,JSON.stringify(board,null,2)+'\n');
console.log(JSON.stringify(board.consistencyAudit));
