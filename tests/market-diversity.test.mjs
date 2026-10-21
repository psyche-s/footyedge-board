import test from "node:test";
import assert from "node:assert/strict";
import{marketConcept,independentSelection,takeDistinctTopPicks}from"../scripts/market-diversity.mjs";
const p=(label,category)=>({label,category});
test("Goal total and team goal 1+ never consume two Top 3 positions",()=>{
 assert.equal(independentSelection(p("Over 1.5 Goals","Goals"),p("Arsenal 1+ Goal","Team Goals")),false);
 assert.equal(independentSelection(p("Under 4.5 Goals","Goals"),p("Over 1.5 Goals","Goals")),false);
 assert.equal(independentSelection(p("BTTS — Yes","BTTS"),p("Arsenal 1+ Goal","Team Goals")),false);
 assert.equal(independentSelection(p("Arsenal 1+ Goal","Team Goals"),p("Spurs 1+ Goal","Team Goals")),false);
 assert.equal(independentSelection(p("Over 1.5 Goals","Goals"),p("Spurs 1+ Goal","Team Goals")),false);
});
test("ML and double chance do not create duplicate result theses",()=>{
 assert.equal(independentSelection(p("Arsenal ML","Match Result"),p("Arsenal or Draw","Double Chance")),false);
 assert.equal(independentSelection(p("Arsenal ML","Match Result"),p("Arsenal 1+ Goal","Team Goals")),false);
});
test("Retain distinct score and result markets and PASS if only redundant candidates exist",()=>{
 const choices=[p("Over 1.5 Goals","Goals"),p("Arsenal 1+ Goal","Team Goals"),p("Arsenal or Draw","Double Chance"),p("BTTS — Yes","BTTS"),p("Arsenal ML","Match Result")];
 const result=takeDistinctTopPicks(choices);
 assert.deepEqual(result.map(x=>x.label),["Over 1.5 Goals","Arsenal or Draw"]);
 assert.equal(takeDistinctTopPicks(choices.slice(0,2)).length,1);
});
