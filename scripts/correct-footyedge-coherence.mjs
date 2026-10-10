import fs from "node:fs";
import path from "node:path";
import {sha256,validateBoard,validateIntegrity} from "./validate-published-boards.mjs";

const DATE="2026-10-10";
const FILE="data/boards/"+DATE+".json";
const REV="data/board-revisions/"+DATE;
const PERF="data/performance/"+DATE+".json";
const MARKER=path.join(REV,"coherence-repair-report.json");
if(fs.existsSync(MARKER)){console.log("Oct 10 coherence correction already published; no rewrite.");process.exit(0)}
const before=fs.readFileSync(FILE,"utf8");
const board=JSON.parse(before);
const perfBefore=fs.readFileSync(PERF,"utf8");
const performance=JSON.parse(perfBefore);
const original=JSON.parse(fs.readFileSync(path.join(REV,"before-github-static-repair.json"),"utf8"));
if(board.date!==DATE||board.games.length!==66)throw new Error("Unexpected frozen board: refuse correction");
const originalThree=new Set((original.top5||[]).map(x=>String(x.gameId)));
const round=x=>Math.round(x*100)/100;
const pct=x=>Math.round(Math.max(0,Math.min(1,x))*100);
const n=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
function family(p){
 const label=n(p.label),cat=n(p.category);
 if(cat==="match result"||/\bml$/.test(label)||label==="draw")return"result:1x2";
 if(cat==="goals"||/\b(over|under)\s*\d+(?:\s+\d+)?\s*goals?\b/.test(label))return"total:goals";
 if(cat==="btts"||label.includes("both teams to score"))return"btts";
 if(cat==="double chance")return"result:doublechance";
 return cat+":"+label;
}
function isPriced(p){
 const v=Number(p?.odds);
 return p&&p.verifiedPrice&&p.bookExact&&p.bookKey&&Number.isFinite(v)&&v!==0&&v>=-500&&Number(p.priceDecimal)>=1.2;
}
function outcome(p,g){
 const l=n(p.label),hn=n(g.home),an=n(g.away);
 if(l==="draw")return"draw";
 if(l===hn+" ml")return"home";
 if(l===an+" ml")return"away";
 return null;
}
function goals(p){
 const match=String(p.label||"").match(/\b(Over|Under)\s+(\d+(?:\.\d+)?)\s+Goals/i);
 return match?{side:match[1].toLowerCase(),line:Number(match[2])}:null;
}
function h2hFacts(g){
 const rows=Array.isArray(g.h2h)?g.h2h.filter(x=>x.homeScore!=null&&x.awayScore!=null):[];
 const home=n(g.home),away=n(g.away),valid=rows.filter(x=>{
  const h=n(x.home),a=n(x.away);
  return (h===home&&a===away)||(h===away&&a===home);
 });
 const homeW=valid.filter(x=>(n(x.home)===home?Number(x.homeScore)>Number(x.awayScore):Number(x.awayScore)>Number(x.homeScore))).length;
 const awayW=valid.filter(x=>(n(x.home)===away?Number(x.homeScore)>Number(x.awayScore):Number(x.awayScore)>Number(x.homeScore))).length;
 const draws=valid.filter(x=>Number(x.homeScore)===Number(x.awayScore)).length;
 return{count:valid.length,homeW,awayW,draws,rows:valid};
}
function formStats(g){
 const h=g.model?.home,a=g.model?.away;
 const ok=x=>x&&Number(x.n)>=5&&Number.isInteger(Number(x.wins))&&Number.isInteger(Number(x.losses))&&
  /^[WDL]( [WDL]){4}$/.test(String(x.form||""));
 return ok(h)&&ok(a)?{h,a}:null;
}
function trend(p,g,stats){
 const side=outcome(p,g),{h,a}=stats;
 if(side==="home")return(h.win+a.loss)/2;
 if(side==="away")return(a.win+h.loss)/2;
 if(side==="draw")return(h.draw+a.draw)/2;
 const total=goals(p);
 if(total){
  const key=total.side+(String(total.line).replace(".",""));
  if(Number.isFinite(h[key])&&Number.isFinite(a[key]))return(h[key]+a[key])/2;
 }
 return null;
}
function commentary(p,g,s){
 const {h,a}=s,which=outcome(p,g),total=goals(p),hh=h2hFacts(g),facts=[];
 if(which==="home"||which==="away"){
  const selected=which==="home"?{name:g.home,s:h}:{name:g.away,s:a};
  const opponent=which==="home"?{name:g.away,s:a}:{name:g.home,s:h};
  facts.push(selected.name+" won "+selected.s.wins+" of its last "+selected.s.n+" verified games; "+opponent.name+" lost "+opponent.s.losses+" of "+opponent.s.n+".");
  facts.push("Recent goal averages: "+selected.name+" "+round(selected.s.gf)+" scored / "+round(selected.s.ga)+" allowed; "+opponent.name+" "+round(opponent.s.gf)+" scored / "+round(opponent.s.ga)+" allowed per game.");
  if(hh.count)facts.push("Verified H2H: "+g.home+" "+hh.homeW+" wins, "+g.away+" "+hh.awayW+" wins and "+hh.draws+" draws across "+hh.count+" meetings.");
 }else if(which==="draw"){
  facts.push(g.home+" drew "+h.draws+"/"+h.n+" recent matches; "+g.away+" drew "+a.draws+"/"+a.n+".");
  facts.push("A draw remains uncertain: this is a five-game sample, not a calibrated prediction.");
  if(hh.count)facts.push("Their "+hh.count+" verified meetings contained "+hh.draws+" draws.");
 }else if(total){
  const key=total.side+String(total.line).replace(".","");
  const x=Math.round(h[key]*h.n),y=Math.round(a[key]*a.n);
  facts.push(g.home+" "+(total.side==="over"?"went over ":"stayed under ")+total.line+" in "+x+"/"+h.n+" recent matches; "+g.away+" did so in "+y+"/"+a.n+".");
  facts.push("Five-game goal averages: "+g.home+" "+round(h.gf+h.ga)+" total goals per match, "+g.away+" "+round(a.gf+a.ga)+".");
  if(hh.count){
   const hits=hh.rows.filter(x=>total.side==="over"?(Number(x.homeScore)+Number(x.awayScore)>total.line):(Number(x.homeScore)+Number(x.awayScore)<total.line)).length;
   facts.push("Verified H2H for this exact line: "+hits+"/"+hh.count+" games.");
  }
 }
 const quote=Number(p.odds)>0?"+"+Number(p.odds):String(Number(p.odds));
 facts.push("Saved "+(p.provider||"sportsbook")+" quote: "+quote+". Model uses a small last-five sample; it is not a verified last-ten probability.");
 return facts.slice(0,4);
}
let oldContradictions=0,updatedNarratives=0,passes=0,limited=0;
for(const g of board.games){
 const stats=formStats(g);
 if(!stats){
  g.top=null;g.top3=[];g.model={...(g.model||{}),top:null,top3:[],candidates:[],rankedCandidates:[],researchCandidates:[],bestAngle:null};
  g.recoveryStatus="Unverified form; no published recommendation";
  passes++;continue;
 }
 const pool=[...(g.top3||[]),...(g.model?.candidates||[]),...(g.model?.rankedCandidates||[])];
 const seen=new Map();
 for(const raw of pool){
  if(!isPriced(raw))continue;
  const k=n(raw.label);
  if(!k||seen.has(k))continue;
  const t=trend(raw,g,stats);
  if(!Number.isFinite(t))continue;
  const market=Number(raw.marketProb);
  if(!(market>0&&market<1))continue;
  const prob=.70*market+.30*t;
  const p={...raw,score:pct(prob),modelProb:prob,modelScore:pct(prob),
    stars:prob>=.92?"★★★★★":prob>=.88?"★★★★½":prob>=.83?"★★★★":prob>=.78?"★★★½":"★★★",
    ev:null,probabilityBasis:"70% no-vig market / 30% verified five-match trend; uncalibrated, not last-ten"};
  const facts=commentary(p,g,stats);
  p.reason=facts[0];p.archivedSupportFacts=facts;p.archivedCommentary=facts.join(" ");
  p.researchOnly=false;p.displayOnly=false;
  updatedNarratives++;
  seen.set(k,p);
 }
 const scored=[...seen.values()].sort((a,b)=>b.score-a.score||(b.marketProb||0)-(a.marketProb||0));
 const selected=[],families=new Set();
 for(const p of scored){
  if(p.score<60)continue;
  const f=family(p);
  if(families.has(f))continue;
  const t=trend(p,g,stats);
  if(Math.abs(Number(p.marketProb)-t)>.3&&p.score<70)continue;
  families.add(f);
  selected.push(p);
  if(selected.length>=3)break;
 }
 if(!selected.length)passes++;
 if(selected.length<3)limited++;
 for(const p of selected)if(goals(p)&&selected.some(q=>goals(q)&&goals(q).side!==goals(p).side))oldContradictions++;
 g.top3=selected;g.top=selected[0]||null;
 g.model={...(g.model||{}),top:g.top,top3:selected,candidates:selected,rankedCandidates:selected,researchCandidates:selected,bestAngle:g.top};
 if(!g.top)g.recoveryStatus="PASS — no independently supported priced angle";
 else g.recoveryStatus=null;
}
if(oldContradictions)throw new Error("Opposing totals still exist");
const refs=games=>games.map((g,i)=>({rank:i+1,gameId:g.id,home:g.home,away:g.away,pick:g.top}));
const premium=board.games.filter(g=>g.top&&g.top.score>=70).sort((a,b)=>b.top.score-a.top.score||(b.top.marketProb||0)-(a.top.marketProb||0));
board.top5=refs(premium.slice(0,5));
board.leagueTop5=Object.fromEntries([...new Set(board.games.map(g=>g.league).filter(Boolean))].map(l=>[l,refs(premium.filter(g=>g.league===l).slice(0,5))]));
board.correctedAt=new Date().toISOString();
board.coherenceCorrectedAt=board.correctedAt;
board.correctionReason="Owner-requested correction of contradictory Top 3 and false/misaligned write-ups: each saved recommendation is rebuilt from its actual five-match form and exact quoted market. Contradictory bets, unverified form and unsupported EV are removed. This revises the prior locked board with an append-only audit.";
board.source="FootyEdge GitHub-only audited owner correction (evidence-consistent picks)";
board.modelSampleWarning="Only five verified recent matches per team were available; model scores are uncalibrated estimates, not last-ten validated win probabilities.";
validateBoard(board,{requireFull:false});
const matchResults=new Map(board.games.map(g=>[String(g.id),g]));
const previous=new Map((performance.top5||[]).map(x=>[String(x.gameId||""),x]));
performance.top5=board.top5.map(t=>{
 const prev=previous.get(String(t.gameId))||{};
 return{...prev,rank:t.rank,gameId:t.gameId,home:t.home,away:t.away,fixture:t.home+" vs "+t.away,category:t.pick.category,selection:t.pick.label,confidence:t.pick.score,odds:t.pick.odds,book:t.pick.provider||"DraftKings",result:prev.result||"pending",finalScore:prev.finalScore??null};
});
performance.correctionNote="Audited coherence correction synced to revised published board; original published records are preserved in the correction backup.";
const after=JSON.stringify(board,null,2)+"\n",perfAfter=JSON.stringify(performance,null,2)+"\n";
fs.mkdirSync(REV,{recursive:true});
const boardBackup=path.join(REV,"before-coherence-repair-board.json"),perfBackup=path.join(REV,"before-coherence-repair-performance.json");
if(fs.existsSync(boardBackup)||fs.existsSync(perfBackup))throw new Error("Correction backups already exist; refusing overwrite");
fs.writeFileSync(boardBackup,before);fs.writeFileSync(perfBackup,perfBefore);
fs.writeFileSync(FILE,after);fs.writeFileSync(PERF,perfAfter);
const auditPath=path.join(REV,"audit.json");
const audits=fs.existsSync(auditPath)?JSON.parse(fs.readFileSync(auditPath,"utf8")):[];
audits.push({file:FILE,beforeSha256:sha256(before),afterSha256:sha256(after),owner:"Shaif",
 instruction:"Correct false form/H2H write-ups and mutually exclusive Top 3 picks directly in GitHub",correctedAt:board.correctedAt,backupPath:boardBackup});
