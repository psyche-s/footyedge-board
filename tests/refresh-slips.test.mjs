import test from "node:test";import assert from "node:assert/strict";
import{eventStatus,qualifies,rebuild}from"../api/refresh-slips.js";
const NOW=Date.parse("2026-10-21T12:00:00Z");
const leg=(league,offset,id,label="Over 1.5 Goals",family="total")=>({league,kickoff:new Date(NOW+offset*60000).toISOString(),gameId:String(id),label,family,rating:93,risk:[]});
test("kickoff, completed and excluded regions never enter slips",()=>{
 assert.equal(qualifies(leg("jpn.1",40,1),NOW,new Map()),false);
 assert.equal(qualifies(leg("kor.1",40,1),NOW,new Map()),false);
 assert.equal(qualifies(leg("ksa.1",40,1),NOW,new Map()),false);
 assert.equal(qualifies(leg("eng.1",3,1),NOW,new Map()),false);
 assert.equal(qualifies(leg("eng.1",20,1),NOW,new Map([["1",{done:true}]])),false);
 assert.equal(qualifies(leg("eng.1",20,1),NOW,new Map()),true);
});
test("status distinguishes active, completed and postponements",()=>{
 assert.equal(eventStatus({status:{type:{state:"in"}}}).live,true);
 assert.equal(eventStatus({status:{type:{completed:true}}}).done,true);
 assert.equal(eventStatus({status:{type:{name:"STATUS_POSTPONED"}}}).cancelled,true);
});
test("readonly rerank draws from eligible source-backed pool",()=>{
 const pool=[leg("eng.1",60,1),leg("eng.1",60,1,"Team A 1+ Goal","team-goal"),
  leg("ita.1",65,2),leg("esp.1",80,3),leg("ger.1",90,4,"Team B 1+ Goal","team-goal"),
  leg("uefa.champions",90,5,"Team C 1+ Goal","team-goal")];
 const d={eligibleSlipLegs:pool,props:[]},result=rebuild(d,NOW,new Map());
 assert.equal(result.sgp.status,"qualified");assert.equal(result.acca.status,"qualified");
 assert.equal(d.eligibleSlipLegs.length,6);
});
