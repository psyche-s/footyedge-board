import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const day='2026-11-02';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const board=read(`data/boards/${day}.json`),review=read(`data/owner-reviews/${day}.json`),news=read(`data/team-intelligence/${day}.json`),research=read(`data/research-base-${day}.json`),sim=read(`data/experimental-simulations/${day}-v4.json`),slips=read(`data/slips-reviewed/${day}.json`);
test('every tracked fixture joins to three ranked researched picks, history, two predicted XIs, H2H and standings',()=>{
 assert.equal(board.games.length,8);assert.equal(review.matches.length,8);
 const tables=read(`data/league-tables/${day}.json`);
 for(const g of board.games){
  const r=review.matches.find(x=>x.gameId===g.id),n=news.fixtures.find(x=>x.fixtureId===g.id),h=research.fixtures.find(x=>x.id===g.id),m=sim.fixtures.find(x=>x.fixtureId===g.id);
  assert.equal(r.picks.length,3);assert.equal(new Set(r.picks.map(x=>x.label)).size,3);
  for(let i=0;i<3;i++){const p=r.picks[i];assert.equal(p.rank,i+1);assert.ok(p.reason.length>=45);assert.equal(p.score,null);assert.equal(p.odds,null);assert.equal(p.probabilityCalibrated,false);if(i)assert.ok(r.picks[i-1].confidenceRating>=p.confidenceRating);}
  for(const side of ['home','away']){assert.equal(h.last10[side].length,10);assert.equal(n[side].predictedXI.length,11);assert.equal(new Set(n[side].predictedXI).size,11);assert.equal(n[side].lineupStatus,'predicted-not-confirmed');assert.ok(n[side].newsSummary.length>25);}
  assert.ok(g.h2h.length);assert.ok(tables.standings[g.league].table.length>=8);assert.equal(m.simulations,10000);assert.equal(m.status,'pre_kickoff_experimental');
 }
 assert.equal(sim.totalSimulations,80000);assert.equal(sim.coverage.withExternalAnalystForecast,1);
});
test('current slips keep quote provenance and pending prices honest and meet the new cross-game target',()=>{
 const priced=slips.sgpsByLeague.filter(x=>x.status==='qualified');assert.equal(priced.length,3);
 for(const s of priced){assert.ok(s.combinedReferenceAmerican>=150);assert.equal(new Set(s.legs.map(x=>x.gameId)).size,1);assert.equal(s.verifiedCombinedPrice,false);assert.equal(s.combinedOntarioOdds,null);assert.equal(s.jointHitProbability,null);assert.ok(s.quoteSource.url.startsWith('https://'));}
 const pending=slips.sgpsByLeague.find(x=>x.league==='fra.1');assert.equal(pending.status,'hold');assert.ok(pending.legs.length>=2);assert.equal(pending.combinedReferenceAmerican,null);
 const a=slips.acca;assert.equal(a.minimumAmericanOdds,300);assert.equal(new Set(a.legs.map(x=>x.gameId)).size,a.legs.length);assert.ok(a.legs.every(x=>x.observedReferenceBook==='DraftKings'&&!['jpn.1','kor.1'].includes(x.league)));
 const dec=n=>n<0?1+100/-n:1+n/100;assert.equal(Math.round((a.legs.reduce((v,l)=>v*dec(l.observedReferenceOdds),1)-1)*100),a.combinedReferenceAmerican);assert.ok(a.combinedReferenceAmerican>=300);
});
test('real slip rendering accepts two or six supported SGP legs, preserves historical targets, and shows an unpriced candidate',()=>{
 const html=fs.readFileSync('top-picks.html','utf8');const code=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
 const nodes=new Map(),node=()=>({innerHTML:'',textContent:'',hidden:false,value:'',classList:{toggle(){}}});
 const context=vm.createContext({Intl,Date,URL,console,document:{getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)}},fetch:async()=>{throw Error('No network')},desk:slips});
 vm.runInContext(code.slice(0,code.indexOf('\nfillSgpSelect();')),context);
 vm.runInContext(`renderDesk(desk,'${day}')`,context);assert.match(nodes.get('accaPrice').innerHTML,/Target \+300/);assert.match(nodes.get('accaPrice').innerHTML,/\+438/);
 for(const size of [2,6]){const d=structuredClone(slips),s=d.sgpsByLeague[0];s.legs=Array.from({length:size},(_,i)=>({...s.legs[i%s.legs.length],label:'Supported market '+(i+1)}));d.sgp=s;context.candidate=d;vm.runInContext(`selectedSgpLeague='all';renderDesk(candidate,'${day}')`,context);assert.equal(nodes.get('sgpCount').textContent,size+' LEGS');}
 vm.runInContext(`selectedSgpLeague='fra.1';renderDesk(desk,'${day}')`,context);assert.match(nodes.get('sgpCount').textContent,/HOLD/);assert.equal(nodes.get('sgpLegBadge').textContent,'PRICE PENDING');assert.equal(nodes.get('sgpPrice').innerHTML,'');
 context.historical=read('data/slips-reviewed/2026-11-01.json');vm.runInContext(`selectedSgpLeague='all';renderDesk(historical,'2026-11-01')`,context);assert.match(nodes.get('accaPrice').innerHTML,/Target \+250/);assert.match(nodes.get('accaPrice').innerHTML,/\+254/);
});
