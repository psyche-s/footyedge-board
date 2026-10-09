#!/usr/bin/env node
/** Read-only Dixon-Coles cross-check for the FootyEdge match board.
 * Original Top 3, Top 5, odds and settled performance records are immutable.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

function oddsToProb(american){
  if(!Number.isFinite(american)||american===0)return null;
  return american>0?100/(100+american):Math.abs(american)/(Math.abs(american)+100);
}
function decimalOdds(american){
  return american>0?1+american/100:1+100/Math.abs(american);
}
export function buildOverlay({candidate,odds,date}){
  if(candidate?.date!==date||candidate?.mode!=="shadow_only"||candidate?.promotedToPicks!==false)
    throw new Error("Candidate must be correct-date and pre-publication experimental");
  if(odds?.date!==date||odds.verifiedNativeOnly!==true||odds.nativeFormat!=="american")
    throw new Error("Bookmaker snapshot missing exact-native provenance");
  const asof=Date.parse(candidate.asOf);
  if(!Number.isFinite(asof))throw new Error("Model as-of timestamp missing");
  const list=[],verifiedPrice=0;
  for(const fixture of candidate.fixtures||[]){
    if(fixture.status!=="shadow_prediction")continue;
    if(Date.parse(fixture.kickoff)<=asof||!Number.isFinite(Date.parse(fixture.kickoff)))continue;
    if(!fixture.league||/\(w\)/i.test(fixture.home+" "+fixture.away))continue;
    const o=(odds.events||[]).find(x=>x.league===fixture.league &&
      x.home===fixture.home&&x.away===fixture.away);
    const prices=[
      ["home_win","Home ML",o?.homeML],["draw","Draw",o?.drawML],["away_win","Away ML",o?.awayML]
    ];
    const markets=prices.map(([key,label,p])=>{
      const prob=Number(fixture.probabilities?.[key]);
      if(!Number.isFinite(prob)||prob<0||prob>1)throw Error("Bad model probability");
      const valid=o&&o.mlBook?.key&&Number.isInteger(p)&&p!==0&&p>=-10000&&p<=10000;
      const american=valid?p:null,implied=valid?oddsToProb(p):null;
      if(valid)verifiedPrice++;
      return {market:key,label,modelProbability:prob,odds:american,
        sportsbook:valid?o.mlBook.name||o.provider:null,
        marketImpliedProbability:implied==null?null:Number(implied.toFixed(6)),
        rawModelEV:implied==null?null:Number((prob*decimalOdds(p)-1).toFixed(6)),
        status:valid?"verified_american_snapshot":"exact_price_unavailable",
        qualifiesForResearchLook:valid&&prob>=.65&&p>=-400&&prob*decimalOdds(p)>1};
    });
    const supported=markets.filter(x=>x.qualifiesForResearchLook);
    list.push({fixtureId:String(fixture.fixtureId),league:fixture.league,
      home:fixture.home,away:fixture.away,kickoff:fixture.kickoff,
      modelVersion:candidate.modelVersion,modelAsOf:candidate.asOf,
      markets,unpricedProbabilities:{
        over_1_5:fixture.probabilities?.over_1_5??null,
        under_2_5:fixture.probabilities?.under_2_5??null,
        over_2_5:fixture.probabilities?.over_2_5??null,
        under_3_5:fixture.probabilities?.under_3_5??null,
        btts_yes:fixture.probabilities?.btts_yes??null,
        btts_no:fixture.probabilities?.btts_no??null
      },
      researchLooks:supported.map(x=>({market:x.market,modelProbability:x.modelProbability,
        odds:x.odds,rawModelEV:x.rawModelEV})),
      note:"Model probabilities are raw/unvalidated. These are independent research estimates, not guaranteed picks.",
    });
  }
  return {date,kind:"experimental_dixon_coles_crosscheck",modelVersion:candidate.modelVersion,
    snapshotGeneratedAt:candidate.asOf,sourceResearchSha256:candidate.researchInputSha256||null,
    oddsAsOf:odds.fetchedAt||null,verifiedMoneylineQuotes:verifiedPrice,
    leagueFixtures:list.length,matchups:list,
    source:"Archived original pre-match Dixon-Coles v0.3 candidate and verified native sportsbook daily snapshot",
    publicationPolicy:"Read-only model cross-check. Original locked picks/odds/confidence and performance unchanged.",
    warnings:["Raw model probabilities have not passed long-run calibration.",
      "No exact native total/BTTS/alternative prices in the saved odds feed; those markets are not quoted here.",
      "Snapshot odds are as-of the saved morning quote, not necessarily currently offered."]};
}
async function main(){
  const a=process.argv.slice(2),idx=a.indexOf("--date");
  const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",
    year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
  const date=idx>=0?a[idx+1]:p.year+"-"+p.month+"-"+p.day;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Bad date");
  const file=path.join("data","model-boards",date+".json");
  try{await fs.access(file);console.log("Model cross-check preserved:",file);return;}catch(e){if(e.code!=="ENOENT")throw e;}
  const [c,o]=await Promise.all([
    fs.readFile("data/model-candidates/"+date+".json","utf8").then(JSON.parse),
    fs.readFile("data/daily-odds-"+date+".json","utf8").then(JSON.parse)]);
  const out=buildOverlay({candidate:c,odds:o,date});
  console.log("Model analysis",date,out.leagueFixtures,"league fixtures",out.verifiedMoneylineQuotes,"verified ML prices");
  if(a.includes("--dry-run"))return;
  await fs.mkdir(path.dirname(file),{recursive:true});
  await fs.writeFile(file,JSON.stringify(out,null,2)+"\n",{flag:"wx"});
  console.log("Archived:",file);
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(e=>{console.error(e);process.exitCode=1});
