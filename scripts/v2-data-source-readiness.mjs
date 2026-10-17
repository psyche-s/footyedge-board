#!/usr/bin/env node
// FootyEdge V2 bridge: verify CC0 Hub mirror and flag stale/missing results.
// Read-only, zero network calls. Does NOT import football-data.org match rows,
// odds, player events or keys and does not modify production/frozen boards.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

export const FIELDS_FROM_CC0=Object.freeze([
 "historical_completed_scores","historical_h2h_results",
 "historical_goals_totals","historical_btts_labels",
 "historical_last5_last10_goal_based_form"
]);
export const MISSING_FIELDS=Object.freeze([
 "verified_current_standings","2026_27_verified_player_shots",
 "2026_27_verified_player_sot","player_fouls_committed",
 "player_fouls_won","player_assists","player_minutes",
 "player_lineups","player_cards","team_xg","team_ppda",
 "injury_reports","verified_sportsbook_odds","bookmaker_sgp_prices"
]);

function validDay(s) {
 return typeof s==="string" && /^\d{4}-\d{2}-\d{2}$/.test(s) &&
        Number.isFinite(Date.parse(s+"T00:00:00Z")) &&
        new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
}
function daysBetween(from,to) {
 return Math.round((Date.parse(to+"T00:00:00Z")-Date.parse(from+"T00:00:00Z"))/86400000);
}
function seasonFor(asOf) {
 const y=Number(asOf.slice(0,4)),m=Number(asOf.slice(5,7));
 const start=m>=7?y:y-1;
 return start+"-"+String(start+1).slice(-2);
}
function checkRows(doc,league,asOf,currentSeason) {
 if(!doc||doc.schema!=="footyedge-history-v1"||
    doc.license!=="CC0-1.0"||
    doc.originalSource!=="OpenFootball/football.json"||
    doc.competition!==league||
    !Array.isArray(doc.games))return {status:"invalid_or_unlicensed_archive"};
 let lastCurrent=null, observedCurrent=0, total=0, invalid=0;
 for(const g of doc.games) {
  if(!g||typeof g.id!=="string"||!validDay(g.d)||g.d>=asOf||
     !Number.isInteger(g.hs)||!Number.isInteger(g.as)||
     g.hs<0||g.as<0||g.hs>20||g.as>20 ||
     typeof g.h!=="string"||typeof g.a!=="string"||
     g.h.trim()===""||g.a.trim()==="") {
      invalid++;
      continue;
  }
  total++;
  if(g.s===currentSeason){
    observedCurrent++;
    if(!lastCurrent||g.d>lastCurrent)lastCurrent=g.d;
  }
 }
 if(invalid) return {status:"archive_contains_invalid_or_future_rows",invalidRows:invalid};
 const age=lastCurrent?daysBetween(lastCurrent,asOf):null;
 return {status:observedCurrent===0?"no_current_season_finals":
                age>14?"stale_current_season_results":"score_history_present_not_live_verified",
         completedHistoricalRecords:total,completedCurrentSeasonRecords:observedCurrent,
         lastCurrentFinalDate:lastCurrent,daysSinceLatestCurrentFinal:age,
         ageThresholdExceeded:age!==null && age>14};
}

export function assess(config,docs,asOf){
 if(!validDay(asOf))throw Error("invalid_as_of_date");
 if(!config||config.schema!=="footyedge-free-data-bridge-config-v2"||
    config.policy!=="free_only"||config.costLimitPerMonthEUR!==0||
    config.immutableFrozenBoards!==true||config.publicSitePublishDisabled!==true||
    config.providerRowsAllowedInPublicMirror!==false ||
    config.metadataCheck?.legalStorageAndModelUseApproved!==false ||
    config.playerEventSourceApproved!==false||
    config.verifiedBookmakerOddsSourceApproved!==false)throw Error("bridge_policy_not_approved");
 const currentSeason=seasonFor(asOf);
 if(!Array.isArray(config.targetLeagues)||config.targetLeagues.length!==11)
    throw Error("unexpected_mens_competitions");
 const leagues=config.targetLeagues.map(c=>{
   const doc=docs[c.league]??null;
   const coverage=doc?checkRows(doc,c.league,asOf,currentSeason):
                       {status:"missing_cc0_league_archive"};
   return {league:c.league,name:c.name,season:currentSeason,
       approvedSource:"OpenFootball CC0 historical scores",
       sourceCoverage:coverage,
       fdorg:{competition:c.fdorgCandidate,
         freeMetadataListed:!!c.fdorgCandidate && config.metadataCheck?.returnedAllEight===true,
         metadataCheckOnly:true,matchEndpointVerified:false,
         rowsPermittedForPublicUse:false,storagePermissionConfirmed:false},
       playerStatsAvailable:false,standingsCurrentVerified:false,
       modelScoreFreshnessCandidate:coverage.status==="score_history_present_not_live_verified",
       matchResearchReady:false};
 });
 return {schema:"footyedge-v2-data-readiness-v1",
   asOfDate:asOf,season:currentSeason,
   sourceOfTruth:"existing CC0 Hub mirror only",noNetworkCalls:true,
   providerApiRequests:0,noProviderRowsAdded:true,
   changesPublished:false,frozenBoardsUnchanged:true,
   verifiedMetadataLeagues:leagues.filter(l=>l.fdorg.freeMetadataListed).length,
   currentSeasonArchives:leagues.filter(l=>l.sourceCoverage.completedCurrentSeasonRecords>0).length,
   staleOrMissingLeagues:leagues.filter(l=>!l.modelScoreFreshnessCandidate).length,
   publicStatsReady:false,modelConfidenceCalibrated:false,bookmakerOddsVerified:false,
   allowedHistoricalFields:[...FIELDS_FROM_CC0],missingFields:[...MISSING_FIELDS],
   leagues};
}
export function fromDirectory(config,folder,asOf){
 const docs={};
 for(const {league} of config.targetLeagues){
   if(!/^[a-z]{2,4}\.\d$/.test(league))throw Error("unsafe_league_id");
   const file=path.resolve(folder,league+".json");
   if(!file.startsWith(path.resolve(folder)+path.sep))throw Error("unsafe_data_path");
   if(!fs.existsSync(file))continue;
   docs[league]=JSON.parse(fs.readFileSync(file,"utf8"));
 }
 return assess(config,docs,asOf);
}
function torontoDay(){
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",
    year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const map=Object.fromEntries(parts.map(v=>[v.type,v.value]));
 return map.year+"-"+map.month+"-"+map.day;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
 const cfg=JSON.parse(fs.readFileSync(path.join(root,"config/v2-free-data-bridge.json"),"utf8"));
 const asOf=process.argv[2]||torontoDay();
 const result=fromDirectory(cfg,path.join(root,"data/football-hub"),asOf);
 console.log(JSON.stringify(result,null,2));
}
