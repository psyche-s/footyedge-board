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
   asse¶»§q«^