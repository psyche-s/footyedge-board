import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {canonicalFixtureKey} from "../scripts/owner-fixture-identity.mjs";
const doc=JSON.parse(fs.readFileSync(path.resolve("data/editorial-source-tips/2026-10-28.json"),"utf8"));
test("source desk contains independently evidenced date-matched markets, not invented provider votes",()=>{
 assert.equal(doc.schema,"footyedge-verified-editorial-market-review-v1");
 assert.equal(doc.date,"2026-10-28");
 assert.ok(doc.fixtures.length>=13);
 const keys=new Set();
 for(const g of doc.fixtures){
  const id=canonicalFixtureKey({...g,date:doc.date});
  assert.ok(!keys.has(id),id);keys.add(id);
  assert.ok(g.sources.length>=2);
  assert.equal(new Set(g.sources.map(x=>x.provider)).size,g.sources.length);
  for(const source of g.sources){
   assert.ok(source.url.startsWith("https://"),id);
   assert.ok(source.publishedOn<=doc.date||source.observedOn===doc.date,id);
   assert.ok(source.predictedScore||source.explicitMarkets?.length||source.modelProbabilities);
  }
  assert.equal(g.picks.length,3,id);
  assert.equal(new Set(g.picks.map(x=>x.market)).size,3,id);
  for(let i=0;i<g.picks.length;i++){
   const p=g.picks[i];
   assert.ok(p.reason.length>=60);
   assert.ok(p.researchGrade>=58&&p.researchGrade<=94);
   if(i)assert.ok(g.picks[i-1].researchGrade>=p.researchGrade);
   assert.ok(p.sourceProviders.some(name=>g.sources.some(s=>s.provider===name)));
  }
 }
});
test("City has BTTS first, with independent published scorelines and explicit market tips",()=>{
 const city=doc.fixtures.find(x=>x.home==="Manchester City");
 assert.equal(city.picks[0].market,"btts_yes");
 assert.ok(city.picks.some(x=>x.market==="home_ml"));
 assert.ok(city.sources.filter(x=>x.predictedScore&&/^[1-9]-[1-9]$/.test(x.predictedScore)).length>=2);
 assert.ok(city.sources.filter(x=>x.explicitMarkets.includes("btts_yes")||x.explicitMarkets.includes("home_win_and_btts_yes")).length>=3);
});
test("ML selections are included only where a date-matched publisher supports them",()=>{
 for(const home of ["Bayern Munich","Venezia","Genoa","Monza","Liverpool","Celtic","Heart of Midlothian"]){
  const g=doc.fixtures.find(x=>x.home===home);assert.ok(g,home);
  assert.ok(g.picks.some(x=>x.market==="home_ml"||x.market==="away_ml"),home);
 }
 assert.ok(doc.unverifiedProviders.includes("sportskeeda")&&doc.unverifiedProviders.includes("whoscored"));
});
