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
const local=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
const date=process.env.BOARD_DATE||local.year+'-'+local.month+'-'+local.day;
const file='data/boards/'+date+'.json';
if(!fs.existsSync(file)){console.log('No same-day board to normalize');process.exit(0)}
const board=JSON.parse(fs.readFileSync(file,'utf8'));
if(board.date!==date)throw Error('Same-day guard failed');
if(board.sourceQuality?.lossRiskCalculated===true||board.sourceQuality?.confidenceMethod?.startsWith('modeled probability of not losing')){
  console.log('Already loss-adjusted: frozen board untouched');process.exit(0);
}
const r=(v)=>Number(v.toFixed(4)),clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),avg=(a,k)=>a.reduce((s,x)=>s+Number(x[k]),0)/a.length;
function pmf(k,l){let p=Math.exp(-l);for(let n=1;n<=k;n++)p*=l/n;return p}
function markets(home,away){
 const h=clamp(.8*(.55*avg(home,'gf')+.45*avg(away,'ga'))*1.06+.2*1.3,.3,3.8);
 const a=clamp(.8*(.55*avg(away,'gf')+.45*avg(home,'ga'))*.96+.2*1.3,.3,3.8);
 const p={home:0,away:0,draw:0,over15:0,under35:0,btts:0,homeGoal:1-Math.exp(-h),awayGoal:1-Math.exp(-a)};
 for(let i=0;i<=10;i++)for(let j=0;j<=10;j++){
  const v=pmf(i,h)*pmf(j,a);
  if(i>j)p.home+=v;else if(i<j)p.away+=v;else p.draw+=v;
  if(i+j>=2)p.over15+=v;if(i+j<=3)p.under35+=v;if(i>0&&j>0)p.btts+=v;
 }
 return p;
}
let reviewed=0,missed=0;
for(const g of board.games||[]){
 const home=g.baseResearch?.last10?.home||[],away=g.baseResearch?.last10?.away||[];
 if(home.length<5||away.length<5||home.some(x=>!Number.isFinite(Number(x.gf))||!Number.isFinite(Number(x.ga)))||away.some(x=>!Number.isFinite(Number(x.gf))||!Number.isFinite(Number(x.ga)))){
  for(const pick of g.top3||[])if(pick.confidenceType!=='footyedge_loss_adjusted_rating'){pick.score=null;pick.modelScore=null;pick.baseScore=null;pick.lossProbability=null;missed++}
  continue;
 }
 const m=markets(home,away);
 for(const pick of g.top3||[]){
  const label=String(pick.label||'').toLowerCase(),h=String(g.home).toLowerCase(),a=String(g.away).toLowerCase();
  let success=null;
  if(pick.category==='Match Result'){
   success=typeof pick.modelProb==='number'&&pick.modelProb>0?pick.modelProb:label.includes(h)?m.home:label.includes(a)?m.away:label.includes('draw')?m.draw:null;
  }else if(pick.category==='Double Chance'){
   // 1X = not away win; X2 = not home win; 12 = not draw.
   success=label.includes('1x')||label.includes('home or draw')?1-m.away:label.includes('x2')||label.includes('draw or away')?1-m.home:label.includes('12')||label.includes('home or away')?1-m.draw:null;
  }else if(pick.category==='Goals'){
   if(label.includes('over 1.5'))success=m.over15;
   else if(label.includes('under 3.5'))success=m.under35;
  }else if(pick.category==='Team Goals'){
   if(label.includes('over 0.5'))success=label.includes(h)?m.homeGoal:label.includes(a)?m.awayGoal:null;
  }else if(pick.category==='BTTS')success=label.includes('no')?1-m.btts:m.btts;
  if(!Number.isFinite(success)){pick.score=null;pick.modelScore=null;pick.baseScore=null;pick.lossProbability=null;missed++;continue}
  const prob=clamp(success,.01,.99),loss=1-prob,score=Math.round((1-loss)*100);
  Object.assign(pick,{score,modelScore:score,baseScore:score,modelProb:r(prob),lossProbability:r(loss),confidenceType:'footyedge_loss_adjusted_rating',probabilityCalibrated:false,ratingMethod:'100% minus estimated losing-outcome probability for the exact market'});
  if(pick.category==='Match Result'){const draw=Math.min(loss,m.draw);pick.lossComponents={draw:r(draw),opponentWin:r(loss-draw)}}
  if(pick.verifiedPrice&&Number.isFinite(Number(pick.priceDecimal))&&Number(pick.priceDecimal)>1)pick.ev=r(prob*Number(pick.priceDecimal)-1);
  else if(!pick.verifiedPrice)pick.ev=null;
  reviewed++;
 }
 g.top=(g.top3||[])[0]||null;
 g.model={...g.model,top:g.top,top3:g.top3,candidates:g.top3,rankedCandidates:g.top3,researchCandidates:g.top3};
}
const shortlist=(board.games||[]).filter(g=>g.top3?.[0]?.verifiedPrice&&Number.isFinite(g.top3[0].score)&&Number.isFinite(g.top3[0].ev)&&Number(g.top3[0].odds)>=-500).sort((a,b)=>b.top3[0].score-a.top3[0].score||(b.top3[0].ev??-1)-(a.top3[0].ev??-1));
const refs=rows=>rows.slice(0,5).map((g,i)=>({rank:i+1,gameId:String(g.id),home:g.home,away:g.away,pick:JSON.parse(JSON.stringify(g.top3[0]))}));
board.top5=refs(shortlist);
board.leagueTop5=Object.fromEntries([...new Set((board.games||[]).map(g=>g.league))].map(l=>[l,refs(shortlist.filter(g=>g.league===l))]));
board.editorialTop5Order=board.top5.map(p=>p.gameId);
board.sourceQuality={...board.sourceQuality,lossRiskCalculated:true,confidenceMethod:'100% minus estimated probability of exact-market loss; ML draws count as losses',probabilityCalibrated:false};
board.publicationNotes=String(board.publicationNotes||'')+' Confidence is loss-risk-adjusted, not calibrated and not a guaranteed win rate.';
fs.writeFileSync(file,JSON.stringify(board,null,2)+String.fromCharCode(10));
console.log(JSON.stringify({date,reviewed,unavailable:missed,top5:board.top5.length}));
