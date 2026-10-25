import test from "node:test";
import assert from "node:assert/strict";
import {importAuditedPredictions} from "../scripts/import-audited-predicted-xi.mjs";
const date="2026-10-25",now=Date.parse("2026-10-25T06:10:00Z");
const homeXI=Array.from({length:11},(_,i)=>"Home Player "+i);
const awayXI=Array.from({length:11},(_,i)=>"Away Player "+i);
const base={date,fixtures:[{id:"123456",home:{name:"Test FC"},away:{name:"Away United"}}]};
const audit={date,checkedAt:"2026-10-25T05:00:00Z",fixtures:[{
 fixtureId:"123456",home:"Test FC",away:"Away United",
 teamNews:{status:"unconfirmed_predicted_XI_from_dated_editorial_preview",
  sourceUrl:"https://www.sportsmole.co.uk/football/test/preview/example_12345.html",
  sourcePublishedOn:"2026-10-24",predictedXI:{home:homeXI,away:awayXI},
  injuryAndSuspensionContext:{home:["Unavailable Person"]},
  doubtful:{away:["Fitness Doubt"]}}
}]};
test("Imports only fully dated editorial predicted XIs and preserves unconfirmed status",()=>{
 const r=importAuditedPredictions({date,audit,base,now});
 assert.deepEqual(r.added,["123456"]);
 assert.equal(r.document.fixtures.length,1);
 assert.equal(r.document.fixtures[0].home.predictedXI.length,11);
 assert.equal(r.document.fixtures[0].away.predictedXI.length,11);
 assert.equal(r.document.fixtures[0].home.lineupStatus,"predicted-not-confirmed");
 assert.equal(r.document.fixtures[0].away.lineupStatus,"predicted-not-confirmed");
 assert.equal(r.document.fixtures[0].source.sourcePublishedOn,"2026-10-24");
 assert.deepEqual(r.document.fixtures[0].home.out,["Unavailable Person"]);
 assert.equal(r.document.noLineupClaimsOfConfirmation,true);
});
test("Never rewrites existing complete feed-provided predictions",()=>{
 const existing={schema:"footyedge-sourced-team-intelligence-v1",date,
  fixtures:[{fixtureId:"123456",home:{predictedXI:Array(11).fill("Keeper")},away:{predictedXI:Array(11).fill("Striker")},source:{url:"https://example.test/"}}]};
 // Valid distinct player names are required; use an actual complete pair.
 existing.fixtures[0].home.predictedXI=homeXI.map(x=>x+" licensed");
 existing.fixtures[0].away.predictedXI=awayXI.map(x=>x+" licensed");
 const r=importAuditedPredictions({date,audit,base,existing,now});
 assert.deepEqual(r.added,[]);
 assert.equal(r.document.fixtures[0].home.predictedXI[0],homeXI[0]+" licensed");
});
test("Rejects mismatched fixture, incomplete XIs, untrusted URL and stale reviews",()=>{
 const bad1=structuredClone(audit);bad1.fixtures[0].away="Wrong Club";
 assert.equal(importAuditedPredictions({date,audit:bad1,base,now}).added.length,0);
 const bad2=structuredClone(audit);bad2.fixtures[0].teamNews.predictedXI.home.pop();
 assert.equal(importAuditedPredictions({date,audit:bad2,base,now}).added.length,0);
 const bad3=structuredClone(audit);bad3.fixtures[0].teamNews.sourceUrl="http://bad.example.com";
 assert.equal(importAuditedPredictions({date,audit:bad3,base,now}).added.length,0);
 const old=structuredClone(audit);old.checkedAt="2026-10-22T01:00:00Z";
 assert.deepEqual(importAuditedPredictions({date,audit:old,base,now}).rejected,["stale-audit"]);
});
test("Rejects previews dated after kickoff day without inventing names",()=>{
 const bad=structuredClone(audit);bad.fixtures[0].teamNews.sourcePublishedOn="2026-10-26";
 assert.equal(importAuditedPredictions({date,audit:bad,base,now}).added.length,0);
});
