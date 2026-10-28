import test from "node:test";
import assert from "node:assert/strict";
import {ownerPickCompatible,takeOwnerTop3} from "../scripts/owner-top3-ranking.mjs";
const p=(label,category,grade=80)=>({
 label,category,confidenceRating:grade,sourceBackedReason:true,
 reason:"Two date-verified teams' previous ten results support this outcome, with a source-matched 10000-run score forecast.",
 homeSample:10,awaySample:10
});
test("date-backed result, goal total and BTTS No can form an honest Top 3",()=>{
 const c=[p("Home or Draw","Double Chance",89),p("Under 3.5 Goals","Goals",85),p("BTTS No","BTTS",71)];
 const picks=takeOwnerTop3(c);
 assert.equal(picks.length,3);
 assert.deepEqual(picks.map(x=>x.rank),[1,2,3]);
});
test("logical implication is not counted as another independent betting edge",()=>{
 assert.equal(ownerPickCompatible(p("Over 1.5 Goals","Goals"),p("BTTS Yes","BTTS")),false);
 assert.equal(ownerPickCompatible(p("Over 1.5 Goals","Goals"),p("Home 1+ Goal","Team Goals")),false);
 assert.equal(ownerPickCompatible(p("Home ML","Match Result"),p("Home 1+ Goal","Team Goals")),false);
 assert.equal(ownerPickCompatible(p("Over 2.5 Goals","Goals"),p("BTTS Yes","BTTS")),true);
 assert.equal(ownerPickCompatible(p("Under 3.5 Goals","Goals"),p("BTTS No","BTTS")),true);
});
test("weak, incomplete, unverified and repeated picks never fill extra positions",()=>{
 const good=p("Away or Draw","Double Chance",88);
 const unverified=p("Over 2.5 Goals","Goals",85);unverified.sourceBackedReason=false;
 const small=p("BTTS Yes","BTTS",82);small.homeSample=2;
 const weak=p("Under 3.5 Goals","Goals",52);
 assert.equal(takeOwnerTop3([good,unverified,small,weak]).length,1);
});
