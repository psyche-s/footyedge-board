#!/usr/bin/env node
/**
 * Owner-requested FootyEdge replacement board, 2026-10-10.
 * Re-ranks the complete fixture slate with a new evidence+external-consensus model.
 * Never presents research confidence as a calibrated event probability.
 * Source signals are date-specific public observations; no source names in public prose.
 * Historical frozen board is archived before correction.
 */
import fs from 'node:fs';
import path from 'node:path';
const DATE='2026-10-10', root='data/boards/'+DATE+'.json';
const original=fs.readFileSync(root,'utf8'),board=JSON.parse(original);
const stamp='2026-10-10T14:20:00Z';
const archive='data/board-revisions/'+DATE+'/pre-replacement-'+DATE+'.json';
fs.mkdirSync(path.dirname(archive),{recursive:true});
if(!fs.existsSync(archive))fs.writeFileSync(archive,original);
// Verified public research observations captured 2026-10-10; 1=home, X=draw, 2=away.
// Sources: https://www.predictz.com/predictions/ and https://www.forebet.com/en/prediction-lists/top-europe
// No assertion that the remaining providers were available or contributed.
const votes={
 'Arsenal|Leeds United':{predictz:'1',forebet:'X'},
 'Aston Villa|Brentford':{predictz:'2',forebet:'2'},
 'Chelsea|AFC Bournemouth':{predictz:'2',forebet:'X'},
 'Ipswich Town|Fulham':{predictz:'1',forebet:'1'},
 'Sunderland|Brighton & Hove Albion':{predictz:'2',forebet:'2'},
 'Manchester United|Tottenham Hotspur':{predictz:'1'}
};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const stars=s=>s>=90?'★★★★★':s>=85?'★★★★½':s>=80?'★★★★':s>=75?'★★★½':'★★★';
const normalize=s=>String(s||'').replace(/\s+/g,' ').trim();
function selection(g,p){
 const label=normalize(p.label),home=normalize(g.home),away=normalize(g.away);
 if(/double chance/i.test(label))return null;
 if(/\bML\b/i.test(label)){
  if(label.startsWith(home))return '1';
  if(label.startsWith(away))return '2';
 }
 if(label==='Draw')return 'X';
 return null;
}
const sourceLog=[];
for(const g of board.games||[]){
 const v=votes[normalize(g.home)+'|'+normalize(g.away)]||{};
 const known=Object.values(v);
 if(known.length)sourceLog.push({fixtureId:g.id,fixture:g.home+' v '+g.away,signals:v,asOf:stamp});
 for(const p of g.top3||[]){
  const priceOk=p.verifiedPrice===true&&Number.isFinite(p.odds)&&p.odds>=-500;
  const market=Number(p.marketProb),estimate=Number(p.modelProb);
  const priceEdge=priceOk&&Number.isFinite(market)&&Number.isFinite(estimate)?estimate-market:null;
  const selected=selection(g,p);
  const agrees=selected?known.filter(x=>x===selected).length:0;
  const disagrees=selected?known.filter(x=>x!==selected).length:0;
  // Distinct score from legacy: market/estimate alignment, conflicting published forecasts,
  // sample caution and price eligibility. This is an index, NOT calibrated win probability.
  const basis=Number.isFinite(estimate)&&estimate>=0&&estimate<=1?estimate:0.5;
  let confidence=52+Math.round((basis-.5)*45);
  if(priceEdge!==null)confidence+=Math.round(clamp(priceEdge,-.2,.2)*45);
  confidence+=agrees*8-disagrees*10;
  if(!priceOk)confidence-=18;
  if(!known.length)confidence-=7;
  confidence=clamp(confidence,25,92);
  const priorReason=normalize(p.reason||'');
  let why=priorReason&&priorReason.length>12?priorReason:'Available recent-form evidence is insufficient for a strong selection.';
  if(known.length&&selected){
    why+=' Independent match forecasts '+(agrees===known.length?'support this result.':agrees?'are mixed on this result.':'do not support this result.');
  }
  if(priceEdge!==null&&priceEdge<0)why+=' The existing estimate trails the market-implied probability, reducing conviction.';
  if(!priceOk)why+=' No qualifying verified sportsbook quote is available.';
  p.score=confidence;p.modelScore=confidence;p.stars=stars(confidence);
  p.reason=why;p.confidenceType='research_confidence_index';
  p.confidenceBasis='Research confidence index; not a calibrated outcome probability. External forecast coverage varies by fixture.';
  p.researchAgreement={available:known.length,agree:agrees,disagree:disagrees};
  p.modelVersion='source-consensus-replacement-2026-10-10';
 }
 g.top3=(g.top3||[]).filter(p=>p.verifiedPrice===true&&Number.isFinite(p.odds)&&p.odds>=-500&&p.score>=65&&!p.h2hContradiction&&!(Number.isFinite(p.ev)&&p.ev<0)).sort((a,b)=>b.score-a.score);\n if(!g.top3.length)g.researchStatus='No qualifying picks: available evidence does not support a verified, high-conviction market.';
}
const eligible=board.games.flatMap(g=>(g.top3||[]).filter(p=>p.verifiedPrice&&Number.isFinite(p.odds)&&p.odds>=-500&&p.score>=65&&p.reason).map(p=>({g,p})));
eligible.sort((a,b)=>b.p.score-a.p.score||a.g.id.localeCompare(b.g.id));
const chosen=[],seen=new Set();
for(const {g,p} of eligible){if(seen.has(g.id))continue;seen.add(g.id);chosen.push({rank:chosen.length+1,gameId:g.id,home:g.home,away:g.away,pick:structuredClone(p)});if(chosen.length===5)break}
board.top5=chosen;
board.modelVersion='source-consensus-replacement-2026-10-10';
board.confidenceFramework='Research confidence index; not calibrated win probability';
board.source='FootyEdge replacement research model — independently re-ranked historical match evidence and accessible public forecasts';
board.correctedAt=stamp;
board.correctionReason='Owner-requested new-model revision; original locked board preserved in data/board-revisions.';
board.modelCoverage={slateGames:board.games.length,publicForecastFixtures:sourceLog.length,publicForecastProviders:['PredictZ','Forebet'],otherRequestedProviders:'not yet integrated; not counted in confidence',limitations:'No new verified live sportsbook refresh; quotes are original dated snapshot. Confidence is uncalibrated.'};
board.modelReview={...(board.modelReview||{}),replacementModel:'source-consensus-replacement-2026-10-10',forecastFixtures:sourceLog.length};
fs.writeFileSync(root,JSON.stringify(board,null,2)+'\n');
const logPath='data/model-research/'+DATE+'-replacement-source-audit.json';
fs.mkdirSync(path.dirname(logPath),{recursive:true});
fs.writeFileSync(logPath,JSON.stringify({date:DATE,asOf:stamp,sourceURLs:['https://www.predictz.com/predictions/','https://www.forebet.com/en/prediction-lists/top-europe'],sourceLog,top5:chosen.map(x=>({fixture:x.gameId,label:x.pick.label,score:x.pick.score})),limits:board.modelCoverage.limitations},null,2)+'\n');
console.log('Replacement board',board.games.length,'games',chosen.length,'Top picks',sourceLog.length,'crosschecked fixtures');
if(board.games.length!==66||!chosen.length||chosen.length>5)throw Error('Bad coverage or Top 5');
if(chosen.some(x=>!x.pick.verifiedPrice||x.pick.odds< -500))throw Error('Unverified top pick');
