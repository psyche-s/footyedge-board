import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
test("owner-approved correction is separate from locked archive",()=>{
 const b=read("data/boards/2026-10-15.json"),c=read("data/corrections/2026-10-15-v5.json");
 assert.equal(b.immutable,true);assert.equal(b.state,"locked");assert.equal(b.top5.length,0);
 assert.equal(c.date,b.date);assert.equal(c.ownerApproved,true);assert.equal(c.immutableOriginalPreserved,true);
 assert.equal(c.originalArchive,"data/boards/2026-10-15.json");
 assert.equal(c.games.length,39);assert.equal(b.games.length,3);
 for(const g of c.games){assert.ok(g.id);assert.ok(g.top3.length<=3);
  for(const p of g.top3){assert.equal(p.odds,null);assert.equal(p.ev,null);assert.equal(p.score,null);assert.equal(p.probabilityCalibrated,false);assert.equal(p.researchOnly,true);assert.ok(p.homeSample===undefined||p.homeSample>0);}}
 for(const [i,x] of c.top5.entries()){assert.equal(x.rank,i+1);assert.deepEqual(x.pick,c.games.find(g=>g.id===x.gameId)?.top)}
});
test("both homepage and match cards explicitly load versioned correction",()=>{
 for(const p of ["index.html","ui/part2.html"]){const s=fs.readFileSync(p,"utf8");assert.match(s,/data\/corrections\/2026-10-15-v5\.json/)}
});
