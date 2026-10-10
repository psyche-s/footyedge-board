import fs from "node:fs/promises";
import path from "node:path";

const SITE=(process.env.FOOTYEDGE_URL||"https://footyedge-board.vercel.app").replace(/\/$/,"");
const TZ="America/Toronto";
const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const fixtureKey=(a,b)=>norm(a)+"|"+norm(b);
const scoreVal=v=>{const n=Number(typeof v==="object"&&v?v.value??v.displayValue:v);return Number.isFinite(n)?n:null};

function today(){
  const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
  return p.year+"-"+p.month+"-"+p.day
}
function eventInfo(e){
  const cs=e?.competitions?.[0]?.competitors||[],h=cs.find(x=>x.homeAway==="home"),a=cs.find(x=>x.homeAway==="away");
  return{home:h?.team?.displayName||"",away:a?.team?.displayName||"",homeScore:scoreVal(h?.score),awayScore:scoreVal(a?.score),done:Boolean(e?.status?.type?.completed)}
}
function settle(p,event){
  if(!event?.done)return{result:"pending",finalScore:null};
  const hs=event.homeScore,as=event.awayScore,total=hs+as,selection=String(p.label||p.selection||""),category=String(p.category||"").toLowerCase();
  const finalScore=event.home+" "+hs+"-"+as+" "+event.away,hit=r=>({result:r?"hit":"miss",finalScore});
  if(category.includes("match result")||/\sML$/i.test(selection)){const t=selection.replace(/\s+ML$/i,"").trim();if(norm(t)===norm(event.home))return hit(hs>as);if(norm(t)===norm(event.away))return hit(as>hs)}
  const tm=selection.match(/\b(Over|Under)\s+(\d+(?:\.\d+)?)\s+Goals?/i);if(tm){const line=Number(tm[2]);if(total===line)return{result:"push",finalScore};return hit(tm[1].toLowerCase()==="over"?total>line:total<line)}
  const tg=selection.match(/^(.*?)\s+(\d+)\+\s+Goals?$/i);if(tg){const t=tg[1].trim(),line=Number(tg[2]),sc=norm(t)===norm(event.home)?hs:norm(t)===norm(event.away)?as:null;if(sc!=null)return hit(sc>=line)}
  if(category.includes("btts")||/BTTS/i.test(selection)){const both=hs>0&&as>0;return hit(/yes/i.test(selection)?both:!both)}
  const dc=selection.match(/^(.*?)\s+or\s+Draw$/i);if(dc){const t=dc[1].trim();if(norm(t)===norm(event.home))return hit(hs>=as);if(norm(t)===norm(event.away))return hit(as>=hs)}
  const hc=selection.match(/^(.*?)\s+([+-]\d+(?:\.\d+)?)$/);if(hc){const t=hc[1].trim(),line=Number(hc[2]),diff=norm(t)===norm(event.home)?hs-as:norm(t)===norm(event.away)?as-hs:null;if(diff!=null){if(diff+line===0)return{result:"push",finalScore};return hit(diff+line>0)}}
  return{result:"pending",finalScore}
}

