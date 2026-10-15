#!/usr/bin/env node
/** Publication-time metric safety gate. Historical boards are untouched. */
import fs from 'node:fs';
const local=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
const date=process.env.BOARD_DATE||local.year+'-'+local.month+'-'+local.day;
const file='data/boards/'+date+'.json';
if(!fs.existsSync(file)){console.log('No same-day board to sanitize');process.exit(0)}
const board=JSON.parse(fs.readFileSync(file,'utf8'));
if(board.date!==date)throw Error('Same-day guard failed');
const round=v=>Number(v.toFixed(6));
let calibrated=0,suppressed=0;
for(const game of board.games||[])for(const pick of game.top3||[]){
  const probability=Number(pick.calibratedProbability??pick.modelProb),decimal=Number(pick.priceDecimal);
  const validProbability=pick.probabilityCalibrated===true&&Number.isFinite(probability)&&probability>=0&&probability<=1;
  const exactPrice=pick.verifiedPrice===true&&pick.bookExact===true&&Number.isFinite(decimal)&&decimal>1;
  if(validProbability){
    pick.score=Math.round(probability*1000)/10;
    pick.modelProb=probability;
    pick.confidenceType='calibrated_exact_market_probability';
    pick.ev=exactPrice?round(probability*decimal-1):null;
    calibrated++;
  }else{
    pick.score=null;pick.modelScore=null;pick.baseScore=null;pick.ev=null;
    pick.probabilityCalibrated=false;pick.confidenceType='unrated_uncalibrated';
    pick.ratingMethod='N/A: no calibrated exact-market probability';suppressed++;
  }
}
for(const game of board.games||[]){
  game.top=game.top3?.[0]||null;
  game.model={...game.model,top:game.top,top3:game.top3||[],candidates:game.top3||[],rankedCandidates:game.top3||[],researchCandidates:game.top3||[]};
}
const eligible=(board.games||[]).filter(g=>Number.isFinite(g.top?.score));
eligible.sort((a,b)=>b.top.score-a.top.score||String(a.id).localeCompare(String(b.id)));
const refs=games=>games.slice(0,5).map((g,i)=>({rank:i+1,gameId:String(g.id),home:g.home,away:g.away,pick:JSON.parse(JSON.stringify(g.top))}));
board.top5=refs(eligible);
board.leagueTop5=Object.fromEntries([...new Set((board.games||[]).map(g=>g.league))].map(league=>[league,refs(eligible.filter(g=>g.league===league))]));
board.sourceQuality={...board.sourceQuality,metricSafetyGate:true,probabilityCalibrated:calibrated>0,
  confidenceMethod:calibrated?'finite calibrated exact-market probability only':'N/A: no calibrated exact-market probability available',
  evMethod:'100 * (p * decimal_odds - 1), exact market only; stored internally as decimal return'};
board.publicationNotes=String(board.publicationNotes||'').replace(/\s*Confidence is loss-risk-adjusted[^.]*\./g,'').trim();
fs.writeFileSync(file,JSON.stringify(board,null,2)+'\n');
console.log(JSON.stringify({date,calibrated,suppressed,top5:board.top5.length}));
