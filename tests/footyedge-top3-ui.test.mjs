import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const code=fs.readFileSync("ui/part2.html","utf8");
const body=code.slice(code.indexOf("function feThesisKind(p){"),code.indexOf("function viewCandidates(g){"));
const {pick}=vm.runInNewContext(body+"\n({pick:feDistinctView})",{});
test("Read-only match detail preview does not repeat goal totals, team goals, and BTTS",()=>{
 const source=[
  {label:"Over 1.5 Goals",category:"Goals",confidenceRating:91},
  {label:"Team A 1+ Goal",category:"Team Goals",confidenceRating:89},
  {label:"Team B 1+ Goal",category:"Team Goals",confidenceRating:85},
  {label:"BTTS — Yes",category:"BTTS",confidenceRating:83},
  {label:"Team A or Draw",category:"Double Chance",confidenceRating:79}
 ];
 assert.deepEqual(Array.from(pick(source),x=>x.label),["Over 1.5 Goals","Team A or Draw"]);
 assert.equal(source.length,5,"must not mutate frozen pick arrays");
});
test("Goal-suppression catches labels even if the category was missing",()=>{
 const row=[
  {label:"Under 4.5 Goals"},{label:"Over 1.5 Goals"},{label:"Lille 1+ Goal"},
  {label:"Lille ML",category:"Match Result"}];
 assert.deepEqual(Array.from(pick(row),x=>x.label),["Under 4.5 Goals","Lille ML"]);
});
test("Only dated, attributable external research enriches writing",()=>{
 const external=JSON.parse(fs.readFileSync("data/editorial-previews/2026-10-21.json","utf8"));
 assert.equal(external.schema,"footyedge-editorial-crosscheck-v1");
 assert.equal(external.date,"2026-10-21");
 for(const match of external.matches){
  assert.ok(match.fixtureId&&match.home&&match.away&&match.sources?.length);
  for(const source of match.sources){
   assert.match(source.url,/^https:\/\//);
   assert.match(source.publishedOn,/^2026-10-(19|20|21)$/);
  }
 }
 assert.match(code,/feReviewedReason\(g,x\)/);
 assert.match(code,/function fePreviewLinks\(g,p\)/);
});
test("Predicted formation is never misrepresented as confirmed",()=>{
 const data=JSON.parse(fs.readFileSync("data/team-intelligence/2026-10-21.json","utf8"));
 for(const match of data.fixtures.filter(x=>x.league==="uefa.champions")){
  for(const side of [match.home,match.away]){
   if(!side.predictedFormation)continue;
   assert.match(side.predictedFormation,/^[1-5](?:-[1-5]){2,4}$/);
   assert.match(side.predictedFormationSource,/^https:\/\/www\.uefa\.com\//);
   assert.match(side.formationStatus,/not-confirmed/);
   assert.equal(side.predictedXI.length,11);
  }
 }
});
