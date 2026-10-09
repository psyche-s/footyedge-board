import fs from "node:fs/promises";
import crypto from "node:crypto";
// Owner-authorized, auditable October 9 research-picks correction; not a
// re-creation of originally published 06:00 picks.
const DATE="2026-10-09", FILE="data/boards/"+DATE+".json";
const REV="data/board-revisions/"+DATE;
const BACKUP=REV+"/before-research-pick-revision.json";
const sha=x=>crypto.createHash("sha256").update(x).digest("hex");
const parse=async file=>JSON.parse(await fs.readFile(file,"utf8"));
const json=x=>JSON.stringify(x,null,2)+"\n";
const plan={
"401882851":[["under_2_5","Under 2.5 Goals","Goals"],["away_or_draw","Espanyol or Draw","Double Chance"]],
"401876447":[["under_3_5","Under 3.5 Goals","Goals"],["home_win","Lens ML","Match Result"]],
"401885423":[["under_3_5","Under 3.5 Goals","Goals"],["away_or_draw","Gil Vicente or Draw","Double Chance"]],
"401885427":[["over_2_5","Over 2.5 Goals","Goals"],["away_win","Sporting CP ML","Match Result"]],
"401880233":[["home_win","West Ham United ML","Match Result"],["over_1_5","Over 1.5 Goals","Goals"]]
};
function quoteFor(side,market){
  const p=[...(side?.markets||[]),...(side?.totalMarkets||[])].find(x=>x.market===market&&x.status==="verified_american_snapshot");
  return p?.odds!=null?{odds:p.odds,provider:p.sportsbook,ev:p.rawModelEV}:null;
}
function pick(f,market,label,category,quote,facts){
  const prob=f.probabilities?.[market];
  if(typeof prob!=="number"||!Number.isFinite(prob)||prob<0||prob>1)throw Error("Missing DC probability: "+market);
  if(quote?.odds<-500)throw Error("Disallowed odds");
  const score=Math.round(prob*100);
  const explanation="Saved pre-kickoff Dixon-Coles v0.5 probability for "+label+": "+(100*prob).toFixed(1)+"%. This probability is experimental and NOT validated betting confidence. "+
    (quote?.odds==null?"An exact price for this line is unavailable.":"Archived exact "+quote.provider+" "+(quote.odds>0?"+":"")+quote.odds+"; the sportsbook price may have changed.");
  return {
    label,category,score,modelScore:score,baseScore:score,
    stars:score>=92?"★★★★★":score>=88?"★★★★½":score>=83?"★★★★":score>=78?"★★★½":"★★★",
    odds:quote?.odds??null,bookExact:!!quote,verifiedPrice:!!quote,
    provider:quote?.provider??null,bookKey:quote?.provider==="DraftKings"?"draftkings":null,
    priceStatus:quote?"verified_archive": "exact_price_unavailable",
    modelProb:prob,ev:quote?.ev??null,displayOdds:quote?.odds??null,
    priceEligible:!!quote,displayOnly:true,researchOnly:true,
    confidenceSource:"uncalibrated_pre_match_dc_probability",
    modelVersion:"dc-shadow-v0.5",marketKey:market,
    archivedCommentary:explanation,
    archivedSupportFacts:[explanation,...(facts||[]).filter(Boolean)].slice(0,3)
  };
}
async function main(){
  const old=await fs.readFile(FILE,"utf8"), board=JSON.parse(old);
  if(board.date!==DATE||!board.immutable||board.games.length!==8)throw Error("Unexpected board state");
  if(board.ownerCorrection?.modelPickCoverage){console.log("Owner revision already applied");return;}
  const [model,side,scoreboard,research,audits]=await Promise.all([
    parse("data/model-candidates-expanded/"+DATE+".json"),
    parse("data/model-boards-v3/"+DATE+".json"),
    parse("data/"+DATE+"/scoreboard.json"),
    parse("data/research-base-expanded-"+DATE+".json"),
    parse(REV+"/audit.json")
  ]);
  if(model.modelVersion!=="dc-shadow-v0.5"||model.coverage?.eligibleLeagueFixtures!==8)throw Error("Invalid as-of DC snapshot");
  const models=new Map(model.fixtures.map(f=>[String(f.fixtureId),f]));
  const odds=new Map(side.matchups.map(f=>[String(f.fixtureId),f]));
  const events=new Map(scoreboard.events.map(e=>[String(e.id),e]));
  const facts=new Map(research.fixtures.map(f=>[String(f.id),(f.facts||[]).map(x=>x.text)]));
  const top5=JSON.stringify(board.top5);
  const originals=new Map(board.games.map(g=>[String(g.id),JSON.stringify(g.top3)]));
  let inserted=0;
  for(const g of board.games){
    const id=String(g.id);
    if(id==="401884781"||id==="401875592")continue;
    let selections=[];
    if(id==="401888280"){
      // Turkish current-season sample is 340 days stale. Never label a
      // bookmaker-derived view an independent fitted model probability.
      const e=events.get(id),q=e?.competitions?.[0]?.odds?.[0];
      const ml=q?.moneyline;
      const prices=["home","draw","away"].map(k=>Number(ml?.[k]?.close?.odds));
      if(prices.some(n=>!Number.isFinite(n)||n===0))throw Error("Unverified Turkish 1X2 quote");
      const implied=prices.map(n=>n>0?100/(n+100):Math.abs(n)/(Math.abs(n)+100));
      const noVig=Math.round(100*implied[0]/implied.reduce((a,b)=>a+b,0));
      const message="MARKET-ONLY LEAN: Galatasaray ML at saved DraftKings "+prices[0]+". "+
        "The displayed "+noVig+"% is an odds-derived no-vig market proxy, NOT a Dixon-Coles forecast. "+
        "Turkish current-season results were too stale to generate a credible model prediction.";
      selections=[{
        label:"Galatasaray ML (market-only lean)",category:"Match Result",
        score:noVig,modelScore:null,stars:"★★★",odds:prices[0],displayOdds:prices[0],
        provider:"DraftKings",bookKey:"draftkings",bookExact:true,verifiedPrice:true,
        modelProb:null,ev:null,priceEligible:prices[0]>=-500,displayOnly:true,
        researchOnly:true,confidenceSource:"bookmaker_no_vig_NOT_FOOTYEDGE_MODEL",
        archivedCommentary:message,archivedSupportFacts:[message]
      }];
    }else{
      const f=models.get(id);
      if(f?.status!=="shadow_prediction"||Date.parse(f.kickoff)<=Date.parse(model.asOf))throw Error("Missing genuine pre-kickoff forecast for "+id);
      selections=(plan[id]||[]).map(([market,label,category])=>
        pick(f,market,label,category,quoteFor(odds.get(id),market),facts.get(id)));
      if(!selections.length)throw Error("No comparable archived markets "+id);
    }
    g.top=selections[0];g.top3=selections;
    g.model={...(g.model||{}),top:selections[0],top3:selections,
      candidates:[...(g.model?.candidates||[]),...selections],
      researchCandidates:selections,rankedCandidates:[],
      expandedAsOfModel:model.modelVersion};
    g.ownerPickRevision={modelVersion:model.modelVersion,selectionType:"uncalibrated_model_research",notOfficial85:true};
    inserted++;
  }
  if(inserted!==6)throw Error("Expected six uncovered fixtures");
  if(top5!==JSON.stringify(board.top5))throw Error("Global Top 5 was modified");
  for(const id of ["401884781","401875592"]){
    const g=board.games.find(g=>String(g.id)===id);
    if(JSON.stringify(g.top3)!==originals.get(id))throw Error("Original qualifying pick was modified");
  }
  board.ownerCorrection={...board.ownerCorrection,modelPickCoverage:true,
    maxAllowedAmericanFavourite:-500,
    disclaimer:"Today's supplemental selections are recorded as new owner-requested research at their true current correction time, not falsely attributed to the original 06:00 publication."};
  const updated=json(board);
  await fs.writeFile(BACKUP,old,{flag:"wx"});
  audits.push({file:FILE,owner:"Shaif",
    instruction:"Fill the other games with model-based research picks and stats directly in GitHub; allow all exact prices down to -500.",
    correctedAt:new Date().toISOString(),beforeSha256:sha(old),afterSha256:sha(updated),backupPath:BACKUP,
    reason:"Owner-authorized model research coverage for six previously unfilled matches, distinctly dated and uncalibrated; preserve original qualifying Dortmund/PSV picks, global Top 5 and original archive backup."});
  await fs.writeFile(REV+"/audit.json",json(audits));
  await fs.writeFile(FILE,updated);
  console.log("Added model-backed research picks to six games; -500 floor; audit intact.");
}
main().catch(error=>{console.error(error);process.exitCode=1});
