import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync('data/team-intelligence/2026-11-05.json','utf8'));
const report=JSON.parse(fs.readFileSync('data/lineup-source-reviews/2026-11-05.json','utf8'));
const x=id=>data.fixtures.find(g=>g.fixtureId===id);
test('Complete 38 match predicted XI pairs preserved and never labeled as confirmed',()=>{
 assert.equal(data.fixtures.length,38);assert.equal(new Set(data.fixtures.map(x=>x.fixtureId)).size,38);
 assert.ok(data.fixtures.every(g=>g.home.predictedXI.length===11&&g.away.predictedXI.length===11));
 assert.ok(data.fixtures.every(g=>!g.home.confirmedXI||g.home.confirmedXI.length!==11));
 assert.ok(data.fixtures.every(g=>!g.away.confirmedXI||g.away.confirmedXI.length!==11));
});
test('Corrections remove reported suspended player and retain forecasted scorers',()=>{
 assert.ok(!x('401915528').away.predictedXI.some(p=>/diakite|diakité/i.test(p)));
 assert.ok(x('401915528').away.predictedXI.includes('Evanilson'));
 assert.ok(x('401915819').home.predictedXI.includes('Dessers'));
 assert.ok(x('401915821').home.predictedXI.includes('Ünal'));
 assert.ok(!x('401915821').home.predictedXI.includes('Mayoral'));
 assert.ok(x('401915826').away.predictedXI.includes('De Vlieger'));
});
test('Only exact competition references and partial verified coverage are claimed',()=>{
 assert.equal(report.changes.length,7);assert.equal(report.officialXIsConfirmed,0);
 assert.equal(report.immutablePublishedPicksPreserved,true);
 for(const g of data.fixtures.filter(x=>x.league.startsWith('uefa.'))){
  assert.equal(g.lineupReferenceLinks?.length,2);
  assert.ok(g.lineupReferenceLinks.every(s=>s.url.startsWith('https://')));
 }
});