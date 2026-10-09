#!/usr/bin/env node
/** User-authorized copy-only correction: FootyEdge speaks as "we".
 * Keep original research URLs as non-public source provenance.
 * Never alter picks, odds, probabilities, scores, rank or frozenAt.
 */
import fs from "node:fs/promises";
import crypto from "node:crypto";
const DAY="2026-10-09";
const FILE="data/boards/"+DAY+".json";
const REV="data/board-revisions/"+DAY;
const BACKUP=REV+"/before-we-voice-editorial-update.json";
const original=await fs.readFile(FILE,"utf8");
const board=JSON.parse(original);
if(board.date!==DAY||board.state!=="locked"||!board.immutable)throw Error("Unexpected board state");
if(board.ownerCorrection?.editorialVoice==="we-20261009"){
 console.log("First-person plural editorial update already applied");process.exit(0);
}
const replacements=[
 ["Football Whispers prefers BTTS and an away win; the model is more favourable to Lens. Result markets carry added uncertainty.",
  "We see a case for both teams scoring, but we lean toward Lens in a difficult matchup. Lyon's form makes the result market less certain."],
 ["Lens have scored nine in five league games; Football Whispers also expects both teams to score, despite Lyon's defensive strength.",
  "We see a chance for both teams to score: Lens have nine goals in five league games, although Lyon have defended well."],
 ["Football Whispers expects goals here, but our goals model leans Under 2.5. Treat that under as a disagreement, not a sure thing.",
  "We lean toward a tighter game, but the last four head-to-head meetings all had at least three goals. Under 2.5 is far from certain."],
 ["Our goals forecast points to a tighter game, but four straight high-scoring H2Hs and Football Whispers' Over 2.5 pick are clear reasons for caution.",
  "We favour a tighter game, but the last four meetings all produced at least three goals. That is a good reason for caution with Under 2.5."],
 ["Football Whispers plus vetted additional previews where relevant",
  "We compare recent form, head-to-head results, squad news and independent research."],
];
const auditKey=s=>crypto.createHash("sha256").update(s).digest("hex");
const serialized=x=>JSON.stringify(x,null,2)+"\n";
let changed=0;
function rewrite(x){
 if(typeof x==="string"){
   // URLs serve as internal evidence and are not site prose. Preserve
   // independent source attribution for auditing, without publishing names.
   if(/^https?:\/\//.test(x))return x;
   let next=x;
   for(const [from,to] of replacements){
     if(next.includes(from))changed++;
     next=next.replaceAll(from,to);
   }
   return next;
 }
 if(Array.isArray(x))return x.map(rewrite);
 if(x&&typeof x==="object"){
   return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,rewrite(v)]));
 }
 return x;
}
const update=rewrite(board);
update.ownerCorrection={...update.ownerCorrection,editorialVoice:"we-20261009"};
if(changed<5)throw Error("Expected several visible references to reword");
function findVisibleThirdParty(x){
 if(typeof x==="string")return !/^https?:\/\//.test(x)&&/football[\s-]*whispers/i.test(x)?[x]:[];
 if(Array.isArray(x))return x.flatMap(findVisibleThirdParty);
 return x&&typeof x==="object"?Object.values(x).flatMap(findVisibleThirdParty):[];
}
if(findVisibleThirdParty(update).length)throw Error("Public copy still contains external source brand");
const editedKeys=new Set(["archivedCommentary","archivedSupportFacts","watchOut","previewSources","editorialVoice"]);
function immutableProjection(x){
 if(Array.isArray(x))return x.map(immutableProjection);
 if(x&&typeof x==="object")
  return Object.fromEntries(Object.entries(x).filter(([k])=>!editedKeys.has(k)).map(([k,v])=>[k,immutableProjection(v)]));
 return x;
}
if(JSON.stringify(immutableProjection(board))!==JSON.stringify(immutableProjection(update)))
 throw Error("A non-editorial pick, odds, confidence, rank or tracking value changed");
const after=serialized(update);
await fs.writeFile(BACKUP,original,{flag:"wx"});
const audits=JSON.parse(await fs.readFile(REV+"/audit.json","utf8"));
audits.push({file:FILE,owner:"Shaif",
 instruction:"Please remove any mention of Football Whispers; rather say we.",
 correctedAt:new Date().toISOString(),beforeSha256:auditKey(original),afterSha256:auditKey(after),
 backupPath:BACKUP,
 reason:"Reworded only public-facing footy research commentary to 'we/our analysis', kept source URLs internally for validation. No original or updated selection, line, grade, odds, score or tracked history changed."});
await fs.writeFile(REV+"/audit.json",serialized(audits));
await fs.writeFile(FILE,after);
console.log("Editorial voice update complete. Changed",changed,"public-facing fragments. Verified no third-party brand references in the visitor copy and preserved all non-editorial data.");
