#!/usr/bin/env node
/**
 * Owner-authorized same-day correction for FootyEdge ORIGINAL ONLY.
 * Overwrites the incomplete Oct 28 board from rebuilt dated research, while
 * preserving an auditable before-copy. Missing evidence remains unavailable,
 * never an invented lineup, probability, or bookmaker quote.
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {validateBoard} from "./validate-published-boards.mjs";
import {canonicalFixtureKey} from "./owner-fixture-identity.mjs";
const date=process.env.OWNER_OVERRIDE_DATE;
const today=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
const localDate=today.year+"-"+today.month+"-"+today.day;
if(date!=="2026-10-28"||date!==localDate)throw Error("Explicit owner-authorized same-day Oct 28 correction only");
const load=async p=>{try{return JSON.parse(await fs.readFile(p,"utf8"))}catch(e){if(e.code==="ENOENT")return null;throw e}};
const digest=s=>crypto.createHash("sha256").update(s).digest("hex");
const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const root="data/boards/"+date+".json";
const [old,draft,research,h2h,intel,simulation,provenance]=await Promise.all([
  load(root),load("data/board-drafts/"+date+".json"),load("data/research-base-"+date+".json"),
  load("data/h2h/"+date+".json"),load("data/team-intelligence/"+date+".json"),
  load("data/experimental-simulations/"+date+".json"),load("data/source-provenance/"+date+".json")
]);
if(!draft||!research||draft.date!==date||research.date!==date||!Array.isArray(draft.games))throw Error("Missing exact-day rebuilt draft and research");
if(!old||old.date!==date||!Array.isArray(old.games))throw Error("Expected existing current-day original board");
// Removing verified duplicate fixture aliases is an approved correction, but
// losing any UNIQUE previously published matchup is not.
if(draft.games.length<old.games.length){
 const unique=new Set(draft.games.map(g=>canonicalFixtureKey(g)));
 const missing=[...new Set(old.games.map(g=>canonicalFixtureKey(g)))].filter(k=>!unique.has(k));
 if(missing.length)throw Error("Recovery would drop verified matchups: "+missing.join(", "));
 console.log("Corrected duplicate fixture aliases:",old.games.length-draft.games.length);
}
const byId=rows=>new Map((rows||[]).map(x=>[String(x.fixtureId||x.id),x]));
const researchById=byId(research.fixtures),h2hById=byId(h2h?.fixtures),xiById=byId(intel?.fixtures),simById=byId(simulation?.fixtures);
const byName=new Map((provenance?.fixtures||[]).map(x=>[x.league+"|"+norm(x.home)+"|"+norm(x.away),x]));
let lastFiveCount=0,h2hCount=0,xiCount=0,projectionCount=0,picksCount=0,newsCount=0;
const enriched=draft.games.map(g=>{
  const r=researchById.get(String(g.id));
  if(!r)throw Error("Research join missing for "+g.id);
  const recentHome=(r.last5?.home||r.last10?.home?.slice(0,5)||[]).filter(x=>Number.isFinite(Number(x.gf))&&Number.isFinite(Number(x.ga)));
  const recentAway=(r.last5?.away||r.last10?.away?.slice(0,5)||[]).filter(x=>Number.isFinite(Number(x.gf))&&Number.isFinite(Number(x.ga)));
  if(recentHome.length===5&&recentAway.length===5)lastFiveCount++;
  const hh=h2hById.get(String(g.id));
  const verifiedMeetings=(hh?.h2h||[]).filter(x=>Number.isInteger(Number(x.homeScore))&&Number.isInteger(Number(x.awayScore))&&Date.parse(x.date)<Date.parse(g.date)).slice(0,5);
  if(verifiedMeetings.length)h2hCount++;
  const x=xiById.get(String(g.id));
  if(x?.home?.predictedXI?.length===11&&x?.away?.predictedXI?.length===11)xiCount++;
  const candidateProjection=simById.get(String(g.id));
  // Publish quantitative forecasts only where five verified prior games exist on EACH side.
  // The simulator may still archive a low-evidence exploratory placeholder internally.
  const pr=Number(candidateProjection?.dataQuality?.homeHistoryGames)>=5&&Number(candidateProjection?.dataQuality?.awayHistoryGames)>=5?candidateProjection:null;
  if(Number.isFinite(pr?.expectedGoals?.home)&&Number.isFinite(pr?.expectedGoals?.away))projectionCount++;
  const sourced=byName.get(g.league+"|"+norm(g.home)+"|"+norm(g.away));
  const note=sourced?.teamNews;
  const reports=[];
  if(note?.formContext)reports.push({status:"reviewed",fixtureDate:date,text:note.formContext,kind:"form-context"});
  if(note?.reportedAbsences?.home?.length)reports.push({status:"reviewed",fixtureDate:date,text:g.home+": reported absences: "+note.reportedAbsences.home.join(", "),kind:"absences"});
  if(note?.reportedAbsences?.away?.length)reports.push({status:"reviewed",fixtureDate:date,text:g.away+": reported absences: "+note.reportedAbsences.away.join(", "),kind:"absences"});
  if(reports.length)newsCount++;
  if(g.top3?.length) picksCount++;
  return {...g,
    baseResearch:r,
    last5:{home:recentHome,away:recentAway},
    last10:r.last10||{home:[],away:[]},
    form:{home:recentHome.map(z=>z.result).join(" "),away:recentAway.map(z=>z.result).join(" ")},
    h2h:verifiedMeetings,
    matchH2H:verifiedMeetings,
    h2hSummary:{matches:verifiedMeetings.length,verified:!!hh,status:hh?.status||"source-unavailable",note:hh?.status==="history-source-unavailable"?"Historical results source unavailable":verifiedMeetings.length?"Verified previous meetings":"No previous meetings returned by historical source"},
    teamIntel:x||null,
    teamNews:reports,
    frozenTeamNews:reports,
    model:{...g.model,expectedGoals:Number.isFinite(pr?.expectedGoals?.home)&&Number.isFinite(pr?.expectedGoals?.away)?
      {home:pr.expectedGoals.home,away:pr.expectedGoals.away,total:Number((pr.expectedGoals.home+pr.expectedGoals.away).toFixed(3)),source:"experimental-uncalibrated"}:
      (g.model?.expectedGoals||{home:null,away:null,total:null}),
      scoreProjection:pr?.predictedScore||null,winDrawLossPct:pr?.winDrawLossPct||null},
    projections:pr?{status:"experimental-not-calibrated",predictedScore:pr.predictedScore,
      expectedGoals:pr.expectedGoals,winDrawLossPct:pr.winDrawLossPct,simulations:pr.simulations,
      quality:pr.dataQuality,warning:pr.warning}:null,
    recoveryStatus:g.recoveryStatus==="multi-publisher-source-reviewed-top3"?g.recoveryStatus:(g.top3?.length===3?"researched-top3":"limited-evidence-do-not-force-picks"),
    dataCompleteness:{lastFiveHome:recentHome.length,lastFiveAway:recentAway.length,
      previousMeetings:verifiedMeetings.length,historyVerified:!!hh,
      lineupStatus:x?"editorial-predicted-not-confirmed":"not-independently-verified",
      newsVerified:!!reports.length,projectionsModelled:!!pr,
      qualifiedPicks:g.top3?.length||0}
  };
});
const board={...draft,immutable:false,state:"published",frozenAt:null,
  lastPublishedAt:new Date().toISOString(),ownerOverride:true,
  correctionOf:old.lastPublishedAt||old.frozenAt||null,
  source:"Owner-authorized Oct 28 comprehensive source-backed rebuild",
  games:enriched,
  coverage:"full-board",
  coverageAudit:{fixtures:enriched.length,completeLastFive: lastFiveCount,
    verifiedPriorMeetings: h2hCount,editorialPredictedXI:xiCount,
    modelProjections:projectionCount,matchesWithPicks:picksCount,
    sourcedTeamNews:newsCount,
    caution:"Unverified inputs remain N/A; model estimates are experimental, not bookmaker probabilities."}
};
validateBoard(board,{requireFull:true});
const oldRaw=await fs.readFile(root,"utf8");
const previousHash=digest(oldRaw);
const backup="data/board-revisions/"+date+"/before-owner-recovery-"+previousHash.slice(0,12)+".json";
await fs.mkdir(path.dirname(backup),{recursive:true});
await fs.writeFile(backup,oldRaw);
const after=JSON.stringify(board,null,2)+"\n";
await fs.writeFile(root+".tmp",after);
await fs.rename(root+".tmp",root);
const auditPath="data/board-revisions/"+date+"/audit.json";
const existingAudit=await load(auditPath);
const audit=[...(Array.isArray(existingAudit)?existingAudit:[]),{
  file:root,owner:"user-authorized",instruction:"Overwrite incomplete Oct 28 picks and enrich all available fixture evidence",
  correctedAt:new Date().toISOString(),backupPath:backup,beforeSha256:previousHash,afterSha256:digest(after),
  coverage:board.coverageAudit
}];
await fs.writeFile(auditPath,JSON.stringify(audit,null,2)+"\n");
console.log("Published owner-authorized recovery:",JSON.stringify(board.coverageAudit));
