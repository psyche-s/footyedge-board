#!/usr/bin/env node
// Owner-directed cleanup: old deployed UI must not show a third-party
// brand by reading ownerEditorial.source from unchanged raw GitHub JSON.
// Source URLs remain in independent evidence metadata and audit backup.
import fs from "node:fs/promises";
import crypto from "node:crypto";
const DAY="2026-10-09",FILE="data/boards/"+DAY+".json",REV="data/board-revisions/"+DAY;
const BACKUP=REV+"/before-hiding-public-external-preview-links.json";
const old=await fs.readFile(FILE,"utf8"),data=JSON.parse(old);
if(data.date!==DAY||data.state!=="locked"||data.ownerCorrection?.editorialVoice!=="we-20261009")throw Error("Run We-voice pass before hiding old UI source links");
if(data.ownerCorrection?.externalPreviewLinksHidden){console.log("Already hidden");process.exit(0)}
const before=JSON.stringify(data.games.map(g=>({id:g.id,top:g.top,top3:g.top3,model:g.model,news:g.teamNews})));
let changed=0;
for(const game of data.games){
 if(!game.ownerEditorial)continue;
 if(game.ownerEditorial.source){game.ownerEditorial.source=null;changed++}
 if(game.ownerEditorial.secondarySource){game.ownerEditorial.secondarySource=null;changed++}
}
if(changed<2)throw Error("Expected external source links in some public game summaries");
data.ownerCorrection={...data.ownerCorrection,externalPreviewLinksHidden:true};
if(JSON.stringify(data.games.map(g=>({id:g.id,top:g.top,top3:g.top3,model:g.model,news:g.teamNews})))!==before)
 throw Error("Unexpected pick, price, model, stats or team-news mutation");
const sha=x=>crypto.createHash("sha256").update(x).digest("hex");
const serial=x=>JSON.stringify(x,null,2)+"\n",updated=serial(data);
await fs.writeFile(BACKUP,old,{flag:"wx"});
const audit=JSON.parse(await fs.readFile(REV+"/audit.json","utf8"));
audit.push({file:FILE,owner:"Shaif",instruction:"Remove any mention of third-party preview brands from the website and say 'we'.",
 correctedAt:new Date().toISOString(),beforeSha256:sha(old),afterSha256:sha(updated),
 backupPath:BACKUP,reason:"Removed public source-link fields used by the older deployed UI to show a third-party brand; preserved independent source provenance in original pick metadata and this audit backup, and did not touch any picks, odds, confidence, rank or tracking."});
await fs.writeFile(REV+"/audit.json",serial(audit));
await fs.writeFile(FILE,updated);
console.log("Hidden",changed,"public external-preview link fields; old site can now display Our analysis without a named source link");