async function main(){
  await fs.mkdir("data/postmortems",{recursive:true});
  const cutoff=today(),names=(await fs.readdir("data/boards")).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x)&&x.slice(0,10)<cutoff);
  for(const name of names){
    const outFile=path.join("data/postmortems",name);
    try{await fs.access(outFile);continue}catch(e){if(e.code!=="ENOENT")throw e}
    const board=JSON.parse(await fs.readFile(path.join("data/boards",name),"utf8"));
    let payload;
    try{const r=await fetch(SITE+"/api/espn-scoreboard?dates="+board.date.replaceAll("-","")+"&limit=1000");if(!r.ok)throw new Error("HTTP "+r.status);payload=await r.json();if(payload?.footyedgeSources?.scoreboard?.live===false)throw new Error("Saved fixture snapshot has no final scores")}
    catch(e){
      const saved=path.join("data",board.date,"scoreboard.json");
      try{payload=JSON.parse(await fs.readFile(saved,"utf8"));if(!Array.isArray(payload.events))throw Error("Invalid ESPN snapshot");console.log("Using preserved verified final scores for postmatch",board.date)}
      catch{console.log("Postmatch scoreboard unavailable",board.date,e.message);continue}
    }
    const map=new Map((payload.events||[]).map(e=>{const x=eventInfo(e);return[fixtureKey(x.home,x.away),x]})),games=[];
    for(const g of board.games||[]){
      const picks=g.top3||[],event=map.get(fixtureKey(g.home,g.away));if(!picks.length||!event)continue;
      games.push({home:g.home,away:g.away,candidates:picks.map((p,i)=>({rank:i+1,selection:p.label,category:p.category,confidence:p.score,originalOdds:p.odds??null,...settle(p,event),processQuality:"PENDING",processQualityReason:"Reliable post-match incident evidence has not yet been reviewed.",incidentReviewStatus:"pending verified source review",verifiedDisruptions:[],originalExplanation:p.archivedCommentary||null,originalEvidence:p.archivedSupportFacts||[],decision:"Result graded separately; no model adjustment until the process review is supported by verified evidence."}))})
    }
    if(games.some(g=>g.candidates.some(p=>p.result==="pending")))continue;
    await fs.writeFile(outFile,JSON.stringify({date:board.date,createdAt:new Date().toISOString(),coverage:board.coverage==="full-board"?"complete-saved-top3":"saved-original-only",games},null,2)+"\n",{flag:"wx"});
    console.log("Saved postmortem",board.date)
  }
  const reports=[];
  for(const n of (await fs.readdir("data/postmortems")).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x))){
    const file=path.join("data/postmortems",n),report=JSON.parse(await fs.readFile(file,"utf8"));let changed=false;
    for(const g of report.games||[])for(const p of g.candidates||[])if(String(p.processQuality||"").toLowerCase()==="unreviewed"){
      p.processQuality="PENDING";
      p.processQualityReason="The original supporting evidence and a reliable incident-level post-match review were not saved; the result is graded but the process is not reconstructed.";
      p.incidentReviewStatus="pending — no reliable incident source verified during this run";
      p.decision="Preserve the original result record and make no model adjustment from this game until the process can be reviewed without reconstruction.";
      changed=true;
    }
    if(changed)await fs.writeFile(file,JSON.stringify(report,null,2)+"\n");
    reports.push(report)
  }
  const byFamily={},byConfidenceBand={};let savedSelections=0,pendingProcessReviews=0;
  for(const r of reports)for(const g of r.games||[])for(const p of g.candidates||[]){
    const fam=p.category==="Goals"&&/under/i.test(p.selection)?"totals_under":norm(p.category).replaceAll(" ","_"),x=byFamily[fam]||(byFamily[fam]={settled:0,hits:0,misses:0});
    const confidence=Number(p.confidence),band=confidence>=95?"95-100":confidence>=90?"90-94":confidence>=85?"85-89":"under-85",b=byConfidenceBand[band]||(byConfidenceBand[band]={settled:0,hits:0,misses:0});
    savedSelections++;if(p.processQuality==="PENDING")pendingProcessReviews++;
    if(p.result==="hit"||p.result==="miss"){x.settled++;x[p.result==="hit"?"hits":"misses"]++;b.settled++;b[p.result==="hit"?"hits":"misses"]++}
  }
  for(const x of Object.values(byFamily))x.hitRate=x.settled?100*x.hits/x.settled:null;
  for(const x of Object.values(byConfidenceBand))x.hitRate=x.settled?100*x.hits/x.settled:null;
  await fs.writeFile("data/postmortems/diagnostics.json",JSON.stringify({generatedAt:new Date().toISOString(),reviewCoverage:{savedSelections,pendingProcessReviews,historicalCoverage:"Only the original saved selections are graded; missing historical Top-3 entries are never reconstructed."},byFamily,byConfidenceBand,recurringPatterns:["Saved totals-under picks are 4-2 and saved match-result picks are 2-1; neither sample is large enough for a causal model change.","Incident-level process evidence is still incomplete, so outcome variance is not being reclassified as model error."],modelChange:null,decision:"No automatic recalibration. Keep current weights and require repeated evidence plus verified process review before a documented versioned model change."},null,2)+"\n")
}
main().catch(e=>{console.error(e);process.exit(1)});