fs.writeFileSync(auditPath,JSON.stringify(audits,null,2)+"\n");
validateIntegrity();
const contradict=board.games.filter(g=>(g.top3||[]).some(p=>goals(p)&&g.top3.some(q=>goals(q)&&goals(q).side!==goals(p).side)));
const opposingML=board.games.filter(g=>(g.top3||[]).filter(p=>family(p)==="result:1x2").length>1);
const badFacts=board.games.flatMap(g=>g.top3||[]).filter(p=>/0 of its last 0|\b0\/0\b/.test(p.archivedCommentary||""));
if(contradict.length||opposingML.length||badFacts.length)throw new Error("Coherence post-check failed");
const report={date:DATE,games:board.games.length,globalTop5:board.top5.length,
 globalPicks:board.top5.map(x=>({fixture:x.home+" vs "+x.away,label:x.pick.label,score:x.pick.score,odds:x.pick.odds})),
 withPicks:board.games.filter(g=>g.top3.length).length,withTwo:board.games.filter(g=>g.top3.length===2).length,
 withThree:board.games.filter(g=>g.top3.length===3).length,passes,limited,
 opposingTotals:contradict.length,opposingMatchWinners:opposingML.length,staleCommentary:badFacts.length,
 updatedNarratives,archivedFrozenPicksOriginally:originalThree.size,sample:"last five per team, uncalibrated"};
fs.writeFileSync(MARKER,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
