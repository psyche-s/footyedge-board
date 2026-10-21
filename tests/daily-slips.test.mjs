import test from "node:test";import assert from "node:assert/strict";
import{market,compatible,sgp,acca,build}from"../scripts/build-daily-slips.mjs";
const mk=(id,family,rating,label)=>({gameId:id,league:"eng.1",family,rating,label:label||family,risk:[]});
test("classify goal markets and results",()=>{assert.equal(market({label:"Over 1.5 Goals"}).family,"total");assert.equal(market({label:"Team A ML"}).family,"winner");assert.equal(market({label:"Team A or Draw"}).family,"double-chance");});
test("Do not stack two goal-total lines or redundant winner/double chance",()=>{
 assert.equal(compatible(mk("1","total",85,"Over 1.5 Goals"),mk("1","total",84,"Under 4.5 Goals")),false);
 assert.equal(compatible(mk("1","winner",85,"Team A ML"),mk("1","double-chance",82,"Team A or Draw")),false);
 assert.equal(compatible(mk("1","total",94,"Over 1.5 Goals"),mk("1","team-goal",90,"Team A 1+ Goal")),false);
 assert.equal(compatible(mk("1","team-goal",90,"Team A 1+ Goal"),mk("1","team-goal",83,"Team B 1+ Goal")),false);
});
test("SGP requires at least three supported compatible markets in one fixture, else pass",()=>{
 const x=[mk("1","total",90,"Under 4.5 Goals"),mk("1","double-chance",86,"Team A or Draw"),
   mk("1","btts",82,"BTTS Yes"),mk("2","winner",96,"Team C ML")];
 assert.equal(sgp(x).status,"qualified");
 assert.ok(sgp(x).legs.length>=3&&sgp(x).legs.length<=5);
 assert.ok(sgp(x).legs.every(v=>v.gameId==="1"));
 assert.equal(sgp(x.slice(0,2)).status,"pass");
 assert.equal(sgp(x.slice(-1)).status,"pass");
});
test("ACCA restricts to one leg per fixture and caps families",()=>{
 const x=Array.from({length:7},(_,i)=>mk(String(i),i%2?"team-goal":"total",94-i,"selection "+i));
 const d=acca(x);assert.equal(d.status,"qualified");assert.ok(d.legs.length>=4&&d.legs.length<=6);
 assert.equal(new Set(d.legs.map(x=>x.gameId)).size,d.legs.length);assert.equal(acca(x.slice(0,2)).status,"pass");
});
test("No fixtures imply no fabricated slips",()=>{
 const a=build({date:"2026-10-21",board:{date:"2026-10-21",games:[]},research:{date:"2026-10-21",fixtures:[]}});
 assert.equal(a.sgp.status,"pass");assert.equal(a.acca.status,"pass");assert.equal(a.props.length,0);
 assert.equal(a.noSportsbookOdds,true);
});
