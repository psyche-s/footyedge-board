#!/usr/bin/env node
/**
 * FootyEdge publication-time loss-risk confidence normalizer.
 * Runs only before the freshly generated daily board is committed; once applied
 * the frozen board is never changed by this job. Older boards are untouched.
 *
 * For exact market M, confidence = 1 - P(M loses).
 * ML loss includes DRAW as well as the other side winning.
 * DC loss excludes draws when a draw pays as a win.
 * Estimates are uncalibrated and must not be advertised as 90% guaranteed.
 */
import fs from 'node:fs';
import {rankPublishedBoard} from './rank-published-picks.mjs';
import {estimateMarketOutcome} from './market-risk.mjs';
const local=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
const date=process.env.BOARD_DATE||local.year+'-'+local.month+'-'+local.day;
const file='data/boards/'+date+'.json';
if(!fs.existsSync(file)){console.log('No same-day board to normalize');process.exit(0)}
const board=JSON.parse(fs.readFileSync(file,'utf8'));
if(board.date!==date)throw Error('Same-day guard failed');
if(board.sourceQuality?.lossRiskCalculated===true||board.sourceQuality?.confidenceMethod?.startsWith('modeled probability of not losing')){
  console.log('Already loss-adjusted: frozen board untouched');process.exit(0);
}
// Do not retroactively modify a board already published in a previous run.
const frozen=Date.parse(board.frozenAt||'');
if(board.immutable===true&&(!Number.isFinite(frozen)||Date.now()-frozen>30*60*1000)){
 console.log('Published board outside current freeze transaction; leave immutable snapshot unchanged');process.exit(0);
}
const r=(v)=>Number(v.toFixed(4)),clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
let reviewed=0,missed=0;
for(const g of board.games||[]){
 const home=g.baseResearch?.last10?.home||[],away=g.baseResearch?.last10?.away||[];
 if(home.length<5||away.length<5||home.some(x=>!Number.isFinite(Number(x.gf))||!Number.isFinite(Number(x.ga)))||away.some(x=>!Number.isFinite(Number(x.gf))||!Number.isFinite(Number(x.ga)))){
  for(const pick of g.top3||[])if(pick.confidenceType!=='footyedge_loss_adjusted_rating'){pick.score=null;pick.modelScore=null;pick.baseScore=null;pick.lossProbability=null;missed++}
  continue;
 }
 for(const pick of g.top3||[]){
  // Prefer the existing pre-match multi-factor forecast (including its venue,
  // opponent and limited H2H signals). Use team-scoreline math only as a
  // disclosed fallback for an exactly supported market.
  const estimate=estimateMarketOutcome({pick,game:g,homeHistory:home,awayHistory:away});
  const success=estimate.success;
  if(!Number.isFinite(success)){
   pick.score=null;pick.modelScore=null;pick.baseScore=null;pick.lossProbability=null;
   pick.confidenceType="unrated_uncalibrated";pick.ev=null;
   pick.ratingMethod="Unavailable: exact market probability not supported by verified research";
   missed++;continue;
  }
  const prob=clamp(success,.01,.99),loss=1-prob,score=Math.round((1-loss)*100);
  Object.assign(pick,{score,modelScore:score,baseScore:score,modelProb:r(prob),lossProbability:r(loss),
   confidenceType:"footyedge_loss_adjusted_rating",probabilityCalibrated:false,
   confidenceSource:estimate.source,
   ratingMethod:"100% minus model-estimated losing probability for this exact market"});
  if(pick.category==="Match Result"){
   if(Number.isFinite(estimate.drawLoss)&&estimate.drawLoss>0){
    const draw=Math.min(loss,estimate.drawLoss);
    pick.lossComponents={draw:r(draw),opponentWin:r(loss-draw)};
   }else delete pick.lossComponents;
  }
  if(pick.verifiedPrice&&Number.isFinite(Number(pick.priceDecimal))&&Number(pick.priceDecimal)>1)
   pick.ev=r(prob*Number(pick.priceDecimal)-1);
  else if(!pick.verifiedPrice)pick.ev=null;
  reviewed++;
 }

}
// Ranking is applied AFTER the loss-risk estimates for all candidate markets.
// A higher-scoring goals or team-goals selection cannot be displaced by
// a lower-scoring ML just because the latter has a bookmaker price.
const ranking=rankPublishedBoard(board,{minimumTop5Confidence:85});
board.sourceQuality={...board.sourceQuality,lossRiskCalculated:true,confidenceMethod:'100% minus estimated probability of exact-market loss, original multi-factor probability preferred; scoreline fallback explicit',probabilityCalibrated:false};
board.publicationNotes=String(board.publicationNotes||'')+' Confidence is loss-risk-adjusted, not calibrated and not a guaranteed win rate.';
fs.writeFileSync(file,JSON.stringify(board,null,2)+String.fromCharCode(10));
console.log(JSON.stringify({date,reviewed,unavailable:missed,top5:board.top5.length,correctedOrdering:ranking.correctedMatches}));
