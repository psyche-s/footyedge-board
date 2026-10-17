import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {assess,fromDirectory} from "../scripts/v2-data-source-readiness.mjs";
const CONFIG=JSON.parse(fs.readFileSync("config/v2-free-data-bridge.json","utf8"));
function fixture(league="eng.1",last="2026-10-15",season="2026-27") {
 return {schema:"footyedge-history-v1",competition:league,
         license:"CC0-1.0",originalSource:"OpenFootball/football.json",
         games:[{id:"of:01",d:last,h:"Arsenal FC",a:"Chelsea FC",hi:"a",ai:"b",
                 hs:0,as:0,s:season}]};
}
test("eight metadata-only competitions, eleven men leagues and zero live rights",()=>{
 const result=assess(CONFIG,{},"2026-10-17");
 assert.equal(result.leagues.length,11);
 assert.equal(result.verifiedMetadataLeagues,8);
 assert.equal(result.currentSeasonArchives,0);
 assert.equal(result.staleOrMissingLeagues,11);
 assert.equal(result.noNetworkCalls,true);
 assert.equal(result.noProviderRowsAdded,true);
 assert.equal(result.changesPublished,false);
 assert.equal(result.bookmakerOddsVerified,false);
 assert.equal(result.publicStatsReady,false);
 assert.ok(result.missingFields.includes("player_fouls_won"));
 assert.ok(result.missingFields.includes("verified_sportsbook_odds"));
});
test("valid 2026-27 CC0 score history is descriptive, not real-time verification",()=>{
 const r=assess(CONFIG,{"eng.1":fixture()},"2026-10-17");
 const eng=r.leagues.find(x=>x.league==="eng.1");
 assert.equal(eng.sourceCoverage.status,"score_history_present_not_live_verified");
 assert.equal(eng.sourceCoverage.completedCurrentSeasonRecords,1);
 assert.equal(eng.sourceCoverage.lastCurrentFinalDate,"2026-10-15");
 assert.equal(eng.sourceCoverage.daysSinceLatestCurrentFinal,2);
 assert.equal(eng.modelScoreFreshnessCandidate,true);
 assert.equal(eng.matchResearchReady,false);
 assert.equal(eng.playerStatsAvailable,false);
});
test("September 20 latest final cannot pass October 17 source freshness",()=>{
 const result=assess(CONFIG,{"eng.1":fixture("eng.1","2026-09-20")},"2026-10-17");
 const eng=result.leagues.find(x=>x.league==="eng.1");
 assert.equal(eng.sourceCoverage.status,"stale_current_season_results");
 assert.equal(eng.sourceCoverage.daysSinceLatestCurrentFinal,27);
 assert.equal(eng.modelScoreFreshnessCandidate,false);
});
test("unknown, unlicensed, tampered or future fixture histories fail closed",()=>{
 for(const doc of [
   {...fixture(),license:"proprietary"},
   {...fixture(),originalSource:"football-data.org"},
   {...fixture(),games:[{...fixture().games[0],d:"2026-10-17"}]},
   {...fixture(),games:[{...fixture().games[0],hs:null}]}
 ]) {
   const r=assess(CONFIG,{"eng.1":doc},"2026-10-17");
   assert.equal(r.leagues[0].modelScoreFreshnessCandidate,false);
   assert.equal(r.leagues[0].matchResearchReady,false);
 }
});
test("v2 integration never reads provider rows without approval or alters state",()=>{
 const modified={...CONFIG,providerRowsAllowedInPublicMirror:true};
 assert.throws(()=>assess(modified,{},"2026-10-17"),/bridge_policy_not_approved/);
 const unlocked={...CONFIG,metadataCheck:{...CONFIG.metadataCheck,legalStorageAndModelUseApproved:true}};
 assert.throws(()=>assess(unlocked,{},"2026-10-17"),/bridge_policy_not_approved/);
 assert.throws(()=>assess(CONFIG,{},"2026-02-30"),/invalid_as_of_date/);
});
test("existing mirrored Hub files are readable and current-season staleness is reported",()=>{
 const out=fromDirectory(CONFIG,"data/football-hub","2026-10-17");
 const eng=out.leagues.find(x=>x.league==="eng.1");
 assert.equal(eng.sourceCoverage.status,"stale_current_season_results");
 assert.equal(eng.sourceCoverage.lastCurrentFinalDate,"2026-09-20");
 assert.equal(out.publicStatsReady,false);
 assert.equal(out.frozenBoardsUnchanged,true);
});
