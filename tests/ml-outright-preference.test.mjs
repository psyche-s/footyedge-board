import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {buildReviewedPicks} from "../scripts/build-top3-review.mjs";
import {ownerPickCompatible} from "../scripts/owner-top3-ranking.mjs";
import {mergeModelReviewed} from "../scripts/build-source-led-picks.mjs";

test("pre-match evidence supports Roma, Real Madrid, and Kocaelispor ML without redundant DC",()=>{
 const day="2026-11-07";
 const research=JSON.parse(fs.readFileSync("data/research-base-"+day+".json","utf8"));
 const simulation=JSON.parse(fs.readFileSync("data/experimental-simulations/"+day+"-v3.json","utf8"));
 const names=["AS Roma","Real Madrid","Kocaelispor"];
 const selected=research.fixtures.filter(f=>names.some(n=>f.home.name===n||f.away.name===n));
 assert.equal(selected.length,3,"three stored, independently dated match samples required");
 const prev=process.env.OWNER_OVERRIDE_DATE;
 process.env.OWNER_OVERRIDE_DATE=day;
 try{
  const res=buildReviewedPicks({research:{...research,fixtures:selected},simulation,news:{fixtures:[]},standings:null,editorialCrosschecks:null});
  assert.equal(res.matches.length,3);
  for(const name of names){
   const row=res.matches.find(m=>m.home===name||m.away===name);
   assert.ok(row, "fixture "+name+" missing");
   const ml=row.picks.find(p=>p.label===name+" ML");
   assert.ok(ml, name+" ML must be considered as one of the three");
   assert.equal(ml.probabilityCalibrated,false);
   assert.equal(ml.verifiedPrice,false);
   assert.ok(ml.marketEvidence.verifiedFormDominance);
   for(let i=0;i<row.picks.length;i++)for(let j=i+1;j<row.picks.length;j++)
    assert.ok(ownerPickCompatible(row.picks[i],row.picks[j]),"overlapping picks for "+name);
  }
 }finally{if(prev===undefined)delete process.env.OWNER_OVERRIDE_DATE;else process.env.OWNER_OVERRIDE_DATE=prev}
});


test("source-led fallback preserves sourced-form-dominant 53% Kocaelispor ML as unpriced model research",()=>{
 const day="2026-11-07";
 const research=JSON.parse(fs.readFileSync("data/research-base-"+day+".json","utf8"));
 const simulation=JSON.parse(fs.readFileSync("data/experimental-simulations/"+day+"-v3.json","utf8"));
 const f=research.fixtures.find(x=>x.away.name==="Kocaelispor");
 const sim=simulation.fixtures.find(x=>String(x.fixtureId)===String(f.id));
 const prev=process.env.OWNER_OVERRIDE_DATE; process.env.OWNER_OVERRIDE_DATE=day;
 try{
  const review=buildReviewedPicks({research:{...research,fixtures:[f]},simulation,news:{fixtures:[]},standings:null,editorialCrosschecks:null});
  const doc={date:day,matches:[{gameId:f.id,home:f.home.name,away:f.away.name,league:f.league,picks:[],qualifyingInputs:{}}],totals:{fixtures:1}};
  const merged=mergeModelReviewed({doc,review,simulation});
  const row=merged.matches[0];
  assert.ok(row.picks.some(x=>x.label==="Kocaelispor ML"));
  assert.ok(row.picks.every(x=>x.odds===null&&x.verifiedPrice===false));
 }finally{if(prev===undefined)delete process.env.OWNER_OVERRIDE_DATE;else process.env.OWNER_OVERRIDE_DATE=prev}
});
