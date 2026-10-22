#!/usr/bin/env node
/**
 * Original FootyEdge: match-research fallback for the sole nightly publisher.
 * Reads only the exact-date validated research fixture history and optional,
 * internally documented previews/lineup intel. No scraping, odds estimates,
 * expected value, fabricated player events, or public source links.
 *
 * This is a research-grade shortlist, NOT calibrated match win probabilities.
 * Missing source previews do not cause an otherwise strong recent-form screen
 * to disappear; those selections carry a stricter confidence ceiling.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

const toronto=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(v=>[v.type,v.value]));return p.year+"-"+p.month+"-"+p.day;};
const get=async file=>fs.readFile(file,"utf8").then(JSON.parse).catch(e=>{if(e.code==="ENOENT")return null;throw e});
const normalized=v=>String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const count=(rows,fn)=>rows.filter(fn).length;
const markets=[
 ["home_win","Match Result","result",(h,a)=>h+" ML",r=>r.gf>r.ga,r=>r.gf<r.ga],
 ["away_win","Match Result","result",(h,a)=>a+" ML",r=>r.gf<r.ga,r=>r.gf>r.ga],
 ["home_or_draw","Double Chance","result",(h,a)=>h+" or Draw",r=>r.gf>=r.ga,r=>r.gf<=r.ga],
 ["away_or_draw","Double Chance","result",(h,a)=>a+" or Draw",r=>r.gf<=r.ga,r=>r.gf>=r.ga],
 ["over_1_5","Goals","total",()=>"Over 1.5 Goals",r=>r.gf+r.ga>=2,r=>r.gf+r.ga>=2],
 ["over_2_5","Goals","total",()=>"Over 2.5 Goals",r=>r.gf+r.ga>=3,r=>r.gf+r.ga>=3],
 ["under_3_5","Goals","total",()=>"Under 3.5 Goals",r=>r.gf+r.ga<=3,r=>r.gf+r.ga<=3],
 ["under_4_5","Goals","total",()=>"Under 4.5 Goals",r=>r.gf+r.ga<=4,r=>r.gf+r.ga<=4],
 ["btts_yes","BTTS","btts",()=>"BTTS Yes",r=>r.gf>0&&r.ga>0,r=>r.gf>0&&r.ga>0],
 ["btts_no","BTTS","btts",()=>"BTTS No",r=>r.gf===0||r.ga===0,r=>r.gf===0||r.ga===0],
 ["home_goal","Team Goals","team-goal",(h)=>h+" 1+ Goal",r=>r.gf>0,r=>r.ga>0],
 ["away_goal","Team Goals","team-goal",(_h,a)=>a+" 1+ Goal",r=>r.ga>0,r=>r.gf>0]
];
const reviewAlias={home_win:["home_win","home_ml"],away_win:["away_win","away_ml"],home_or_draw:["home_or_draw","home_ml"],away_or_draw:["away_or_draw","away_ml"]};
const host=url=>String(url||"").match(/^https:\/\/([^/]+)(?:\/|$)/i)?.[1]?.toLowerCase()||"";
export function independent(a,b){
 if(a.family===b.family||a.label===b.label)return false;
 if(a.family==="team-goal"&&["total","btts"].includes(b.family)||b.family==="team-goal"&&["total","btts"].includes(a.family))return false;
 if(a.key==="btts_yes"&&b.key==="over_1_5"||b.key==="btts_yes"&&a.key==="over_1_5")return false;
 if(a.family==="result"&&b.family==="team-goal"&&b.label.startsWith(a.label.replace(/( ML| or Draw)$/,"")+" "))return false;
 if(b.family==="result"&&a.family==="team-goal"&&a.label.startsWith(b.label.replace(/( ML| or Draw)$/,"")+" "))return false;
 return true;
}
export function chooseResearch(f,review,news,date){
 const kickoff=Date.parse(f.date);
 const valid=r=>r&&Number.isInteger(r.gf)&&Number.isInteger(r.ga)&&Date.parse(r.date)<kickoff&&Date.parse(r.date)<Date.parse(date+"T23:59:59Z");
 const H=(f.last10?.home||[]).filter(valid).slice(0,10),A=(f.last10?.away||[]).filter(valid).slice(0,10);
 if(H.length<7||A.length<7)return[];
 const home=String(f.home?.name||""),away=String(f.away?.name||"");
 const signals=review?.signals||[];
 const options=[];
 for(const [key,category,family,label,fh,fa] of markets){
  const h=count(H,fh),a=count(A,fa),recent=count(H.slice(0,5),fh)+count(A.slice(0,5),fa);
  const avg=(h/H.length+a/A.length)/2,r5=recent/Math.min(10,H.length+A.length);
  const supported=[key,...(reviewAlias[key]||[])];
  const checked=[...new Set(signals.filter(s=>supported.includes(s.market)&&host(s.url)).map(s=>host(s.url)))].length;
  if(avg<(checked?.47:.66)||r5<(checked?.35:.55)||Math.min(h/H.length,a/A.length)<(checked?.25:.5))continue;
  const HV=H.filter(x=>x.venue==="home"),AV=A.filter(x=>x.venue==="away");
  const venue=HV.length>=3&&AV.length>=3?(count(HV,fh)/HV.length+count(AV,fa)/AV.length)/2:avg;
  let grade=Math.round(39*avg+28*r5+20*venue+4*Math.min(2,checked));
  grade=Math.min(checked?91:78,Math.max(0,grade));
  if(grade<(checked?58:65))continue;
  const fact=String(h)+"/"+H.length+" "+home+" games and "+a+"/"+A.length+" "+away+" games support this line; "+recent+"/10 in their most recent five apiece.";
  options.push({key,label:label(home,away),category,family,confidenceRating:grade,score:null,odds:null,ev:null,probabilityCalibrated:false,
    confidenceType:"research_strength_not_probability",sourceBackedReason:true,verifiedPrice:false,reviewCount:checked,
    reason:fact,priceStatus:"not_verified"});
 }
 // Audited player-event markets require dated, per-player logs, a specific exact
 // line, and a projected start. A preview alone cannot create a "safe" prop.
 for(const player of f.playerPropResearch||[]){
  if(!player?.verifiedExactMarket||!player?.verifiedPlayerLog||!Number.isInteger(player?.hitCount)||!Number.isInteger(player?.sample)||player.sample<5||player.hitCount<4||!player.label)continue;
  if(!["shots","shots on target","fouls committed","fouls won","cards","corners"].includes(String(player.category||"").toLowerCase()))continue;
  const xi=[...(news?.home?.predictedXI||[]),...(news?.away?.predictedXI||[])].map(normalized);
  if(!xi.includes(normalized(player.player)))continue;
  options.push({key:"player_"+normalized(player.player)+"_"+normalized(player.label),label:player.label,category:player.category,family:"player",
   confidenceRating:Math.min(83,Math.round(50+30*player.hitCount/player.sample)),score:null,odds:null,ev:null,probabilityCalibrated:false,
   confidenceType:"research_strength_not_probability",sourceBackedReason:true,verifiedPrice:false,reviewCount:1,
   reason:player.hitCount+"/"+player.sample+" last recorded appearances met this line. Projected to start, pending official XI confirmation."});
 }
 options.sort((a,b)=>b.confidenceRating-a.confidenceRating||b.reviewCount-a.reviewCount||a.label.localeCompare(b.label));
 const picked=[];
 for(const p of options){if(picked.every(q=>independent(q,p)))picked.push({...p,rank:picked.length+1});if(picked.length===3)break;}
 return picked;
}
const ticket=(g,p)=>({gameId:String(g.id),fixture:g.home+" vs "+g.away,league:g.league,kickoff:g.date,label:p.label,category:p.category,family:p.family,rating:p.confidenceRating,why:p.reason,verifiedPrice:false,odds:null,risk:[]});
function slips(games){
 const majors=games.filter(g=>!["jpn.1","kor.1"].includes(g.league)); // no asian SGP/ACCA
 const byLeague=new Map();
 for(const g of majors){
  if(g.top3.length!==3||!g.top3.every(x=>x.confidenceRating>=66))continue;
  if(!g.top3.every((p,i)=>g.top3.slice(i+1).every(q=>independent(p,q))))continue;
  const min=Math.min(...g.top3.map(x=>x.confidenceRating));
  const prev=byLeague.get(g.league);
  if(!prev||min>prev.min)byLeague.set(g.league,{g,min});
 }
 const sgpsByLeague=[...byLeague.entries()].map(([league,{g,min}])=>({league,status:"qualified",format:"League same-game parlay",
  legs:g.top3.map(p=>ticket(g,p)),overallResearchRating:Math.max(0,min-8),
  caution:"Three compatible researched markets; verify exact sportsbook lines and confirmed XI."}));
 const best=sgpsByLeague.slice().sort((a,b)=>b.overallResearchRating-a.overallResearchRating)[0];
 const sgp=best?{status:"qualified",format:"Best same-game parlay",legs:best.legs,overallResearchRating:best.overallResearchRating,caution:best.caution}
  :{status:"pass",format:"Same-game parlay",legs:[],caution:"No three compatible high-confidence markets qualify; no forced SGP."};
 const sorted=majors.filter(g=>g.top&&g.top.confidenceRating>=72).sort((a,b)=>b.top.confidenceRating-a.top.confidenceRating);
 const legs=[],usedFamily=new Map();
 for(const g of sorted){if((usedFamily.get(g.top.family)||0)>=3)continue;legs.push(ticket(g,g.top));usedFamily.set(g.top.family,(usedFamily.get(g.top.family)||0)+1);if(legs.length===7)break;}
 const acca=legs.length>=4?{status:"qualified",format:"Cross-game parlay",legs,
    overallResearchRating:Math.max(0,Math.min(...legs.map(x=>x.rating))-3*(legs.length-1)),
    caution:"Each leg uses a distinct fixture; grade is not the combined success probability."}
   :{status:"pass",format:"Cross-game parlay",legs:[],caution:"Fewer than four distinct strong matches."};
 const props=games.flatMap(g=>g.top3.filter(p=>["shots","shots on target","fouls","fouls committed","fouls won","cards","corners"].includes(String(p.category).toLowerCase())).map(p=>ticket(g,p)))
  .sort((a,b)=>b.rating-a.rating).slice(0,10);
 return{sgp,acca,sgpsByLeague,props};
}
export function produce({date,board,research,notes=null,news=null}){
 if(board?.date!==date||research?.date!==date||!Array.isArray(board.games)||!Array.isArray(research.fixtures))throw Error("Same-day draft and history required");
 const byId=new Map(research.fixtures.map(f=>[String(f.id),f]));
 const n=new Map((notes?.date===date?notes.notes:[]||[]).map(x=>[String(x.fixtureId),x]));
 const ni=new Map((news?.date===date?news.fixtures:[]||[]).map(x=>[String(x.fixtureId),x]));
 const edited=structuredClone(board),matches=[];
 for(const g of edited.games){
  const f=byId.get(String(g.id));
  const ok=f&&normalized(g.home)===normalized(f.home.name)&&normalized(g.away)===normalized(f.away.name);
  const picks=ok?chooseResearch(f,n.get(String(g.id)),ni.get(String(g.id)),date):[];
  g.top3=picks;g.top=picks[0]||null;g.model={...(g.model||{}),top:g.top,top3:picks,candidates:picks,rankedCandidates:picks};
  g.recoveryStatus=picks.length?"source-screened-football-form":"pass-insufficient-match-evidence";
  if(picks.length)matches.push({gameId:String(g.id),home:g.home,away:g.away,league:g.league,kickoff:g.date,reviewed:true,
    reviewMethod:n.has(String(g.id))?"public-preview-crosschecked":"verified-statistics-only",picks});
 }
 const strong=edited.games.filter(g=>g.top&&g.top.confidenceRating>=72).sort((a,b)=>b.top.confidenceRating-a.top.confidenceRating||a.id.localeCompare(b.id));
 const refs=xs=>xs.slice(0,5).map((g,i)=>({rank:i+1,gameId:String(g.id),home:g.home,away:g.away,pick:g.top}));
 edited.top5=refs(strong);
 edited.leagueTop5=Object.fromEntries([...new Set(edited.games.map(g=>g.league))].map(l=>[l,refs(strong.filter(g=>g.league===l))]));
 edited.sourceQuality={...(edited.sourceQuality||{}),researchFallback:{version:"research-shortlist-v1",historicalSampleOnly:!notes?.notes?.length,
    reviewedMatches:matches.length,previewCrosschecks:n.size,calibratedProbability:false}};
 const desk={schema:"footyedge-editorial-desk-v1",date,state:matches.length?"reviewed":"pass",researchGradeNotProbability:true,
  noSportsbookOdds:true,confidenceCalibrated:false,originalMatchBoardsUnchanged:true,
  checkedMarkets:["Match Result","Double Chance","Goals","BTTS","Team Goals","Player/Event props when verified"],
  fixturesConsidered:board.games.length,licensedEvidenceItems:0,matches,...slips(edited.games),
  notes:["Dated fixture form and independent preview observations are screened together.","No invented player events or sportsbook prices.",
    "Only historical rates are reported; ratings are research-strength indices, not calibrated probabilities."]};
 return{board:edited,desk};
}
async function main(){
 const date=process.env.RESEARCH_DATE||toronto();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Invalid date");
 if(await get("data/boards/"+date+".json")){console.log("Official archive exists: preserving locked board.");return;}
 const draft="data/board-drafts/"+date+".json",deskFile="data/editorial-desk/"+date+".json";
 const [board,research,notes,news]=await Promise.all([get(draft),get("data/research-base-"+date+".json"),get("data/preview-observations/"+date+".json"),get("data/team-intelligence/"+date+".json")]);
 if(!board||!research){console.warn("Exact-date research unavailable; no guesses written.");return;}
 const out=produce({date,board,research,notes,news});
 await fs.mkdir(path.dirname(deskFile),{recursive:true});
 await fs.writeFile(draft,JSON.stringify(out.board,null,2)+"\n");
 await fs.writeFile(deskFile,JSON.stringify(out.desk,null,2)+"\n");
 console.log(JSON.stringify({date,fixtures:out.board.games.length,top3:out.board.games.filter(g=>g.top3.length===3).length,
  reviewed:out.desk.matches.length,top5:out.board.top5.length,sgp:out.desk.sgp.status,acca:out.desk.acca.status}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e);process.exitCode=1});
