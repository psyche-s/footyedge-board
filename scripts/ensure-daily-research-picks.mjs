#!/usr/bin/env node
// FootyEdge owner-approved research-only recovery: three distinct markets and
// result alternatives for every dated men's fixture even if sportsbook quota=0.
// Never overwrite a published board or present research ratings as win chance.
import fs from "node:fs";
import {takeDistinctTopPicks} from "./market-diversity.mjs";
const local=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
const date=process.env.BOARD_DATE||local.year+"-"+local.month+"-"+local.day;
const boardFile="data/boards/"+date+".json",draftFile="data/board-drafts/"+date+".json";
const researchFile="data/research-base-"+date+".json",oddsFile="data/daily-odds-"+date+".json",modelFile="data/model-candidates/"+date+".json";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
if(fs.existsSync(boardFile)){console.log("Immutable published slate exists; no edits");process.exit(0);}
if(!fs.existsSync(draftFile)||!fs.existsSync(researchFile)||!fs.existsSync(oddsFile)){console.log("Research draft not ready");process.exit(0);}
const odds=read(oddsFile);
if(odds.status!=="blocked"&&Array.isArray(odds.events)&&odds.events.length){console.log("Verified sportsbook markets available; preserve original publication");process.exit(0);}
const base=read(researchFile),draft=read(draftFile);
const sh=fs.existsSync(modelFile)?read(modelFile):{fixtures:[]};
if(base.date!==date||draft.date!==date||!Array.isArray(base.fixtures)||!base.fixtures.length)throw Error("Dated slate mismatch");
const models=new Map((sh.fixtures||[]).map(x=>[String(x.fixtureId),x]));
const mapped=new Map(base.fixtures.map(x=>[String(x.id),x]));
const clip=(v,min,max)=>Math.max(min,Math.min(max,v));
const avg=(a,k)=>a.reduce((s,x)=>s+Number(x[k]||0),0)/a.length;
const pct=(a,f)=>a.filter(f).length/a.length;
function probs(H,A){
 const h=clip(.8*(.55*avg(H,"gf")+.45*avg(A,"ga"))*1.06+.26,.3,3.8),a=clip(.8*(.55*avg(A,"gf")+.45*avg(H,"ga"))*.96+.26,.3,3.8);
 const pm=(n,l)=>{let v=Math.exp(-l);for(let i=1;i<=n;i++)v*=l/i;return v};
 const p={home_win:0,away_win:0,draw:0,over_1_5:0,over_2_5:0,under_2_5:0,under_3_5:0,under_4_5:0,btts_yes:0,home_goal:0,away_goal:0};
 for(let i=0;i<=12;i++)for(let j=0;j<=12;j++){
  let v=pm(i,h)*pm(j,a);p[i>j?"home_win":i===j?"draw":"away_win"]+=v;
  if(i+j>=2)p.over_1_5+=v;if(i+j>=3)p.over_2_5+=v;if(i+j<=2)p.under_2_5+=v;
  if(i+j<=3)p.under_3_5+=v;if(i+j<=4)p.under_4_5+=v;
  if(i&&j)p.btts_yes+=v;if(i)p.home_goal+=v;if(j)p.away_goal+=v;
 }
 p.home_or_draw=p.home_win+p.draw;p.away_or_draw=p.away_win+p.draw;p.btts_no=1-p.btts_yes;
 return p;
}
function metrics(x){const n=x.length;return{n,form:x.slice(0,5).map(t=>t.result).join(" "),gf:avg(x,"gf"),ga:avg(x,"ga"),wins:x.filter(t=>t.result==="W").length,draws:x.filter(t=>t.result==="D").length,losses:x.filter(t=>t.result==="L").length,o15:pct(x,t=>t.gf+t.ga>=2),o25:pct(x,t=>t.gf+t.ga>=3),u35:pct(x,t=>t.gf+t.ga<=3),btts:pct(x,t=>t.gf>0&&t.ga>0),scored:pct(x,t=>t.gf>0),conceded:pct(x,t=>t.ga>0)}}
const specs=[
 ["home_win",1,"Match Result","result",(x)=>x.result==="W",(x)=>x.result==="L"],
 ["away_win",2,"Match Result","result",(x)=>x.result==="L",(x)=>x.result==="W"],
 ["home_or_draw",3,"Double Chance","result",(x)=>x.result!=="L",(x)=>x.result!=="W"],
 ["away_or_draw",4,"Double Chance","result",(x)=>x.result!=="W",(x)=>x.result!=="L"],
 ["over_1_5","Over 1.5 Goals","Goals","totals",(x)=>x.gf+x.ga>=2,(x)=>x.gf+x.ga>=2],
 ["over_2_5","Over 2.5 Goals","Goals","totals",(x)=>x.gf+x.ga>=3,(x)=>x.gf+x.ga>=3],
 ["under_2_5","Under 2.5 Goals","Goals","totals",(x)=>x.gf+x.ga<=2,(x)=>x.gf+x.ga<=2],
 ["under_3_5","Under 3.5 Goals","Goals","totals",(x)=>x.gf+x.ga<=3,(x)=>x.gf+x.ga<=3],
 ["under_4_5","Under 4.5 Goals","Goals","totals",(x)=>x.gf+x.ga<=4,(x)=>x.gf+x.ga<=4],
 ["home_goal",5,"Team Goals","homegoal",(x)=>x.gf>0,(x)=>x.ga>0],
 ["away_goal",6,"Team Goals","awaygoal",(x)=>x.ga>0,(x)=>x.gf>0],
 ["btts_yes","BTTS — Yes","BTTS","btts",(x)=>x.gf>0&&x.ga>0,(x)=>x.gf>0&&x.ga>0],
 ["btts_no","BTTS — No","BTTS","btts",(x)=>!x.gf||!x.ga,(x)=>!x.gf||!x.ga]
];
let reviewed=0,limited=0;
for(const game of draft.games){
 const f=mapped.get(String(game.id));if(!f)throw Error("Research missing for "+game.id);
 const H=f.last10?.home||[],A=f.last10?.away||[];if(H.length<5||A.length<5)throw Error("No last-five form for "+game.id);
 const full=H.length>=10&&A.length>=10,forecast=models.get(String(game.id)),hasShadow=forecast?.status==="shadow_prediction";
 const p={...probs(H,A),...(hasShadow?forecast.probabilities:{})},home=f.home.name,away=f.away.name,h=metrics(H),a=metrics(A);
 if(!full)limited++;
 const prior=new Map((game.top3||[]).filter(x=>x.bookExact&&x.verifiedPrice).map(x=>[x.label.toLowerCase(),x]));
 const label=v=>v===1?home+" ML":v===2?away+" ML":v===3?home+" or Draw":v===4?away+" or Draw":v===5?home+" 1+ Goal":v===6?away+" 1+ Goal":v;
 const picks=[];
 for(const [key,code,category,family,fh,fa] of specs){
  const name=label(code),nH=H.filter(fh).length,nA=A.filter(fa).length;
  let prob=p[key];if(!Number.isFinite(prob))continue;
  const trend=(nH+nA+2)/(H.length+A.length+4),weaker=Math.min((nH+1)/(H.length+2),(nA+1)/(A.length+2));
  let grade=Math.round(100*((hasShadow ? 0.92 : 0.78)*prob+(hasShadow ? 0.06 : 0.18)*trend+(hasShadow ? 0.02 : 0.04)*weaker));
  if(key==="under_4_5")grade=Math.min(grade,82);if(key==="over_1_5")grade=Math.min(grade,87);
  if(key==="home_goal"||key==="away_goal")grade=Math.min(grade,88);if(!full)grade=Math.min(grade,77);
  let reason=name+": recent trend "+nH+"/"+H.length+" "+home+" matches and "+nA+"/"+A.length+" "+away+" matches. "+home+" are "+h.wins+"W-"+h.draws+"D-"+h.losses+"L, scoring "+h.gf.toFixed(1)+" and conceding "+h.ga.toFixed(1)+" per game; "+away+" are "+a.wins+"W-"+a.draws+"D-"+a.losses+"L, scoring "+a.gf.toFixed(1)+" and conceding "+a.ga.toFixed(1)+".";
  if(category==="Match Result")reason+=" Draws count as losses for ML.";
  else if(category==="Double Chance")reason+=" A draw is protected; the opposing win is the losing outcome.";
  else if(category==="Team Goals")reason+=" Only a single team goal is needed.";
  else if(category==="Goals")reason+=" Game tempo and finishing are the main uncertainties.";
  else reason+=" Both attack and defence must support this outcome.";
  if(!full)reason+=" Limited history; reduced research grade.";
  const q=prior.get(name.toLowerCase());
  picks.push({label:name,category,family,score:null,modelProb:null,ev:null,odds:q?.odds??null,displayOdds:q?.displayOdds??null,provider:q?.provider??null,bookKey:q?.bookKey??null,bookExact:!!q,verifiedPrice:!!q,priceDecimal:q?.priceDecimal??null,priceStatus:q?"verified_snapshot":"no_line_available",probabilityCalibrated:false,confidenceRating:grade,confidenceType:"research_strength_not_calibrated",researchOnly:true,sourceBackedReason:true,reason});
 }
 picks.sort((x,y)=>y.confidenceRating-x.confidenceRating||Number(y.verifiedPrice)-Number(x.verifiedPrice));
 const top3=takeDistinctTopPicks(picks,3); // Avoid repeated goal-market theses, even across result and team markets.
 game.top3=top3;game.top=top3[0];game.model={...game.model,top:top3[0],top3,candidates:top3,rankedCandidates:top3,researchCandidates:top3,
   resultCandidates:picks.filter(x=>x.category==="Match Result"||x.category==="Double Chance"),
   home:h,away:a,displayHome:h,displayAway:a,mode:"research_only_model_crosscheck"};
 game.verifiedForm={home:{matches:H.slice(0,5)},away:{matches:A.slice(0,5)}};
 game.baseResearch={last10:{home:H,away:A}};game.staticDetails=false;
 game.recoveryStatus=full?"reviewed_research_angles":"limited_history_research_angles";
 reviewed++;
}
const qual=draft.games.filter(g=>g.top?.confidenceRating>=85&&g.model?.home?.n>=10&&g.model?.away?.n>=10)
 .sort((a,b)=>b.top.confidenceRating-a.top.confidenceRating);
const refs=x=>x.slice(0,5).map((g,i)=>({rank:i+1,gameId:String(g.id),home:g.home,away:g.away,pick:g.top}));
draft.top5=refs(qual);
draft.leagueTop5=Object.fromEntries([...new Set(draft.games.map(g=>g.league))].map(l=>[l,refs(qual.filter(g=>g.league===l))]));
draft.publicationNotes="Research-only owner-directed board. Three picks and last-five form per fixture; ML and double chance screened. Grades are not calibrated win probabilities. Odds and EV N/A unless an exact line is verified.";
draft.sourceQuality={...draft.sourceQuality,threeResearchPicks:reviewed,limitedHistory:limited,probabilityCalibrated:false,bookmakerOddsVerified:false};
if(reviewed!==base.fixtures.length||draft.games.some(g=>g.top3.length>3))throw Error("Invalid slate research coverage");
fs.writeFileSync(draftFile,JSON.stringify(draft,null,2)+String.fromCharCode(10));
console.log(JSON.stringify({date,reviewed,limited,featured:draft.top5.length}));
