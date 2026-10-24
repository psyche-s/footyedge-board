import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const ui=fs.readFileSync("ui/part2.html","utf8");
const css=fs.readFileSync("assets/footyedge-match-v3.css","utf8");
const extract=(begin,end)=>{const i=ui.indexOf(begin),j=ui.indexOf(end,i+1);assert.ok(i>=0&&j>i,"Function segment exists");return ui.slice(i,j)};
const fePitchFive=new Function(extract("function fePitchFive(","function fePitchValue(")+";return fePitchFive;")();
const fePitchValue=new Function(extract("function fePitchValue(","function fePitchCells(")+";return fePitchValue;")();
test("lineup pitch selects all supported stats and preserves player profile click",()=>{
 for(const key of ["goals","assists","shots","shotsOnTarget","foulsCommitted","foulsWon","yellowCards","redCards","minutes"])
   assert.match(ui,new RegExp('"'+key+'"'));
 assert.match(ui,/data-fe-pitch-metric/);
 assert.match(ui,/data-fe-pitch-strip/);
 assert.match(ui,/data-fe-player-name/);
 assert.match(ui,/feOpenPlayerProfile\(g,action\)/);
 assert.match(css,/\.fe-pitchStatStrip/);
 assert.match(css,/\.fe-pitchStatCell/);
 assert.match(ui,/feTeamPitchRows\(intel\.away/);
 assert.match(ui,/feTeamPitchRows\(intel\.home/);
});
test("only five pre-kickoff verified appearances are selected, newest first",()=>{
 const rows=Array.from({length:8},(_,n)=>({
  date:"2026-10-"+String(10+n).padStart(2,"0"),opponent:"Team "+n,goals:n
 }));
 rows.push({date:"2026-10-19",opponent:"Future opponent",goals:99});
 rows.push({date:"2026-10-17",opponent:"Team 7",goals:88});
 const selected=fePitchFive(rows,"2026-10-18T14:00:00Z");
 assert.equal(selected.length,5);
 assert.deepEqual(selected.map(x=>x.date),["2026-10-17","2026-10-16","2026-10-15","2026-10-14","2026-10-13"]);
});
test("zero is a recorded value, missing statistics stay unavailable",()=>{
 assert.equal(fePitchValue(0),"0");
 assert.equal(fePitchValue(3),"3");
 for(const n of [null,undefined,"",NaN,-1])assert.equal(fePitchValue(n),"—");
});
test("bounded concurrency prevents 22 simultaneous provider requests",()=>{
 assert.match(ui,/fePitchHistoryActive<3/);
 assert.match(ui,/fePitchHistoryCache=new Map/);
 assert.match(ui,/AbortController/);
 assert.match(ui,/fePrimePitchHistory\(g\)/);
});
