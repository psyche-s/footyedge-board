#!/usr/bin/env node
// Owner-approved, permission-gated editorial consensus for NEW FootyEdge drafts.
// This runs between draft generation and the immutable 00:30 Toronto freeze.
// A public article URL is not permission to mirror/scrape its content.
import fs from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {takeDistinctTopPicks} from "./market-diversity.mjs";

export const SOURCES = Object.freeze({
  forebet: "forebet.com",
  football_whispers: "footballwhispers.com",
  sportskeeda: "sportskeeda.com",
  sports_mole: "sportsmole.co.uk",
  forza_football: "forzafootball.com",
});
const dayET=()=>Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
export const normalizeKey=(label,g)=>{
  const str=String(label||"").toLowerCase(), home=String(g.home||"").toLowerCase(), away=String(g.away||"").toLowerCase();
  if(/over\s*1\.5/.test(str))return "over_1_5";
  if(/over\s*2\.5/.test(str))return "over_2_5";
  if(/under\s*2\.5/.test(str))return "under_2_5";
  if(/under\s*3\.5/.test(str))return "under_3_5";
  if(/under\s*4\.5/.test(str))return "under_4_5";
  if(/btts|both teams to score/.test(str))return /no|not/.test(str)?"btts_no":"btts_yes";
  if(/1\+\s*goal|over\s*0\.5\s*(?:team|goal)/.test(str)){
    if(str.includes(home))return "home_goal";
    if(str.includes(away))return "away_goal";
  }
  if(/ or draw|double chance|1x|x2/.test(str)){
    if(str.includes(home)||/\b1x\b/.test(str))return "home_or_draw";
    if(str.includes(away)||/\bx2\b/.test(str))return "away_or_draw";
  }
  if(/\bml\b| to win\b|moneyline/.test(str)){
    if(str.includes(home))return "home_win";
    if(str.includes(away))return "away_win";
  }
  return null;
};
const family=k=>["home_win","away_win","home_or_draw","away_or_draw"].includes(k)?"result":
  /^(over|under)_/.test(k)?"totals":k.startsWith("btts")?"btts":k;
