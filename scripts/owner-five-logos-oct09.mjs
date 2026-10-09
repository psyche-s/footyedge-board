#!/usr/bin/env node
/** Owner's supplied league logos: metadata only, audited after 6 AM freeze. */
import fs from "node:fs/promises";
import crypto from "node:crypto";
const DAY="2026-10-09",FILE="data/boards/"+DAY+".json",REV="data/board-revisions/"+DAY;
const BEFORE=REV+"/before-owner-five-logos.json";
const URLS={
 "cze.1":"https://assets.football-logos.cc/logos/czech-republic/512x512/chance-liga.8511af91.png",
 "tur.1":"https://assets.football-logos.cc/logos/turkey/512x512/super-lig.e5930ec5.png",
 "ksa.1":"https://assets.football-logos.cc/logos/saudi-arabia/512x512/saudi-professional-league.59d5c8af.png",
 "por.1":"https://assets.football-logos.cc/logos/portugal/512x512/primeira-liga--white.c5c27520.png",
 "eng.2":"https://assets.football-logos.cc/logos/england/512x512/efl-championship.2766b536.png"
};
const old=await fs.readFile(FILE,"utf8"),data=JSON.parse(old);
if(data.date!==DAY||!data.immutable||data.games.length!==12)throw Error("Unexpected October 9 historical board");
if(data.ownerCorrection?.exactFiveLeagueLogoMetadata){console.log("Already corrected");process.exit(0)}
const oldRankings=JSON.stringify(data.top5), oldPicks=JSON.stringify(data.games.map(g=>[g.id,g.top,g.top3,g.model,g.teamNews]));
let count=0;
for(const g of data.games){
 const url=URLS[g.league];if(!url)continue;
 if(g.leagueLogo!==url){g.leagueLogo=url;count++}
}
if(count<6)throw Error("Unexpected absence of old league crest references");
data.ownerCorrection={...data.ownerCorrection,exactFiveLeagueLogoMetadata:true};
if(oldRankings!==JSON.stringify(data.top5)||
 oldPicks!==JSON.stringify(data.games.map(g=>[g.id,g.top,g.top3,g.model,g.teamNews])))
 throw Error("This must be a logo-only change with no changes to picks, odds, stats or history");
const fmt=v=>JSON.stringify(v,null,2)+"\n",newText=fmt(data),
 sha=t=>crypto.createHash("sha256").update(t).digest("hex");
await fs.writeFile(BEFORE,old,{flag:"wx"});
const audits=JSON.parse(await fs.readFile(REV+"/audit.json","utf8"));
audits.push({file:FILE,owner:"Shaif",
 instruction:"Use these exact five Czech, Turkish, Saudi, Portuguese and English Championship league crest URLs.",
 correctedAt:new Date().toISOString(),
 beforeSha256:sha(old),afterSha256:sha(newText),backupPath:BEFORE,
 reason:"League-logo-only public board JSON metadata correction. Original 12 game records, 26 selections, rankings, prices, form and history preserved."});
await fs.writeFile(REV+"/audit.json",fmt(audits));
await fs.writeFile(FILE,newText);
console.log("Updated",count,"old competition logos to owner's exact supplied artwork.");
