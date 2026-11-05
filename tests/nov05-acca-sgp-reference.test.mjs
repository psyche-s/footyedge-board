import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';const desk=JSON.parse(fs.readFileSync('data/slips-reviewed/2026-11-05.json','utf8'));
test('Two ACCA research categories keep independent fixture quotes, no Ontario payout or validated EV',()=>{
 for(const x of [desk.acca,desk.evAcca]){assert.equal(x.status,'hold');assert.equal(x.verifiedCombinedPrice,false);assert.equal(x.combinedOntarioOdds,null);assert.ok(x.legs.length>=3&&x.legs.length<=5);assert.equal(new Set(x.legs.map(l=>l.gameId)).size,x.legs.length);assert.ok(x.legs.every(l=>l.observedReferenceBook==='DraftKings'&&l.odds===null&&l.researchModelPct!==null));}
 assert.ok(desk.acca.combinedReferenceAmerican>=300);assert.ok(desk.evAcca.combinedReferenceAmerican>=300);
 assert.ok(desk.evAcca.legs.every(l=>l.theoreticalModelEVPct>0));
});
test('three 3–4-leg SGP baskets have standalone reference prices but no combined quote',()=>{
 assert.equal(desk.sgpsByLeague.length,3);
 for(const x of desk.sgpsByLeague){assert.equal(x.status,'hold');assert.equal(x.verifiedCombinedPrice,false);assert.equal(x.combinedReferenceAmerican,null);assert.ok([3,4].includes(x.legs.length));assert.equal(new Set(x.legs.map(l=>l.gameId)).size,1);assert.ok(x.legs.every(l=>l.sourceUrl.startsWith('https://')&&l.observedReferenceDecimal>1&&l.odds===null));}
});
test('Top Picks UI renders a dedicated EV ticket and research-only three/four-leg SGP cards',()=>{
 const p=fs.readFileSync('top-picks.html','utf8');assert.match(p,/id="evAccaSlip"/);assert.match(p,/drawSlip\(desk.evAcca/);assert.match(p,/PRICE HOLD/);assert.match(p,/\["qualified","hold"\]/);
});
