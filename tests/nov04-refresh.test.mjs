import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const day='2026-11-04',board=read(`data/boards/${day}.json`),review=read(`data/owner-reviews/${day}.json`),intel=read(`data/team-intelligence/${day}.json`),sim=read(`data/experimental-simulations/${day}-v4.json`),history=read('data/performance/history.json');
test('all active November 4 fixtures have full coverage or an explicit evidence gap',()=>{
 assert.equal(board.games.length,21);assert.equal(board.top5.length,5);
 const active=board.games.filter(g=>g.status!=='postponed');assert.equal(active.length,14);
 assert.equal(active.filter(g=>g.top3.length===3).length,13);
 for(const g of active.filter(g=>g.top3.length)){
  const n=intel.fixtures.find(x=>x.fixtureId===g.id),m=sim.fixtures.find(x=>x.fixtureId===g.id);
  assert.equal(n.home.predictedXI.length,11);assert.equal(n.away.predictedXI.length,11);
  assert.equal(n.home.lineupStatus,'predicted-not-confirmed');assert.equal(n.away.lineupStatus,'predicted-not-confirmed');
  assert.equal(m.simulations,10000);assert.equal(m.status,'pre_kickoff_experimental');
  assert.ok(Math.abs(Object.values(m.winDrawLossPct).reduce((a,b)=>a+b,0)-100)<0.02);
  for(const k of ['shots','shotsOnTarget','corners','fouls','yellowCards','tackles','passes'])assert.ok(Number.isFinite(m.teamProjections.home[k])&&Number.isFinite(m.teamProjections.away[k]),g.id+' '+k);
  for(const p of g.top3){assert.equal(p.score,null);assert.equal(p.ev,null);assert.equal(p.probabilityCalibrated,false);}
 }
 const missing=active.find(g=>!g.top3.length);assert.equal(missing.id,'401933098');assert.match(missing.recoveryStatus,/PASS/);
 assert.equal(sim.fixtures.find(x=>x.fixtureId===missing.id).expectedGoals,null);
});
test('seven officially postponed cup ties have no picks or active predictions',()=>{
 const status=read(`data/fixture-status/${day}.json`);assert.equal(status.fixtures.length,7);
 for(const x of status.fixtures){const g=board.games.find(g=>g.id===x.gameId);assert.equal(g.status,'postponed');assert.equal(g.top3.length,0);assert.equal(g.projections.status,'withheld-postponed');assert.equal(review.matches.find(r=>r.gameId===g.id).picks.length,0);}
});
test('all three candidate SGPs and one cross-game candidate are visible without invented payouts',()=>{
 const slips=read(`data/slips-reviewed/${day}.json`);assert.equal(slips.sgpsByLeague.length,3);assert.equal(slips.crossGameParlays.length,1);
 for(const s of [...slips.sgpsByLeague,slips.acca]){assert.equal(s.status,'hold');assert.equal(s.verifiedCombinedPrice,false);assert.equal(s.combinedOntarioOdds,null);assert.equal(s.jointHitProbability,null);assert.ok(s.experimentalJointScenarioPct>0&&s.experimentalJointScenarioPct<100);}
 assert.ok(slips.acca.estimatedFromIndependentReferenceSingles.american>=300);
 assert.equal(new Set(slips.acca.legs.map(l=>l.gameId)).size,slips.acca.legs.length);
 const d=history.days.find(d=>d.date===day);assert.equal(d.top5.length,5);assert.equal(d.tickets.length,4);assert.ok(d.top5.every(x=>x.result==='pending'));assert.ok(d.tickets.every(t=>t.trackable===false));
});
test('the previous day tackle leg has its explicit numeric final result',()=>{
 const d=read('data/performance/slips/2026-11-03.json');const cash=d.tickets.flatMap(t=>t.legs).find(l=>l.label==='Matty Cash 2+ Tackles');assert.equal(cash.result,'miss');assert.equal(cash.observedStat,1);assert.equal(cash.observedUnit,'Tackles');
 assert.ok(d.tickets.flatMap(t=>t.legs).every(l=>l.result!=='pending'));
});
test('the live slip renderer exposes every supported competition candidate with price pending',()=>{
 const html=fs.readFileSync('top-picks.html','utf8');
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
 const code=scripts.slice(0,scripts.indexOf('\nfillSgpSelect();'));
 const nodes=new Map(),node=()=>({innerHTML:'',textContent:'',hidden:false,value:'',classList:{toggle(){}}});
 const desk=read(`data/slips-reviewed/${day}.json`);
 const context=vm.createContext({Intl,Date,URL,console,document:{getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);}},fetch:async()=>{throw Error('No network');},desk});
 vm.runInContext(code,context);
 vm.runInContext(`renderDesk(desk,'${day}')`,context);
 assert.equal((nodes.get('sgpCompetitionSelect').innerHTML.match(/<option/g)||[]).length,3);
 for(const slip of desk.sgpsByLeague.filter(s=>s.league!=='eng.2')){
  assert.ok(nodes.get('sgpCompetitionSelect').innerHTML.includes(`value="${slip.league}"`));
  vm.runInContext(`selectedSgpLeague='${slip.league}';renderDesk(desk,'${day}')`,context);
  for(const leg of slip.legs)assert.ok(nodes.get('sgpSlip').innerHTML.includes(leg.label));
  assert.equal(nodes.get('sgpLegBadge').textContent,'PRICE PENDING');
 }
});
