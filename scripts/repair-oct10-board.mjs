import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {validateBoard,validateIntegrity,sha256} from "./validate-published-boards.mjs";

const DATE="2026-10-10";
const originalPath=process.env.ORIGINAL_BOARD||"/tmp/footyedge-original-board.json";
const originalResearchPath=process.env.ORIGINAL_RESEARCH||"/tmp/footyedge-original-research.json";
const draftPath=path.join("data","board-drafts",DATE+".json");
const boardPath=path.join("data","boards",DATE+".json");
const researchPath=path.join("data","research-base-"+DATE+".json");
const original=JSON.parse(fs.readFileSync(originalPath,"utf8"));
const draft=JSON.parse(fs.readFileSync(draftPath,"utf8"));
const originalResearch=fs.readFileSync(originalResearchPath,"utf8");
const repairedResearch=fs.readFileSync(researchPath,"utf8");
const now=new Date().toISOString();

const fixtureKey=g=>String((g?.home||"")+"|"+(g?.away||"")).toLowerCase();
const pickKey=p=>String(p?.label||"").toLowerCase().trim();
const oldGames=new Map((original.games||[]).map(g=>[String(g.id||fixtureKey(g)),g]));
const oldFixture=new Map((original.games||[]).map(g=>[fixtureKey(g),g]));

function validPrice(p){
  if(!p)return false;
  const n=Number(String(p.odds??"").replace("+",""));
  if(Number.isFinite(n))return n>=-500;
  return Boolean(p.verifiedPrice&&Number(p.priceDecimal)>=1.2);
}
function mergeGame(fresh){
  const old=oldGames.get(String(fresh.id))||oldFixture.get(fixtureKey(fresh));
  if(!old)return fresh;
  if(!old.top)return fresh;
  const extras=(fresh.top3||[]).filter(p=>pickKey(p)!==pickKey(old.top)&&validPrice(p));
  const merged={...fresh,...Object.fromEntries(["ownerResearchNote","ownerEditorial"].filter(k=>old[k]!=null).map(k=>[k,old[k]]))};
  merged.top=old.top;
  merged.top3=[old.top,...extras].slice(0,3);
  if(old.teamNews?.length)merged.teamNews=old.teamNews;
  if(old.teamNewsReview)merged.teamNewsReview=old.teamNewsReview;
  if(merged.model){
    merged.model={...merged.model,top:old.top,top3:merged.top3};
    for(const key of ["candidates","rankedCandidates","researchCandidates"]){
      const arr=Array.isArray(merged.model[key])?merged.model[key]:[];
      merged.model[key]=[old.top,...arr.filter(p=>pickKey(p)!==pickKey(old.top))];
    }
  }
  return merged;
}

const repaired=JSON.parse(JSON.stringify(draft));
repaired.immutable=true;
repaired.state="locked";
repaired.source="FootyEdge official Toronto fixture-day locked board · audited owner correction";
repaired.frozenAt=original.frozenAt||original.generatedAt||repaired.frozenAt;
repaired.policyFreezeAtToronto=original.policyFreezeAtToronto||DATE+" 00:30 America/Toronto";
repaired.lockedAtToronto=original.lockedAtToronto||DATE+" 00:30 America/Toronto";
repaired.correctedAt=now;
repaired.correctionReason="Owner-requested repair after upstream provider failures left the October 10 publication without a complete Top 5 / per-game Top 3. Existing frozen selections are preserved exactly; only missing current-day selections are added from newly verified data and exact prices.";
repaired.games=(draft.games||[]).map(mergeGame);

const mergedById=new Map(repaired.games.map(g=>[String(g.id),g]));
const mergedByFixture=new Map(repaired.games.map(g=>[fixtureKey(g),g]));
for(const old of original.games||[]){
  if(!mergedById.has(String(old.id))&&!mergedByFixture.has(fixtureKey(old)))repaired.games.push(old);
}

const preserved=[];
const seenFixtures=new Set();
for(const ref of original.top5||[]){
  const g=mergedById.get(String(ref.gameId))||mergedByFixture.get(String((ref.home||"")+"|"+(ref.away||"")).toLowerCase());
  if(!g?.top||seenFixtures.has(fixtureKey(g)))continue;
  preserved.push({rank:preserved.length+1,gameId:g.id,home:g.home,away:g.away,pick:g.top});
  seenFixtures.add(fixtureKey(g));
}
const candidates=repaired.games.filter(g=>g.top&&validPrice(g.top)&&Number(g.top.score)>=80&&!seenFixtures.has(fixtureKey(g)))
  .sort((a,b)=>Number(b.top.score)-Number(a.top.score)||(Number(b.top.ev)||-99)-(Number(a.top.ev)||-99));
for(const g of candidates){
  if(preserved.length>=5)break;
  preserved.push({rank:preserved.length+1,gameId:g.id,home:g.home,away:g.away,pick:g.top});
  seenFixtures.add(fixtureKey(g));
}
repaired.top5=preserved.slice(0,5);

const leagues=[...new Set(repaired.games.map(g=>g.league).filter(Boolean))];
repaired.leagueTop5=Object.fromEntries(leagues.map(league=>{
  const refs=repaired.games.filter(g=>g.league===league&&g.top&&validPrice(g.top)&&Number(g.top.score)>=80)
    .sort((a,b)=>Number(b.top.score)-Number(a.top.score))
    .slice(0,5)
    .map((g,i)=>({rank:i+1,gameId:g.id,home:g.home,away:g.away,pick:g.top}));
  return[league,refs];
}));

validateBoard(repaired,{requireFull:true});
if(repaired.top5.length<5)throw new Error("Repair still produced only "+repaired.top5.length+" global Top picks; refusing incomplete correction.");

fs.mkdirSync(path.dirname(boardPath),{recursive:true});
const beforeBoard=fs.readFileSync(originalPath,"utf8");
const afterBoard=JSON.stringify(repaired,null,2)+"\n";
fs.writeFileSync(boardPath,afterBoard);

const revisionDir=path.join("data","board-revisions",DATE);
fs.mkdirSync(revisionDir,{recursive:true});
const boardBackup=path.join(revisionDir,"owner-repair-before-board.json");
const researchBackup=path.join(revisionDir,"owner-repair-before-research-base.json");
if(!fs.existsSync(boardBackup))fs.writeFileSync(boardBackup,beforeBoard);
if(!fs.existsSync(researchBackup))fs.writeFileSync(researchBackup,originalResearch);

const auditPath=path.join(revisionDir,"audit.json");
let audits=[];if(fs.existsSync(auditPath))audits=JSON.parse(fs.readFileSync(auditPath,"utf8"));
const instruction="Restore the missing Top 5 board, the per-game Top 3 picks, and H2H/full-analysis access after the incomplete October 10 refresh.";
function appendAudit(file,before,after,backupPath){
  const entry={file,beforeSha256:sha256(before),afterSha256:sha256(after),owner:"Shaif",instruction,correctedAt:now,backupPath};
  if(!audits.some(a=>a.file===entry.file&&a.beforeSha256===entry.beforeSha256&&a.afterSha256===entry.afterSha256))audits.push(entry);
}
appendAudit(boardPath,beforeBoard,afterBoard,boardBackup);
appendAudit(researchPath,originalResearch,repairedResearch,researchBackup);
fs.writeFileSync(auditPath,JSON.stringify(audits,null,2)+"\n");

console.log("Repaired board:",repaired.top5.length,"global picks;",
  repaired.games.filter(g=>(g.top3||[]).length).length,"games with priced Top 3 content.");
validateIntegrity();
