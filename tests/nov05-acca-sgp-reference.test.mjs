import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';const desk=JSON.parse(fs.readFileSync('data/slips-reviewed/2026-11-05.json','utf8'));
test('Two ACCA research categories keep independent fixture quotes, no Ontario payout or validated EV',()=>{
 for(const x of [desk.acca,desk.evAcca]){assert.equal(x.status,'hold');assert.equal(x.verifiedCombinedPrice,false);assert.equal(x.combinedOntarioOdds,null);assert.ok(x.legs.length>=3&&x.legs.length<=5);assert.equal(new Set(x.legs.map(l=>l.gameId)).size,x.legs.length);assert.ok(x.legs.every(l=>l.observedReferenceBook==='DraftKings'&&l.odds===null&&l.researchModelPct!==null));}
 assert.ok(desk.acca.combinedReferenceAmerican>=300);assert.ok(desk.evAcca.combinedReferenceAmerican>=300);
 assert.ok(desk.evAcca.legs.every(l=>l.theoreticalModelEVPct>0));
});
test('two UEL and UECL SGP research baskets contain no unsupported corners or cards',()=>{
 assert.equal(desk.sgpsByLeague.length,2);
 assert.equal(new Set(desk.sgpsByLeague.map(x=>x.league)).size,2);
 for(const x of desk.sgpsByLeague){
  assert.equal(x.status,'hold');assert.equal(x.verifiedCombinedPrice,false);
  assert.equal(x.combinedOntarioOdds,null);assert.equal(x.combinedReferenceAmerican,null);
  assert.equal(x.legs.length,2);
  assert.equal(new Set(x.legs.map(l=>l.gameId)).size,1);
  assert.ok(x.legs.every(l=>l.sourceUrl.startsWith('https://')&&l.observedReferenceDecimal>1&&l.odds===null&&!l.verifiedPrice));
  assert.ok(x.legs.every(l=>!/corner|booking|card/i.test(l.label)));
  assert.ok(x.legs.every(l=>l.researchModelPct>0&&l.modelCalibrated===false));
 }
 assert.equal(desk.sgp.id,desk.sgpsByLeague[0].id);
});
test('Top Picks UI renders a dedicated EV ticket and research-only two-leg SGP cards',()=>{
 const p=fs.readFileSync('top-picks.html','utf8');assert.match(p,/id="evAccaSlip"/);assert.match(p,/drawSlip\(desk.evAcca/);assert.match(p,/PRICE HOLD/);assert.match(p,/\["qualified","hold"\]/);assert.match(p,/\[2,3,4,5\]/);
});