export function authorised(item,day,known){
  if(!item||item.fixture_date!==day||!known.has(String(item.match_id))||!SOURCES[item.source])return false;
  if(item.permission!=="authorized"||!String(item.permission_reference||"").trim())return false;
  if(!["support","oppose"].includes(item.stance))return false;
  if(typeof item.market_key!=="string"||!MARKETS.has(item.market_key))return false;
  try{
    const u=new URL(item.source_url),d=SOURCES[item.source];
    if(u.protocol!=="https:"||(u.hostname!==d&&!u.hostname.endsWith("."+d)))return false;
    const t=Date.parse(item.captured_at);
    if(!Number.isFinite(t))return false;
    const d0=Date.parse(day+"T00:00:00Z"),delta=t-d0;
    return delta>=-2*86400000&&delta<2*86400000;
  }catch{return false}
}
const MARKETS=new Set(["home_win","away_win","home_or_draw","away_or_draw","over_1_5","over_2_5","under_2_5","under_3_5","under_4_5","btts_yes","btts_no","home_goal","away_goal"]);
const stat=(items,test)=>items.filter(test).length;
const rate=(arr,key)=>arr.reduce((s,x)=>s+Number(x[key]||0),0)/arr.length;
export const trend=(key,home,away)=>{
 const total=x=>Number(x.gf||0)+Number(x.ga||0);
 switch(key){
 case "home_win":return [x=>x.result==="W",x=>x.result==="L"];
 case "away_win":return [x=>x.result==="L",x=>x.result==="W"];
 case "home_or_draw":return [x=>x.result!=="L",x=>x.result!=="W"];
 case "away_or_draw":return [x=>x.result!=="W",x=>x.result!=="L"];
 case "over_1_5":return [x=>total(x)>=2,x=>total(x)>=2];
 case "over_2_5":return [x=>total(x)>=3,x=>total(x)>=3];
 case "under_2_5":return [x=>total(x)<=2,x=>total(x)<=2];
 case "under_3_5":return [x=>total(x)<=3,x=>total(x)<=3];
 case "under_4_5":return [x=>total(x)<=4,x=>total(x)<=4];
 case "btts_yes":return [x=>x.gf>0&&x.ga>0,x=>x.gf>0&&x.ga>0];
 case "btts_no":return [x=>x.gf===0||x.ga===0,x=>x.gf===0||x.ga===0];
 case "home_goal":return [x=>x.gf>0,x=>x.ga>0];
 case "away_goal":return [x=>x.ga>0,x=>x.gf>0];
 default:return null;
 }
};
export function compareDraft(board,research,evidence=[]){
 if(!board||!research||board.date!==research.date||!Array.isArray(board.games)||!Array.isArray(research.fixtures))throw Error("Daily draft / research date or coverage mismatch");
 const fixtures=new Map(research.fixtures.map(x=>[String(x.id),x]));
 const known=new Set(fixtures.keys()),votes=new Map(),accepted=[];
 for(const e of evidence){
  if(!authorised(e,board.date,known))continue;
  const id=String(e.match_id)+"|"+e.market_key,group=votes.get(id)||new Map();
  if(!group.has(e.source))group.set(e.source,e);
  votes.set(id,group);accepted.push(e);
 }
 let compared=0,withChecks=0,insufficient=0;
 for(const g of board.games){
  const f=fixtures.get(String(g.id));if(!f){insufficient++;continue}
  const H=(f.last10?.home||[]).slice(0,10),A=(f.last10?.away||[]).slice(0,10);
  if(H.length<5||A.length<5){insufficient++;continue}
  const models=[...(g.model?.rankedCandidates||[]),...(g.model?.candidates||[]),...(g.top3||[])];
  const seen=new Set(),options=[];let checks=0;
  for(const c of models){
   const label=String(c?.label||"");if(!label||seen.has(label))continue;
   seen.add(label);
   const key=normalizeKey(label,g);if(!key)continue;
   const tr=trend(key);if(!tr)continue;
   const full=H.length>=8&&A.length>=8;
   const msgs=(votes.get(String(g.id)+"|"+key)||new Map());
   const support=[...msgs.values()].filter(x=>x.stance==="support").length;
   const oppose=[...msgs.values()].filter(x=>x.stance==="oppose").length;
   checks+=msgs.size;
   const original=Number.isFinite(Number(c.confidenceRating))?Number(c.confidenceRating):null;
   // Ranking signals are research-strength indices, never calibrated win probabilities.
   const rating=original===null?null:Math.min(99,Math.max(0,Math.round(original+
      Math.min(3,support*1.25)-Math.min(5,oppose*2.5)-(full?0:3))));
   const [fh,fa]=tr,nH=stat(H,fh),nA=stat(A,fa);
   const HW=stat(H,x=>x.result==="W"),HD=stat(H,x=>x.result==="D"),HL=H.length-HW-HD;
   const AW=stat(A,x=>x.result==="W"),AD=stat(A,x=>x.result==="D"),AL=A.length-AW-AD;
   const stats=label+": "+nH+"/"+H.length+" "+g.home+" matches and "+nA+"/"+A.length+" "+g.away+" matches support this market. "+
     g.home+" last "+H.length+": "+HW+"W-"+HD+"D-"+HL+"L ("+rate(H,"gf").toFixed(1)+" GF, "+rate(H,"ga").toFixed(1)+" GA/game). "+
     g.away+" last "+A.length+": "+AW+"W-"+AD+"D-"+AL+"L ("+rate(A,"gf").toFixed(1)+" GF, "+rate(A,"ga").toFixed(1)+" GA/game). "+
     "Recent-five form: "+H.slice(0,5).map(x=>x.result).join("")+" / "+A.slice(0,5).map(x=>x.result).join("")+".";
   const conflicts=oppose? " Editorial review flags "+oppose+" conflicting opinion"+(oppose>1?"s":"")+".":"";
   const sampleNote=full?"":" Limited historical sample; research index reduced.";
   const note=" Picks are research estimates, not calibrated probabilities.";
   options.push({...c,rankMarketKey:key,family:family(key),confidenceRating:rating,
      sourceBackedReason:true,editorialSupport:support,editorialOppose:oppose,
      reason:stats+conflicts+sampleNote+note});
  }
  if(!options.length){insufficient++;continue}
  options.sort((a,b)=>(b.confidenceRating??-1)-(a.confidenceRating??-1)||
     b.editorialSupport-a.editorialSupport||a.label.localeCompare(b.label));
  // Compare only independent football theses. A match-total + team-1+
  // + BTTS cluster does not become three separate recommendations.
  const top=takeDistinctTopPicks(options,3);
  if(!top.length){insufficient++;continue}
  if(top.length<3)insufficient++; // Shortlist may legitimately contain 1 or 2.
  g.top3=top;g.top=top[0];g.model={...(g.model||{}),top:top[0],top3:top,
    rankedCandidates:options,candidates:options};
  g.editorialConsensus={checkedSources:[...new Set(accepted.filter(x=>String(x.match_id)===String(g.id)).map(x=>x.source))],
    marketChecks:checks,version:"source-consensus-v1"};
  if(checks)withChecks++;
  compared++;
 }
 const qualified=board.games.filter(g=>g.editorialConsensus?.version==="source-consensus-v1" &&
  Number.isFinite(g.top?.confidenceRating)&&g.top.confidenceRating>=85 &&
  (g.top.verifiedPrice!==true || Number(g.top.priceDecimal)>=1.2))
  .sort((a,b)=>b.top.confidenceRating-a.top.confidenceRating);
 const refs=(games)=>games.slice(0,5).map((g,i)=>({rank:i+1,gameId:String(g.id),home:g.home,away:g.away,pick:g.top}));
 if(compared>0){
  board.top5=refs(qualified);
  const leagues=[...new Set(board.games.map(g=>g.league))];
  board.leagueTop5=Object.fromEntries(leagues.map(l=>[l,refs(qualified.filter(g=>g.league===l))]));
 }
 board.sourceQuality={...(board.sourceQuality||{}),editorialConsensus:{
  version:"source-consensus-v1",matchesReviewed:compared,matchesWithLicensedEditorial:withChecks,
  unavailableOrInsufficient:insufficient,editorialEvidenceCount:accepted.length,
  missingSourcesAreNotAgreement:true,uncalibrated:true
 }};
 return board;
}
export async function readEvidence(day){
 const file=path.join("data","editorial-evidence",day+".json");
 let doc;
 if(fs.existsSync(file))doc=JSON.parse(fs.readFileSync(file,"utf8"));
 else if(process.env.FOOTYEDGE_RESEARCH_FEED_URL && process.env.FOOTYEDGE_RESEARCH_FEED_APPROVED==="1"){
  const u=new URL(process.env.FOOTYEDGE_RESEARCH_FEED_URL);
  if(u.protocol!=="https:"||Object.values(SOURCES).some(d=>u.hostname===d||u.hostname.endsWith("."+d)))
   throw Error("Only a separately authorised JSON feed is permitted");
  const headers={accept:"application/json"};
  if(process.env.FOOTYEDGE_RESEARCH_FEED_TOKEN)headers.authorization="Bearer "+process.env.FOOTYEDGE_RESEARCH_FEED_TOKEN;
  const response=await fetch(u,{headers,signal:AbortSignal.timeout(12000)});
  if(!response.ok||!response.headers.get("content-type")?.includes("application/json"))throw Error("Licensed research feed unavailable or not JSON");
  if(Number(response.headers.get("content-length")||0)>1000000)throw Error("Licensed research feed too large");
  const text=await response.text();if(text.length>1000000)throw Error("Licensed research feed too large");
  doc=JSON.parse(text);
 }else return [];
 if(doc?.date!==day||!Array.isArray(doc?.evidence))throw Error("Editorial evidence date/format mismatch");
 return doc.evidence;
}
async function main(){
 const parts=dayET(),day=process.env.BOARD_DATE||parts.year+"-"+parts.month+"-"+parts.day;
 if(fs.existsSync("data/boards/"+day+".json")){
  console.log("Immutable published board exists; skip editorial update",day);return;
 }
 const file="data/board-drafts/"+day+".json",base="data/research-base-"+day+".json";
 if(!fs.existsSync(file)||!fs.existsSync(base)){console.log("No complete fresh draft or research; skip");return}
 const board=JSON.parse(fs.readFileSync(file,"utf8")),research=JSON.parse(fs.readFileSync(base,"utf8"));
 const result=compareDraft(board,research,await readEvidence(day));
 if(result.sourceQuality.editorialConsensus.matchesReviewed===0){console.log("No source-backed candidates; draft unchanged");return}
 fs.writeFileSync(file,JSON.stringify(result,null,2)+"\n");
 console.log(JSON.stringify(result.sourceQuality.editorialConsensus));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
 main().catch(e=>{console.error(e);process.exitCode=1});
