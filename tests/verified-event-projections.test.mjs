import test from "node:test";import assert from "node:assert/strict";
import {verifyHistoryEvent,summarizeEvents,makeDatedStyle} from "../scripts/build-verified-event-projections.mjs";
const final=(id="123",when="2026-10-20T15:00:00Z",completed=true)=>({
 header:{competitions:[{id,date:when,status:{type:{completed}},competitors:[{team:{id:"77"},score:"2"},{team:{id:"88"},score:"1"}]}]},
 boxscore:{teams:[{team:{id:"77"},statistics:[{name:"totalShots",displayValue:"18"},{name:"shotsOnTarget",displayValue:"7"},
 {name:"fouls",displayValue:"12"},{name:"wonCorners",displayValue:"6"},{name:"yellowCards",displayValue:"2"}]},
 {team:{id:"88"},statistics:[{name:"totalShots",displayValue:"11"},{name:"shotsOnTarget",displayValue:"3"}]}]}});
const old={id:"123",date:"2026-10-20T15:00:00Z",gf:2,ga:1,oppId:"88"},cutoff=Date.parse("2026-11-05T17:45:00Z");
test("exact event/team/score join, opponent shots allowed, no guessed missing stats",()=>{
 const x=verifyHistoryEvent(final(),old,cutoff,"77");assert.equal(x.shots,18);assert.equal(x.shotsAllowed,11);
 assert.equal(x.shotsOnTargetAllowed,3);assert.equal(x.corners,6);assert.equal(x.fouls,12);
 assert.equal(x.tackles,undefined);
});
test("future, uncompleted, mismatched or other-team games cannot contaminate stats",()=>{
 assert.equal(verifyHistoryEvent(final("124"),old,cutoff,"77"),null);
 assert.equal(verifyHistoryEvent(final("123","2026-11-06T00:00:00Z"),old,cutoff,"77"),null);
 assert.equal(verifyHistoryEvent(final("123",old.date,false),old,cutoff,"77"),null);
 assert.equal(verifyHistoryEvent(final(),{...old,gf:3},cutoff,"77"),null);
 assert.equal(verifyHistoryEvent(final(),old,cutoff,"100"),null);
});
test("5 prior match records and per-market samples required",()=>{
 const events=Array.from({length:5},(_,i)=>({...verifyHistoryEvent(final(),old,cutoff,"77"),
  id:String(i+200),date:"2026-10-"+String(i+10).padStart(2,"0")+"T15:00:00Z"}));
 const a=summarizeEvents(events,cutoff);
 assert.equal(a.shotsAvg,18);assert.equal(a.shotsAllowedAvg,11);assert.equal(a.tacklesAvg,undefined);
 assert.equal(summarizeEvents(events.slice(0,4),cutoff),null);
});
test("missing second-team sample is a hard no-match",()=>{
 const f={id:"555",league:"uefa.europa",date:"2026-11-05T17:45:00Z",home:{id:"77",name:"X"},away:{id:"88",name:"Y"},
 last10:{home:[old],away:[]}};
 const z=makeDatedStyle({date:"2026-11-05",fixtures:[f]},new Map([["123",final()]]),new Date().toISOString());
 assert.equal(z.coverage.matched,0);
});
