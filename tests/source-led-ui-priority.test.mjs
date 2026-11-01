import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const ui=fs.readFileSync("ui/part2.html","utf8");
const start=ui.indexOf("function feOwnerBoardPublished(){");
const end=ui.indexOf("function viewPick(g){",start);
assert.ok(start>=0&&end>start,"Original match-pick display functions must exist");
const snippet=ui.slice(start,end);

test("dated independent publisher picks display before immutable model fallback without changing archive",()=>{
 const date="2026-11-01";
 const archive={date,immutable:true,state:"locked"};
 const S={date,archive,sourceLed:{date},filter:"all"};
 const context={S,ARCHIVE_CAPTURE:false,normName:x=>String(x||"").toLowerCase().trim(),
  etDate:()=>date};
 const view=vm.runInNewContext(snippet+";viewCandidates",context);
 const fallback={label:"Over 1.5 Goals",category:"Goals",sourceBackedReason:true,
  reason:"Verified historical evidence supports at least two goals in this fixture.",
  confidenceRating:78,homeSample:10,awaySample:10};
 const sourced={label:"Under 2.5 Goals",category:"Goals",family:"total",
  sourceBackedReason:true,marketEvidence:{explicitEditorialTip:true},
  sourceProvenance:[{source:"football_whispers",url:"https://footballwhispers.com/blog/example"}],
  confidenceRating:57,reason:"Two independent publisher previews support a lower total."};
 const game={id:"123",model:{top3:[fallback]},feEditorialPicks:[sourced]};
 assert.equal(view(game)[0].label,"Under 2.5 Goals");
 assert.equal(view({...game,feEditorialPicks:null})[0].label,"Over 1.5 Goals");
 assert.equal(archive.state,"locked");
 assert.equal(archive.immutable,true);
});

test("Original modal explicitly distinguishes partial and pass coverage",()=>{
 assert.match(ui,/TOP '\+Math\.min\(3,top3\.length\)\+' PICKS'\+pickCoverage/);
 assert.match(ui,/PASS — 0 qualified picks/);
 assert.match(ui,/top3\.length===3\?"":top3\.length\?" · PARTIAL":" · PASS"/);
});
