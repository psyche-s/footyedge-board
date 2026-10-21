#!/usr/bin/env node
// FootyEdge daily slip desk: dated, deterministic suggestions, never sportsbook odds.
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
const dt=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));return p.year+"-"+p.month+"-"+p.day};
const norm=v=>String(v??"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const score=v=>Number.isFinite(Number(v))?Number(v):null;
const grade=v=>Math.max(0,Math.min(100,Math.round(v)));
const dateValid=(r,k)=>Number.isFinite(Date.parse(r?.date))&&Date.parse(r.date)<k&&Number.isInteger(r.gf)&&r.gf>=0&&Number.isInteger(r.ga)&&r.ga>=0;
const form=(f,side)=>(f?.last10?.[side]||[]).filter(r=>dateValid(r,Date.parse(f.date))).slice(0,10);
const name=(g,side)=>typeof g[side]==="string"?g[side]:g[side]?.name||g.teams?.[side]?.name||"";
const hits=(arr,fn)=>arr.filter(fn).length;
function market(p){
 const label=String(p.label||"").trim().toLowerCase().replace(/\s+/g," ");
 const m=label.match(/^(over|under) (\d+(?:\.\d+)?) goals$/);
 if(m)return{family:"total",dir:m[1],line:Number(m[2])};
 const n=label.match(/^(.+) ([123])\+ goals?$/);
 if(n)return{family:"team-goal",team:n[1],line:Number(n[2])};
 if(label.endsWith(" or draw"))return{family:"double-chance",team:label.slice(0,-8)};
 if(label.endsWith(" ml"))return{family:"winner",team:label.slice(0,-3)};
 if(label.includes("btts")||label.includes("both teams to score"))return{family:"btts",yes:!label.includes("no")};
 const cat=norm(p.category);
 if(["player","shots","shots on target","fouls","cards","corners","assists"].includes(cat))return{family:"player"};
 return null;
}
function trend(p,f,side,r){
 const m=market(p);if(!m)return null;
 const home=norm(f.home.name),away=norm(f.away.name);
 const gf=side==="home"?r.gf:r.ga,ga=side==="home"?r.ga:r.gf;
 if(m.family==="total")return m.dir==="over"?gf+ga>m.line:gf+ga<m.line;
 if(m.family==="team-goal")return m.team===home?gf>=m.line:m.team===away?ga>=m.line:null;
 if(m.family==="winner")return m.team===home?gf>ga:m.team===away?ga>gf:null;
 if(m.family==="double-chance")return m.team===home?gf>=ga:m.team===away?ga>=gf:null;
 if(m.family==="btts")return m.yes?(gf>0&&ga>0):!(gf>0&&ga>0);
 return null;
}
function h2hRows(f,items){
 const seen=new Set(),out=[],key=[norm(f.home.name),norm(f.away.name)].sort().join("|");
 for(const row of items||[]){
  if(!row?.date||Date.parse(row.date)>=Date.parse(f.date)||!Number.isFinite(Date.parse(row.date)))continue;
  if([norm(row.home),norm(row.away)].sort().join("|")!==key)continue;
  if(!Number.isInteger(row.homeScore)||!Number.isInteger(row.awayScore))continue;
  const id=String(row.id||row.date+"-"+key);if(seen.has(id))continue;seen.add(id);out.push(row);
 }
 return out.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,5);
}
function candidate(g,f,p,news,h2h){
 const m=market(p),orig=score(p.confidenceRating??p.score),H=form(f,"home"),A=form(f,"away");
 if(!m||orig==null||orig<=0||orig>100||H.length<8||A.length<8)return null;
 if(m.family==="player"){
  // Player/event props require player-specific observations and verified lines.
  if(p.verifiedMarket!==true||p.sourceVerified!==true||!p.line||p.expectedStart===false)return null;
 }
 const h=H.map(r=>trend(p,f,"home",r)),a=A.map(r=>trend(p,f,"away",r));
 const supported=[...h,...a].every(x=>typeof x==="boolean");
 if(!supported&&m.family!=="player")return null;
 const hr=supported?hits(h,Boolean)/h.length:null,ar=supported?hits(a,Boolean)/a.length:null;
 const five=supported?(hits(h.slice(0,5),Boolean)+hits(a.slice(0,5),Boolean))/10:null;
 const risk=[];
 let rating=grade(orig);
 if(supported){
  const blended=.72*(hr+ar)/2+.28*five;
  if(Math.min(hr,ar)<.55||blended<.66)return null;
  rating=Math.min(rating,grade(blended*78+orig*.22)+4);
  if(Math.min(hr,ar)<.7)risk.push("One team's trend is weaker");
  for(const [rows,target,side] of [[H,"home","home"],[A,"away","away"]]){
   const scoped=rows.filter(r=>r.venue===target);
   if(scoped.length>=3&&hits(scoped,r=>trend(p,f,side,r)===true)/scoped.length<.5){
    rating-=4;risk.push(side+" venue split weaker");
   }
  }
 }
 const previous=h2h.map(row=>{
  const direct=norm(row.home)===norm(f.home.name);
  return trend(p,f,"home",{gf:direct?row.homeScore:row.awayScore,ga:direct?row.awayScore:row.homeScore});
 }).filter(x=>typeof x==="boolean");
 const positive=hits(previous,Boolean);
 if(previous.length>=3&&positive/previous.length<.4){rating-=4;risk.push("Recent H2H opposes selection");}
 const absences=(news?.home?.out?.length||0)+(news?.away?.out?.length||0);
 if(absences>=3){rating-=4;risk.push("Multiple reported absences");}
 if(m.family==="player"&&!(news?.home?.predictedXI?.length&&news?.away?.predictedXI?.length)){rating-=5;risk.push("Starting role unverified");}
 rating=Math.min(95,grade(rating));if(rating<70)return null; // Never present a perfect-confidence sports selection.
 const common=H.length+" home and "+A.length+" away recent results screened.";
 const evidence=supported?String(hits(h,Boolean))+"/"+H.length+" of "+f.home.name+"'s matches and "+hits(a,Boolean)+"/"+A.length+" of "+f.away.name+"'s matches matched the researched angle.":String(p.reason||"");
 const h2hText=previous.length?" In "+positive+"/"+previous.length+" verified H2H results it occurred.":" No verified recent H2H were available.";
 return {gameId:String(g.id),fixture:f.home.name+" vs "+f.away.name,league:g.league,kickoff:g.date,
   label:p.label,category:p.category,family:m.family,rating,why:String(p.reason||evidence).replace(/These figures describe recent results, not a guaranteed outcome\./i,"").trim(),
   evidence:evidence+h2hText,source:"Published FootyEdge match pick · dated last-10 results",sample:{home:H.length,away:A.length},
   h2h:{checked:previous.length,supported:positive},lineupStatus:news?.home?.predictedXI?.length===11&&news?.away?.predictedXI?.length===11?"predicted-not-confirmed":"unverified",risk};
}
// Independent FootyEdge statistical shortlisting, separate from previews/top-three cards.
function researchCandidates(g,f,news,older){
 const H=form(f,"home"),A=form(f,"away");if(H.length<8||A.length<8)return[];
 const home=f.home.name,away=f.away.name;
 const angles=[
 [home+" ML","Match Result",x=>x.gf>x.ga,x=>x.gf<x.ga],
 [away+" ML","Match Result",x=>x.gf<x.ga,x=>x.gf>x.ga],
 [home+" or Draw","Double Chance",x=>x.gf>=x.ga,x=>x.gf<=x.ga],
 [away+" or Draw","Double Chance",x=>x.gf<=x.ga,x=>x.gf>=x.ga],
 ["Over 1.5 Goals","Goals",x=>x.gf+x.ga>=2,x=>x.gf+x.ga>=2],
 ["Over 2.5 Goals","Goals",x=>x.gf+x.ga>=3,x=>x.gf+x.ga>=3],
 ["Under 3.5 Goals","Goals",x=>x.gf+x.ga<=3,x=>x.gf+x.ga<=3],
 ["Under 4.5 Goals","Goals",x=>x.gf+x.ga<=4,x=>x.gf+x.ga<=4],
 ["BTTS Yes","BTTS",x=>x.gf>0&&x.ga>0,x=>x.gf>0&&x.ga>0],
 ["BTTS No","BTTS",x=>x.gf===0||x.ga===0,x=>x.gf===0||x.ga===0]
 ];
 return angles.flatMap(([label,category,fh,fa])=>{
  const a=hits(H,fh),b=hits(A,fa),fresh=hits(H.slice(0,5),fh)+hits(A.slice(0,5),fa);
  const strength=(a/H.length+b/A.length)/2,recent=fresh/10;
  if(strength<.70||Math.min(a/H.length,b/A.length)<.60||recent<.60)return[];
  const p={label,category,confidenceRating:Math.min(92,grade((.7*strength+.3*recent)*95+2)),
   reason:"Our "+label+" screen: "+a+"/"+H.length+" supporting "+home+" results and "+b+"/"+A.length+
   " supporting "+away+" results; "+fresh+"/10 across their most recent five games."};
  const leg=candidate(g,f,p,news,older);
  return leg?[{...leg,source:"FootyEdge independent last-10 matchup analysis",modelBuilt:true}]:[];
 });
}
function compatible(a,b){
 if(a.gameId!==b.gameId)return true;
 if(norm(a.label)===norm(b.label))return false;
 const A=market(a),B=market(b);if(!A||!B)return false;
 if(A.family==="total"&&B.family==="total")return false;
 if(A.family==="team-goal"&&B.family==="total"||A.family==="total"&&B.family==="team-goal")return false;
 // Two "team 1+" picks just restate BTTS Yes, rather than two distinct markets.
 if(A.family==="team-goal"&&B.family==="team-goal")return false;
 if(A.family==="btts"||B.family==="btts"){
   const other=A.family==="btts"?B:A;
   return !["total","team-goal","btts"].includes(other.family);
 }
 if(A.family==="winner"&&B.family==="winner")return false;
 if(A.family==="double-chance"&&B.family==="double-chance")return false;
 if(A.family==="winner"&&B.family==="double-chance"||B.family==="winner"&&A.family==="double-chance")return false;
 if(A.family==="winner"&&B.family==="team-goal"&&A.team===B.team)return false;
 if(B.family==="winner"&&A.family==="team-goal"&&A.team===B.team)return false;
 if(A.family==="double-chance"&&B.family==="team-goal"&&A.team===B.team)return false;
 if(B.family==="double-chance"&&A.family==="team-goal"&&A.team===B.team)return false;
 // Do not implicitly claim unrelated player-event markets are combinable.
 if(A.family==="player"&&B.family==="player")return false;
 return true;
}
function correlation(a,b){
 const aF=a.family,bF=b.family;
 if(aF==="total"&&bF==="team-goal"||bF==="total"&&aF==="team-goal")return 5;
 if(aF==="winner"&&bF==="team-goal"||bF==="winner"&&aF==="team-goal")return 6;
 if(aF==="team-goal"&&bF==="team-goal")return 4;
 if(aF==="double-chance"&&bF==="team-goal"||bF==="double-chance"&&aF==="team-goal")return 3;
 return 1;
}
// SGP/ACCA are the marquee competitions only. J1, K League 1, Saudi
// Pro League, Czech and friendly slates remain on Fixtures, not on the slips.
const MAJOR_SLIP_LEAGUES=new Set([
 "eng.1","eng.2","esp.1","ita.1","ger.1","fra.1","ned.1","por.1","tur.1",
 "uefa.champions","uefa.europa","uefa.europa.conf","uefa.nations","usa.1"
]);
function isMajor(league){return MAJOR_SLIP_LEAGUES.has(String(league||""));}
function overallRating(legs,isSameGame=false){
 if(!legs.length)return null;
 const minimum=Math.min(...legs.map(x=>Number(x.rating)||0));
 // Ranking heuristic, deliberately NOT a multi-leg winning probability.
 return Math.max(0,Math.min(95,Math.round(minimum-3*Math.max(0,legs.length-1)-(isSameGame?2:0))));
}
function sgp(all){
 const groups=new Map();
 for(const x of all.filter(v=>isMajor(v.league))){if(!groups.has(x.gameId))groups.set(x.gameId,[]);groups.get(x.gameId).push(x);}
 const choices=[];
 for(const [id,group] of groups){
  const eligible=group.filter(x=>x.rating>=73).sort((a,b)=>b.rating-a.rating||a.label.localeCompare(b.label)).slice(0,11);
  let best=null;
  for(let mask=1;mask<2**eligible.length;mask++){
   const legs=eligible.filter((_,i)=>mask&(1<<i));
   if(legs.length<2||legs.length>5||legs.some((x,i)=>legs.slice(i+1).some(y=>!compatible(x,y))))continue;
   let overlap=0;for(let i=0;i<legs.length;i++)for(let j=i+1;j<legs.length;j++)overlap+=correlation(legs[i],legs[j]);
   const weakest=Math.min(...legs.map(x=>x.rating)),avg=legs.reduce((n,x)=>n+x.rating,0)/legs.length;
   const fitness=.68*weakest+.32*avg+Math.min(4,legs.length)*1.8-overlap-legs.reduce((n,x)=>n+x.risk.length,0);
   if(!best||fitness>best.fitness)best={fitness,legs,id,overlap};
  }
  if(best)choices.push(best);
 }
 choices.sort((a,b)=>b.fitness-a.fitness||a.id.localeCompare(b.id));
 const best=choices[0];
 return best?{status:"qualified",format:"Best same-game parlay",overallResearchRating:overallRating(best.legs,true),legs:best.legs.sort((a,b)=>b.rating-a.rating),
  caution:best.legs.length===2?"Two strong, compatible legs qualified. A third leg was not forced; recheck starting XIs and exact market availability.":best.overlap>5?"Some legs positively overlap; avoid treating the selection grades as an independent combination probability.":"Check confirmed lineups and availability of exact markets before placement."}:
 {status:"pass",format:"Same-game parlay",legs:[],caution:"No fixture has two compatible, sufficiently supported selections. Passing rather than forcing a slip."};
}
function acca(all){
 const sorted=all.filter(x=>isMajor(x.league)&&x.rating>=79).sort((a,b)=>b.rating-a.rating||a.gameId.localeCompare(b.gameId));
 const used=new Set(),categories=new Map(),leagues=new Map(),legs=[];
 while(legs.length<5){
  let choice=null,best=-Infinity;
  for(const x of sorted){
   if(used.has(x.gameId)||(categories.get(x.family)||0)>=2)continue;
   const fitness=x.rating-(categories.get(x.family)||0)*5-(leagues.get(x.league)||0)*2-x.risk.length;
   if(fitness>best){best=fitness;choice=x;}
  }
  if(!choice)break;
  legs.push(choice);used.add(choice.gameId);categories.set(choice.family,(categories.get(choice.family)||0)+1);
  leagues.set(choice.league,(leagues.get(choice.league)||0)+1);
 }
 return legs.length>=4?{status:"qualified",format:"Cross-game accumulator",overallResearchRating:overallRating(legs),legs,
  caution:"One leg per match; market types diversified. Weakest evidence rating "+Math.min(...legs.map(x=>x.rating))+"%. Accumulator risk compounds."}:
 {status:"pass",format:"Cross-game accumulator",legs:[],caution:"Fewer than four strong, diverse fixtures qualify."};
}
function sgpsByLeague(items){
 const groups=new Map();
 for(const leg of items||[])if(isMajor(leg.league)){
  if(!groups.has(leg.league))groups.set(leg.league,[]);
  groups.get(leg.league).push(leg);
 }
 return [...groups].map(([league,picks])=>({league,...sgp(picks)}))
  .filter(x=>x.status==="qualified")
  .sort((a,b)=>(b.overallResearchRating||0)-(a.overallResearchRating||0)||a.league.localeCompare(b.league));
}
function build({date,board,research,h2h,intel}){
 if(board?.date!==date||research?.date!==date)throw Error("Matching dated match board and research required");
 const map=new Map((research.fixtures||[]).map(f=>[String(f.id),f]));
 const named=new Map((research.fixtures||[]).map(f=>[[norm(f.home.name),norm(f.away.name)].join("|"),f]));
 const previous=new Map((h2h?.fixtures||[]).map(x=>[String(x.fixtureId),x.h2h||[]]));
 const news=new Map((intel?.fixtures||[]).map(x=>[String(x.fixtureId),x]));
 const all=[];
 for(const g of board.games||[]){
  if(!g?.id||/women|female/i.test(String(g.leagueName||"")))continue;
  const f=map.get(String(g.id))||named.get([norm(name(g,"home")),norm(name(g,"away"))].join("|"));
  if(!f)continue;
  const older=h2hRows(f,previous.get(String(f.id))||g.h2h||[]);
  const own=researchCandidates(g,f,news.get(String(f.id)),older);
  const old=[],seen=new Set();
  for(const p of g.top3||[]){
   const label=norm(p?.label);if(!label||seen.has(label))continue;seen.add(label);
   const leg=candidate(g,f,p,news.get(String(f.id)),older);
   if(leg)old.push(leg);
  }
  const labels=new Set(own.map(x=>norm(x.label)));
  all.push(...own,...old.filter(x=>!labels.has(norm(x.label))));
 }
 const props=all.filter(x=>["total","team-goal","btts","player"].includes(x.family)).sort((a,b)=>b.rating-a.rating||a.gameId.localeCompare(b.gameId)).slice(0,10);
 return {schema:"footyedge-daily-slips-v1",date,state:board.immutable===true?"frozen":"preview",generatedAt:new Date().toISOString(),
   boardSource:board.immutable===true?"official frozen picks":"pre-match pick preview",
   sample:{fixtures:research.fixtures.length,screenedLegs:all.length,newsFixtures:news.size,h2hFixtures:previous.size},
   noSportsbookOdds:true,confidenceCalibrated:false,originalMatchBoardsUnchanged:true,
   method:"10-match base plus weighted last-five, home/away checks, source-backed H2H, known availability, compatible markets",
   eligibleSlipLegs:all.filter(x=>isMajor(x.league)).sort((a,b)=>b.rating-a.rating),
   excludedSlipLeagues:["jpn.1","kor.1","ksa.1"],majorLeagueRule:true,
   sgp:sgp(all),acca:acca(all),sgpsByLeague:sgpsByLeague(all),props,notes:[
    "Selection percentages are evidence grades, not calibrated probabilities or a combined parlay chance.",
    "No sportsbook odds, payout, implied probabilities or EV. Market availability must be checked separately.",
    "No invented cards, corners, shots, fouls, player starts or other unsupported props.",
    "Fewer supported legs are better than artificially lengthening a ticket.",
    "Review official XI, suspensions and late injury news before using a selection.",
    "Parlay selections require verified historical research; exact market availability and live prices must be checked separately."
   ]};
}
export{market,trend,compatible,sgp,acca,build,overallRating,sgpsByLeague};
const read=async file=>fs.readFile(file,"utf8").then(JSON.parse).catch(e=>{if(e.code==="ENOENT")return null;throw e});
async function main(){
 const date=process.env.SLIP_DATE||dt();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Bad date");
 const out=path.join("data","slips",date+".json");
 const old=await read(out);
 if(old?.state==="frozen"&&process.env.REBUILD_DAILY_SLIPS!=="1"){console.log("Existing frozen slips retained",date);return;}
 const [official,draft,research,h2h,intel]=await Promise.all([
  read(path.join("data","boards",date+".json")),read(path.join("data","board-drafts",date+".json")),
  read(path.join("data","research-base-"+date+".json")),read(path.join("data","h2h",date+".json")),
  read(path.join("data","team-intelligence",date+".json"))
 ]);
 const board=official?.date===date?official:draft?.date===date?draft:null;
 if(!board||!research){console.log("No board and research yet, passing",date);return;}
 const desk=build({date,board,research,h2h,intel});
 await fs.mkdir(path.dirname(out),{recursive:true});
 await fs.writeFile(out,JSON.stringify(desk,null,2)+"\n");
 console.log(JSON.stringify({date,state:desk.state,sgp:desk.sgp.legs.map(x=>x.label),acca:desk.acca.legs.map(x=>x.label),props:desk.props.length,screened:desk.sample.screenedLegs}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e);process.exitCode=1});
