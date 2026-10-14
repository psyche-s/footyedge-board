import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {verifyRegistry,health} from "../scripts/audit-data-sources.mjs";
import {historicYears,plannedPublicYears} from "../scripts/sync-football-data-hub.mjs";
const registry=JSON.parse(readFileSync("config/source-registry.json","utf8"));
test("registry contains established FootyEdge providers without unlicensed exports",()=>{
 assert.equal(verifyRegistry(registry),true);
 for(const key of ["espn","api_football","the_odds_api","football_whispers","statsbomb_open","understat","football_data_co_uk"]){
  assert.ok(registry.existing_application_sources.some(x=>x.id===key),key);
 }
 assert.equal(registry.historical_sources.find(x=>x.id==="football_logos").can_publish_completed_scores,false);
});
test("source audit is metadata only, not a provider availability or odds feed",()=>{
 const d=health(registry,{schema:"footyedge-history-manifest-v1",license:"CC0-1.0",totalCompleted:123,throughDateExclusive:"2026-10-14",leagues:[]},new Date("2026-10-14T12:00:00Z"));
 assert.equal(d.history.completedMatches,123);
 assert.equal(d.sources.find(x=>x.id==="the_odds_api").mode,"existing_optional_keyed_adapter");
 assert.equal(JSON.stringify(d).includes("apiKey"),false);
 assert.throws(()=>health(registry,{schema:"wrong",license:"CC0-1.0"}));
});
test("historical bootstrap includes 2015 through 2026 and incremental backs one missing year",()=>{
 const y=historicYears("2026-10-14",2015);
 assert.equal(y.length,12);
 assert.equal(y[0],"2015-16");assert.equal(y[y.length-1],"2026-27");
 const daily=plannedPublicYears("2026-10-14",{attemptedHistoricSeasons:["2015-16"]},"daily");
 assert.deepEqual(daily,["2016-17","2025-26","2026-27"]);
 const full=plannedPublicYears("2026-10-14",{},"full");
 assert.equal(full.length,12);
 assert.throws(()=>plannedPublicYears("2026-10-14",{},"invalid"));
});
test("source registry cannot grant other provider CC0 rights",()=>{
 const copy=JSON.parse(JSON.stringify(registry));
 copy.existing_application_sources.find(x=>x.id==="the_odds_api").can_publish_completed_scores=true;
 assert.throws(()=>verifyRegistry(copy));
});
