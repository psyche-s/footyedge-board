#!/usr/bin/env node
/** FootyEdge 1X2/ML and DC market audit; NEVER changes official picks.
 * Operates solely on existing dated match research, no new provider fetch.
 * Historical hit rates are not calibrated probabilities.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const DAY=/^\d{4}-\d{2}-\d{2}$/;
function prior(rows,kickoff){
  if(!Array.isArray(rows))return [];
  return rows.filter(x=>x&&Number.isInteger(x.gf)&&Number.isInteger(x.ga)&&
    Number.isFinite(Date.parse(x.date))&&Date.parse(x.date)<Date.parse(kickoff)&&
    x.gf>=0&&x.ga>=0&&x.gf<=20&&x.ga<=20)
    .sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,10);
}
function stat(arr,f){return {hits:arr.filter(f).length,sample:arr.length}}
function candidate(label,market,first,second,thresholds){
  const [minChosen,minOpp,minCombined]=thresholds;
  const n=first.sample+second.sample;
  const support=n?Number(((first.hits+second.hits)/n).toFixed(3)):null;
  const enough=first.sample>=8&&second.sample>=8;
  const watch=enough&&first.hits/first.sample>=minChosen&&second.hits/second.sample>=minOpp&&support>=minCombined;
  return {label,category:market,firstSample:first,opponentSample:second,observedCombinedSupport:support,
    reviewStatus:!enough?"pass-insufficient-history":watch?"research-watch":"pass-weak-or-mixed-support",
    isOfficialPick:false,modelProbability:null,calibratedConfidence:null,odds:null,ev:null};
}
export function evaluateMatch(fixture,generatedAt){
  if(!fixture?.id||!fixture.home?.name||!fixture.away?.name||
     !Number.isFinite(Date.parse(fixture.date)))throw Error("invalid_fixture_identity");
  const H=prior(fixture.last10?.home,fixture.date),A=prior(fixture.last10?.away,fixture.date);
  const hw=stat(H,x=>x.gf>x.ga),hd=stat(H,x=>x.gf===x.ga),hl=stat(H,x=>x.gf<x.ga);
  const aw=stat(A,x=>x.gf>x.ga),ad=stat(A,x=>x.gf===x.ga),al=stat(A,x=>x.gf<x.ga);
  const entries=[
   candidate(fixture.home.name+" ML","Match Result",hw,al,[.6,.4,.55]),
   candidate("Draw","Match Result",hd,ad,[.45,.45,.45]),
   candidate(fixture.away.name+" ML","Match Result",aw,hl,[.6,.4,.55]),
   candidate(fixture.home.name+" or Draw","Double Chance",stat(H,x=>x.gf>=x.ga),stat(A,x=>x.gf<=x.ga),[.8,.6,.7]),
   candidate(fixture.away.name+" or Draw","Double Chance",stat(A,x=>x.gf>=x.ga),stat(H,x=>x.gf<=x.ga),[.8,.6,.7])
  ];
  return {id:String(fixture.id),date:fixture.date,league:fixture.league,
    home:fixture.home.name,away:fixture.away.name,
    preKickoff:Date.parse(generatedAt)<Date.parse(fixture.date),
    historicalHomeGames:H.length,historicalAwayGames:A.length,
    resultMarkets:entries,officialBoardModified:false};
}
export function evaluateSlate(research,generatedAt){
  if(!research||!DAY.test(research.date||"")||!Array.isArray(research.fixtures)||
     !Number.isFinite(Date.parse(generatedAt)))throw Error("invalid_research");
  const games=research.fixtures.map(x=>evaluateMatch(x,generatedAt));
  if(new Set(games.map(x=>x.id)).size!==games.length)throw Error("duplicate_fixture");
  return {schema:"footyedge-fulltime-market-review-v1",date:research.date,
    generatedAt,sourceResearchGeneratedAt:research.generatedAt||null,
    publicDisplay:"research-only-not-official-picks",noProviderApiRequests:true,
    officialBoardUnchanged:true,oddsVerified:false,confidenceCalibrated:false,
    summary:{games:games.length,marketChecks:games.length*5,
      watches:games.reduce((n,g)=>n+g.resultMarkets.filter(m=>m.reviewStatus==="research-watch").length,0)},
    games};
}
async function main(){
  const date=process.argv[2];
  if(!DAY.test(date||""))throw Error("Explicit YYYY-MM-DD date required");
  const input=path.join(ROOT,"data","research-base-"+date+".json");
  const base=JSON.parse(await fs.readFile(input,"utf8"));
  if(base.date!==date)throw Error("Research date mismatch");
  const report=evaluateSlate(base,new Date().toISOString());
  const file=path.join(ROOT,"data","market-reviews",date+".json");
  const old=await fs.readFile(file,"utf8").catch(err=>{if(err.code==="ENOENT")return null;throw err});
  if(old){console.log("Dated market report already exists; do not rewrite");return}
  await fs.mkdir(path.dirname(file),{recursive:true});
  await fs.writeFile(file,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({date,summary:report.summary,lockedPicksChanged:0}));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]))
  main().catch(err=>{console.error(err.message);process.exitCode=1});
