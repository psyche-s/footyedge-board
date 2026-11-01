import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const day='2026-11-01';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const board=read(`data/boards/${day}.json`);
const review=read(`data/owner-reviews/${day}.json`);
const intel=read(`data/team-intelligence/${day}.json`);
const slips=read(`data/slips-reviewed/${day}.json`);
test('all 43 fixture IDs join to three ranked picks and two labelled full XIs',()=>{
 assert.equal(review.matches.length,43);assert.equal(intel.fixtures.length,43);
 for(const g of board.games){
  const p=review.matches.find(x=>String(x.gameId)===String(g.id));
  const n=intel.fixtures.find(x=>String(x.fixtureId)===String(g.id));
  assert.ok(p&&n,g.id);assert.equal(p.home,g.home);assert.equal(p.away,g.away);
  assert.equal(p.picks.length,3);assert.equal(new Set(p.picks.map(x=>x.label)).size,3);
  p.picks.forEach((x,i)=>{assert.equal(x.rank,i+1);assert.ok(x.reason.length>40);assert.equal(x.odds,null);assert.equal(x.probabilityCalibrated,false);if(i)assert.ok(p.picks[i-1].confidenceRating>=x.confidenceRating);});
  for(const side of ['home','away']){
   assert.equal(n[side].name,g[side]);assert.equal((n[side].confirmedXI||n[side].predictedXI).length,11);
   assert.ok(['confirmed','predicted-not-confirmed','prior-match-XI-not-confirmed'].includes(n[side].lineupStatus));
  }
 }
 assert.equal(intel.coverage.confirmed,4);assert.equal(intel.coverage.previousXI,3);
});
test('official MLS absences cannot appear in the current projected lineups',()=>{
 const out={
  '761927':['Cubas','Sabbi','Elloumi','Badwal'],
  '761931':['Mihaj','Reilly','Zimmerman','Palacio','Franklin'],
  '761920':['Donkor','Nealis'],
  '761921':['Tillman','Thayllon','Trapp'],
  '761933':['Fory','Kamal Miller','Bonetig','Mosquera','McGraw']
 };
 for(const [id,names] of Object.entries(out)){
  const g=intel.fixtures.find(x=>x.fixtureId===id);
  const xi=[...g.home.predictedXI,...g.away.predictedXI].map(x=>typeof x==='string'?x:x.name).join(' | ');
  for(const name of names)assert.ok(!xi.toLowerCase().includes(name.toLowerCase()),`${id}: ${name}`);
 }
 const t=intel.fixtures.find(x=>x.fixtureId==='401876417');assert.ok(!t.away.predictedXI.some(x=>x.includes('Messali')));
});
test('five major leagues meet the SGP quote floor; no joint hit rate or Ontario price is invented',()=>{
 assert.deepEqual(slips.sgpsByLeague.map(x=>x.league).sort(),['eng.1','esp.1','fra.1','ger.1','ita.1']);
 for(const s of slips.sgpsByLeague){
  assert.equal(new Set(s.legs.map(x=>x.gameId)).size,1);assert.ok(s.combinedReferenceAmerican>=150);
  assert.equal(s.verifiedCombinedPrice,false);assert.equal(s.jointHitProbability,null);
  assert.ok(s.quoteSource.url.startsWith('https://'));assert.equal(s.combinedOntarioOdds,null);
 }
 const a=slips.acca;assert.equal(new Set(a.legs.map(x=>x.gameId)).size,a.legs.length);
 const decimal=n=>n<0?1+100/-n:1+n/100;
 const payout=Math.round((a.legs.reduce((v,l)=>v*decimal(l.observedReferenceOdds),1)-1)*100);
 assert.equal(payout,a.combinedReferenceAmerican);assert.ok(payout>=250);
 assert.ok(a.legs.every(x=>!['jpn.1','kor.1','ksa.1'].includes(x.league)));
});
test('actual slip renderer shows prices, supports all five league selections and preserves missing grades',()=>{
 const html=fs.readFileSync('top-picks.html','utf8');
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
 const code=scripts.slice(0,scripts.indexOf('\nfillSgpSelect();'));
 const nodes=new Map();const node=()=>({innerHTML:'',textContent:'',hidden:false,value:'',classList:{toggle(){}}});
 const context=vm.createContext({Intl,Date,URL,console,document:{getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)}},fetch:async()=>{throw Error('No network')},desk:slips});
 vm.runInContext(code,context);
 vm.runInContext(`renderDesk(desk,'${day}')`,context);
 assert.match(nodes.get('sgpPrice').innerHTML,/\+381/);assert.match(nodes.get('accaPrice').innerHTML,/\+254/);
 assert.equal((nodes.get('sgpLeagueList').innerHTML.match(/class="fe-leagueReceipt"/g)||[]).length,5);
 vm.runInContext(`selectedSgpLeague='fra.1';renderDesk(desk,'${day}')`,context);
 assert.match(nodes.get('sgpPrice').innerHTML,/\+180/);assert.doesNotMatch(nodes.get('sgpSlip').innerHTML,/null%|NaN|0%/);
 vm.runInContext('fillSgpSelect()',context);assert.equal((nodes.get('sgpCompetitionSelect').innerHTML.match(/<option/g)||[]).length,6);
});
test('player profile has one heading and one season statistics presentation',()=>{
 const ui=fs.readFileSync('ui/part2.html','utf8');
 assert.doesNotMatch(ui,/PLAYER INTELLIGENCE \/ PROFILE|FootyEdge · Player intelligence/);
 assert.match(ui,/<span>Player profile<\/span>/);
 assert.match(ui,/fe-playerSubtitle/);assert.doesNotMatch(ui,/All recorded season statistics/);
});
