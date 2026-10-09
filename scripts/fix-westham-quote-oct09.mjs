import fs from "node:fs/promises";
import crypto from "node:crypto";
const DATE="2026-10-09",FILE="data/boards/"+DATE+".json",DIR="data/board-revisions/"+DATE;
const BACKUP=DIR+"/before-westham-verified-ml-quote.json";
const hash=s=>crypto.createHash("sha256").update(s).digest("hex");
const json=x=>JSON.stringify(x,null,2)+"\n";
async function main(){
 const before=await fs.readFile(FILE,"utf8"),b=JSON.parse(before);
 const g=b.games.find(x=>String(x.id)==="401880233");
 if(!g||!b.ownerCorrection?.modelPickCoverage)throw Error("Expected audited research revision before odds fix");
 if(g.top3[0]?.odds===-220){console.log("Quote already fixed");return;}
 if(g.top3[0]?.odds!=null||g.top3[0]?.label!=="West Ham United ML")throw Error("Unexpected existing pick, no mutation allowed");
 const saved=JSON.parse(await fs.readFile("data/"+DATE+"/scoreboard.json","utf8"));
 const e=saved.events.find(x=>String(x.id)==="401880233");
 const q=e?.competitions?.[0]?.odds?.find(x=>x.provider?.name==="DraftKings"||x.provider?.displayName==="DraftKings");
 const quote=Number(q?.moneyline?.home?.close?.odds);
 if(quote!==-220)throw Error("Native archived DraftKings quote mismatch");
 const model=JSON.parse(await fs.readFile("data/model-candidates-expanded/"+DATE+".json","utf8"));
 const f=model.fixtures.find(x=>String(x.fixtureId)==="401880233");
 if(f?.status!=="shadow_prediction"||Number(g.top3[0].modelProb)!==f.probabilities.home_win)throw Error("No matching archived pre-match model probability");
 const top5=JSON.stringify(b.top5),oldCount=b.games.length;
 const patch=p=>{
  p.odds=quote;p.displayOdds=quote;p.verifiedPrice=true;p.bookExact=true;
  p.provider="DraftKings";p.bookKey="draftkings";p.priceEligible=true;
  p.priceStatus="verified_archive";
  p.marketProb=Number((Math.abs(quote)/(Math.abs(quote)+100)).toFixed(6));
  p.ev=Number((p.modelProb*(1+100/Math.abs(quote))-1).toFixed(6));
  p.archivedCommentary=p.archivedCommentary.replace("An exact price for this line is unavailable.","Archived exact DraftKings -220; this is an original saved price, not a fresh live offer.");
  if(Array.isArray(p.archivedSupportFacts))p.archivedSupportFacts=p.archivedSupportFacts.map(s=>s.replace("An exact price for this line is unavailable.","Archived exact DraftKings -220 from the saved scoreboard."));
 };
 patch(g.top3[0]);if(g.top)patch(g.top);if(g.model?.top)patch(g.model.top);
 if(g.model?.top3?.[0])patch(g.model.top3[0]);
 for(const p of g.model?.candidates||[])if(p.label==="West Ham United ML"&&p.confidenceSource==="uncalibrated_pre_match_dc_probability")patch(p);
 if(JSON.stringify(b.top5)!==top5||b.games.length!==oldCount)throw Error("Unintended board selection mutation");
 const after=json(b),audits=JSON.parse(await fs.readFile(DIR+"/audit.json","utf8"));
 await fs.writeFile(BACKUP,before,{flag:"wx"});
 audits.push({file:FILE,owner:"Shaif",
   instruction:"Fix missing verified moneyline odds in direct-GitHub research picks; accept quoted prices down to -500.",
   correctedAt:new Date().toISOString(),beforeSha256:hash(before),afterSha256:hash(after),backupPath:BACKUP,
   reason:"Original ESPN scoreboard has exact DraftKings -220 West Ham ML; fills only previously unavailable saved price and recomputes raw model EV, preserving original ranking."});
 await fs.writeFile(DIR+"/audit.json",json(audits));
 await fs.writeFile(FILE,after);
 console.log("Restored West Ham original saved native price -220; model probability",f.probabilities.home_win);
}
main().catch(e=>{console.error(e);process.exitCode=1});
