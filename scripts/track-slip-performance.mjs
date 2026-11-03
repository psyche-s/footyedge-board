#!/usr/bin/env node
// Grade the entire published FootyEdge slips, without modifying dated tips.
// Score-based legs use verified final match results. Player stats require an
// independently verified leg-result record; unavailable metrics remain pending.
import fs from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";

const ROOT=process.cwd();
const TORONTO="America/Toronto";
const DIR=path.join(ROOT,"data","performance","slips");
const today=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:TORONTO,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));return p.year+"-"+p.month+"-"+p.day;};
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const exists=p=>fs.existsSync(p);
const write=(p,value)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(value,null,2)+"\n")};
const norm=v=>String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const matchKey=(h,a)=>norm(h)+"|"+norm(a);
const count=value=>{const raw=typeof value==='object'&&value!==null?value.value??value.displayValue:value;return raw!==null&&raw!==undefined&&raw!==''&&Number.isInteger(Number(raw))&&Number(raw)>=0?Number(raw):null};
function dayOffset(date,n){const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function eventInfo(e){
  const cs=e?.competitions?.[0]?.competitors||[];
  const h=cs.find(x=>x.homeAway==="home"),a=cs.find(x=>x.homeAway==="away");
  const number=v=>{const raw=typeof v==="object"&&v!==null?v.value??v.displayValue:v;if(raw===undefined||raw===null||raw==="")return null;const n=Number(raw);return Number.isInteger(n)&&n>=0?n:null};
  return {id:String(e.id||""),home:h?.team?.displayName||"",away:a?.team?.displayName||"",
    hs:number(h?.score),as:number(a?.score),
    completed:Boolean(e?.status?.type?.completed)||String(e?.status?.type?.state||"").toLowerCase()==="post"};
}
export function scoreLeg(leg,event){
  if(!event?.completed||!Number.isInteger(event.hs)||!Number.isInteger(event.as))return "pending";
  const label=String(leg.label||""),cat=norm(leg.category||""),h=event.home,a=event.away,hs=event.hs,as=event.as;
  // A full-time score cannot establish a goal or corner count in either half.
  if(/\b(?:1st|2nd|first|second)\s+half\b|half[ -]?time/i.test(label))return "pending";
  const answer=x=>x?"hit":"miss";
  const teamScore=name=>norm(name)===norm(h)?hs:norm(name)===norm(a)?as:null;
  if(/\bML$/i.test(label)){
    const n=teamScore(label.replace(/\s+ML$/i,""));
    if(n!==null)return answer(n>(n===hs?as:hs));
  }
  let m=label.match(/^(.*?)\s+or\s+Draw$/i);
  if(m){const n=teamScore(m[1]);if(n!==null)return answer(n>=(n===hs?as:hs));}
  m=label.match(/^(.*?)\s+(Over|Under)\s+(\d+(?:\.\d+)?)\s+Team Goals?$/i);
  if(m){const n=teamScore(m[1]);if(n!==null){const line=Number(m[3]);return n===line?"push":answer(m[2].toLowerCase()==="over"?n>line:n<line);}}
  m=label.match(/^(.*?)\s+(\d+)\+\s+Goals?$/i);
  if(m){const n=teamScore(m[1]);if(n!==null)return answer(n>=Number(m[2]));}
  m=label.match(/\b(Over|Under)\s+(\d+(?:\.\d+)?)\s+Goals?/i);
  if(m){const total=hs+as,line=Number(m[2]);return total===line?"push":answer(m[1].toLowerCase()==="over"?total>line:total<line);}
  if(cat==="btts"||/\bBTTS\b/i.test(label))return answer(/yes/i.test(label)?hs>0&&as>0:hs===0||as===0);
  m=label.match(/^(.*?)\s+([+-]\d+(?:\.\d+)?)(?:\s+Handicap)?$/i);
  if(m){const n=teamScore(m[1]);if(n!==null){const d=n-(n===hs?as:hs)+Number(m[2]);return d===0?"push":answer(d>0);}}
  return "pending";
}
export function settleTicket(legs){
  const grades=legs.map(x=>x.result||"pending");
  if(grades.includes("miss"))return "miss";
  if(grades.some(x=>x==="pending"))return "pending";
  if(grades.length===0)return "pending";
  if(grades.every(x=>x==="hit"))return "hit";
  if(grades.every(x=>["hit","push"].includes(x)))return grades.includes("hit")?"hit":"push";
  return "pending";
}
export const ticketsOf=d=>{
  const candidates=[];
  if(d?.sgp?.status==="qualified"&&d.sgp.legs?.length)candidates.push({...d.sgp,id:"sgp",type:"sgp",league:d.sgp.league||d.sgp.legs[0].league||null,bestSgp:true});
  if(d?.acca?.status==="qualified"&&d.acca.legs?.length)candidates.push({...d.acca,id:"acca",type:"acca",league:null});
  for(const s of d?.sgpsByLeague||[]){
    if(s.status==="qualified"&&s.legs?.length)candidates.push({...s,id:"league:"+s.league,type:"league_sgp",league:s.league});
  }
  const seen=new Map();
  return candidates.map(s=>{
    const signature=s.legs.map(x=>String(x.gameId||"")+"|"+norm(x.label)).sort().join("||");
    const duplicateOf=seen.get(signature)||null;if(!duplicateOf)seen.set(signature,s.id);
    return {...s,signature,duplicateOf,legs:s.legs.map(x=>({gameId:String(x.gameId||""),fixture:String(x.fixture||""),league:x.league||s.league||null,kickoff:x.kickoff||null,label:String(x.label||""),category:String(x.category||""),odds:x.odds??null,referenceOdds:x.publishedReferenceOdds??x.observedReferenceOdds??null,referenceDecimal:x.publishedReferenceDecimal??null,verifiedPrice:x.verifiedPrice===true,result:"pending"})),result:"pending"};
  });
};
export function sourceFor(date,root=ROOT){
  if(!exists(path.join(root,"data","boards",date+".json")))return null;
  for(const kind of ["slips-reviewed","editorial-desk","slips"]){
    const file=path.join(root,"data",kind,date+".json");
    if(exists(file)){const data=read(file);if(data.date===date)return {path:file,data};}
  }
  return null;
}
async function finalResultsFor(date){
  const events=new Map();
  const add=d=>{for(const e of d?.events||[]){
    const info=eventInfo(e);if(!info.id)continue;
    const prior=events.get(info.id);
    if(!prior||(info.completed&&info.hs!==null&&info.as!==null&&!prior.completed))events.set(info.id,info);
  }};
  for(const delta of [-1,0,1]){
    const day=dayOffset(date,delta),p=path.join(ROOT,"data",day,"scoreboard.json");
    if(exists(p)){try{add(read(p));}catch{}}
  }
  for(const delta of [-1,0,1]){
    const day=dayOffset(date,delta);
    try{
      const url="https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates="+day.replaceAll("-","")+"&limit=1000";
      const response=await fetch(url,{signal:AbortSignal.timeout(11000),headers:{"User-Agent":"FootyEdgeSlipTracker/1.0"}});
      if(response.ok)add(await response.json());
    }catch(e){console.warn("Result source unavailable",day,String(e.message).slice(0,120));}
  }
  return [...events.values()].filter(x=>x.completed&&x.hs!==null&&x.as!==null);
}

const profileCache=new Map();
let profileRequests=0;
export function parsePlayerMarket(label){
 // Supports archived "Player — 1+ Shots" and source-reviewed "Player 1+ Shot".
 // Only verified player logs may settle an event prop; a final score never can.
 return String(label||"").match(/^\s*(.+?)(?:\s+[—–-]\s*|\s+)(\d+)\+\s+(Shots? on Target|Shots?|Fouls? Committed|Fouls? Won|Fouls? Drawn|Tackles?|Yellow Cards?|Red Cards?|Assists?|Goals?)\s*$/i);
}
const playerFields={"shot on target":"shotsOnTarget","shots on target":"shotsOnTarget","shot":"shots","shots":"shots",
 "foul committed":"foulsCommitted","fouls committed":"foulsCommitted","foul won":"foulsWon","fouls won":"foulsWon",
 "foul drawn":"foulsWon","fouls drawn":"foulsWon","tackle":"tackles","tackles":"tackles",
 "yellow card":"yellowCards","yellow cards":"yellowCards","red card":"redCards","red cards":"redCards","assist":"assists","assists":"assists","goal":"goals","goals":"goals"};
const units={shotsOnTarget:'Shots on target',shots:'Shots',foulsCommitted:'Fouls committed',foulsWon:'Fouls won',tackles:'Tackles',yellowCards:'Yellow cards',redCards:'Red cards',assists:'Assists',goals:'Goals'};
export function parseCountMarket(label){
 const m=String(label||'').match(/^(?:(1st|2nd|first|second)\s+Half\s+)?(?:(Over|Under)\s+(\d+(?:\.\d+)?)|(\d+)\+)\s+(Goals?|Corners?)$/i);
 if(!m)return null;
 return {half:m[1]?/^(1st|first)$/i.test(m[1])?1:2:null,comparison:m[2]?.toLowerCase()||'at_least',line:Number(m[3]??m[4]),metric:/corner/i.test(m[5])?'corners':'goals'};
}
export function countOutcome(market,value){
 if(!market||!Number.isInteger(value)||value<0)return null;
 const result=market.comparison==='at_least'?(value>=market.line?'hit':'miss'):value===market.line?'push':(market.comparison==='over'?value>market.line:value<market.line)?'hit':'miss';
 return {result,observed:value,unit:(market.half?market.half===1?'1st-half ':'2nd-half ':'')+market.metric};
}
export function scoreObservation(leg,event){
 if(!event?.completed||count(event.hs)===null||count(event.as)===null)return null;
 const market=parseCountMarket(leg.label);
 if(market?.metric==='goals'&&!market.half)return countOutcome(market,event.hs+event.as);
 const m=String(leg.label||'').match(/^(.*?)\s+(?:(\d+)\+\s+Goals?|(Over|Under)\s+(\d+(?:\.\d+)?)\s+Team Goals?)$/i);
 if(!m)return null;
 const value=norm(m[1])===norm(event.home)?event.hs:norm(m[1])===norm(event.away)?event.as:null;
 if(value===null)return null;
 const outcome=countOutcome({comparison:m[3]?.toLowerCase()||'at_least',line:Number(m[2]??m[4])},value);
 return {...outcome,unit:'Team goals'};
}
export function summaryLegOutcome(leg,summary){
 const comp=summary?.header?.competitions?.[0];
 if(!comp||String(comp.id)!==String(leg.gameId)||!comp.status?.type?.completed)return null;
 const competitors=comp.competitors||[],market=parseCountMarket(leg.label);
 if(market){
  let value=null;
  if(market.metric==='goals'){
   // ESPN linescores are individual periods, not the cumulative FT score.
   if(competitors.length!==2||competitors.some(t=>t.linescores?.length!==2||t.linescores.some(s=>count(s)===null)||t.linescores.reduce((n,s)=>n+count(s),0)!==count(t.score)))return null;
   value=competitors.reduce((n,t)=>n+(market.half?count(t.linescores[market.half-1]):count(t.score)),0);
  }else{
   const teams=summary.boxscore?.teams||[],totals=teams.map(t=>({team:t.team?.displayName,total:count(t.statistics?.find(s=>s.name==='wonCorners')?.displayValue)}));
   if(totals.length!==2||totals.some(t=>t.total===null))return null;
   if(!market.half)value=totals.reduce((n,t)=>n+t.total,0);
   else{
    // Count only typed, deduplicated corner events. An incomplete commentary
    // feed must reconcile with both teams' final corner totals before grading.
    const plays=[...new Map((summary.commentary||[]).map(row=>row.play).filter(p=>p?.id&&p.type?.type==='corner-awarded').map(p=>[p.id,p])).values()];
    const ends=new Set((summary.keyEvents||[]).map(p=>p.type?.type));
    if(!ends.has('halftime')||!ends.has('end-regular-time')||plays.some(p=>![1,2].includes(p.period?.number)||!totals.some(t=>norm(t.team)===norm(p.team?.displayName)))||totals.some(t=>plays.filter(p=>norm(p.team?.displayName)===norm(t.team)).length!==t.total))return null;
    value=plays.filter(p=>p.period.number===market.half).length;
   }
  }
  const outcome=countOutcome(market,value);
  return outcome?{...outcome,evidence:{kind:market.half?'verified-period-count':'verified-match-count',period:market.half,metric:market.metric}}:null;
 }
 const player=parsePlayerMarket(leg.label);if(!player)return null;
 const field=playerFields[player[3].toLowerCase()];
 const names=p=>[p.athlete?.displayName,p.athlete?.fullName].map(norm);
 const matches=(summary.rosters||[]).flatMap(t=>t.roster||[]).filter(p=>names(p).includes(norm(player[1])));
 if(matches.length!==1)return null;
 const row=matches[0],stats=row.stats||[];
 // Unused substitutes' zero-filled stat lines are not a losing prop.
 if(count(stats.find(s=>s.name==='appearances')?.value)!==1)return null;
 const providerNames={shots:['totalShots'],shotsOnTarget:['shotsOnTarget'],foulsCommitted:['foulsCommitted'],foulsWon:['foulsSuffered'],tackles:['totalTackles','tackles'],yellowCards:['yellowCards'],redCards:['redCards'],assists:['goalAssists'],goals:['totalGoals']}[field]||[];
 const value=count(stats.find(s=>providerNames.includes(s.name))?.value);
 if(value===null)return null;
 return {result:value>=Number(player[2])?'hit':'miss',observed:value,unit:units[field],evidence:{kind:'verified-match-player-stat',athleteId:row.athlete.id,metric:field}};
}
const summaryCache=new Map();
async function matchSummary(leg){
 const key=leg.league+'|'+leg.gameId;
 if(!summaryCache.has(key))summaryCache.set(key,(async()=>{
  if(!/^[a-z0-9_.]+$/i.test(leg.league||'')||!/^\d+$/.test(leg.gameId))return null;
  const url='https://site.api.espn.com/apis/site/v2/sports/soccer/'+encodeURIComponent(leg.league)+'/summary?event='+encodeURIComponent(leg.gameId);
  try{const response=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});if(response.ok)return {data:await response.json(),url};}catch{}
  return null;
 })());
 return summaryCache.get(key);
}
export function playerStatResult(leg,recent,opponent,date){
  const match=parsePlayerMarket(leg.label);
  if(!match||!Array.isArray(recent))return null;
  const field=playerFields[match[3].toLowerCase()];
  const opp=norm(opponent);
  const matches=recent.filter(x=>{
    if(Number.isFinite(x.minutes)&&x.minutes===0)return false;
    const other=norm(x.opponent),day=String(x.date||"").slice(0,10);
    const sameOpponent=other.length>=4&&opp.length>=4&&(opp===other||opp.includes(other)||other.includes(opp));
    return sameOpponent&&(day===date||day===dayOffset(date,1))&&Number.isFinite(x[field])&&x[field]>=0;
  });
  if(matches.length!==1)return null;
  return {result:matches[0][field]>=Number(match[2])?"hit":"miss",observed:matches[0][field],unit:units[field],market:match[3]};
}
export async function playerOutcome(leg,date,game,research,news){
  const label=String(leg.label||"");
  const name=parsePlayerMarket(label)?.[1];
  if(!name||!game||!research)return null;
  const fixture=(research.fixtures||[]).find(x=>String(x.id)===leg.gameId);
  if(!fixture||!fixture.home?.id||!fixture.away?.id||!fixture.league)return null;
  const intel=(news?.fixtures||[]).find(x=>String(x.fixtureId)===leg.gameId);
  const hasPlayer=(side)=>(intel?.[side]?.predictedXI||[]).some(x=>{
    const a=norm(typeof x==="string"?x:x.name),b=norm(name);
    return a===b||(a.length>=5&&b.endsWith(" "+a))||(b.length>=5&&a.endsWith(" "+b));
  });
  let teams=[fixture.home,fixture.away];
  const inHome=hasPlayer("home"),inAway=hasPlayer("away");
  if(inHome&&!inAway)teams=[fixture.home];
  if(inAway&&!inHome)teams=[fixture.away];
  for(const team of teams){
    const opponent=String(team.id)===String(fixture.home.id)?fixture.away.name:fixture.home.name;
    const cacheKey=fixture.league+"|"+team.id+"|"+norm(name);
    if(!profileCache.has(cacheKey)){
      if(profileRequests>=24)continue;
      profileRequests++;
      const url="https://footyedge-board.vercel.app/api/player-profile?league="+encodeURIComponent(fixture.league)+
        "&teamId="+encodeURIComponent(team.id)+"&name="+encodeURIComponent(name);
      const promise=(async()=>{
        try{const response=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{Accept:"application/json"}});
          if(!response.ok)return null;
          const profile=await response.json();
          if(profile?.schema!=="footyedge-player-profile-v1"||profile.status!=="verified")return null;
          return {profile,url};
        }catch{return null;}
      })();
      profileCache.set(cacheKey,promise);
    }
    const loaded=await profileCache.get(cacheKey);if(!loaded)continue;
    const graded=playerStatResult(leg,loaded.profile.recent,opponent,date);
    if(graded)return {...graded,source:loaded.url};
  }
  return null;
}

export function validReviewedResult(r){
 if(!r.gameId||!r.label||!['hit','miss','push'].includes(r.result)||!/^https:\/\//.test(String(r.sourceUrl||''))||!Number.isFinite(Date.parse(r.verifiedAt)))return false;
 if(r.voidReason!==undefined){
  return r.voidReason==='did_not_start'&&r.result==='push'&&r.observedStat===undefined&&
   Boolean(parsePlayerMarket(r.label))&&r.evidence?.started===false&&/^https:\/\//.test(r.evidence.rulesUrl||'');
 }
 if(r.observedStat!==undefined){
  if(typeof r.observedStat!=='number'||!Number.isInteger(r.observedStat)||r.observedStat<0)return false;
  const player=parsePlayerMarket(r.label),market=parseCountMarket(r.label);
  const derived=player?(r.observedStat>=Number(player[2])?'hit':'miss'):market?countOutcome(market,r.observedStat)?.result:null;
  if(derived&&derived!==r.result)return false;
 }
 return true;
}
function reviewedLegResults(date){
  const p=path.join(ROOT,"data","verified-leg-results",date+".json");
  if(!exists(p))return new Map();
  const d=read(p),results=new Map();
  if(d.date!==date||!Array.isArray(d.results))throw Error("Invalid verified leg-results file "+date);
  for(const r of d.results){
    if(!validReviewedResult(r))throw Error('Invalid verified leg result: '+date+' '+r.label);
    results.set(String(r.gameId)+"|"+norm(r.label),r);
  }
  return results;
}
export function applyReviewedResults(ticket,results){
  let latestReview=null;
  for(const leg of ticket.legs||[]){
    const review=results.get(leg.gameId+"|"+norm(leg.label));
    if(!review)continue;
    // A sourced void can supersede an older stat grade. Ordinary stat reviews
    // still fill pending legs only, and reruns keep the original correction time.
    if(leg.result!=="pending"&&(!review.voidReason||Date.parse(leg.verifiedAt)>=Date.parse(review.verifiedAt)))continue;
    leg.result=review.result;
    leg.verifiedSource=review.sourceUrl;
    leg.verifiedAt=review.verifiedAt;
    if(review.voidReason){
      leg.voidReason=review.voidReason;
      delete leg.observedStat;
      delete leg.observedUnit;
      delete leg.settlementEvidence;
    }else{
      if(review.observedStat!==undefined)leg.observedStat=review.observedStat;
      if(review.observedUnit)leg.observedUnit=review.observedUnit;
    }
    if(!latestReview||Date.parse(review.verifiedAt)>Date.parse(latestReview))latestReview=review.verifiedAt;
  }
  if(!latestReview)return;
  const result=settleTicket(ticket.legs);
  if(result==="pending")delete ticket.settledAt;
  else if(result!==ticket.result||!ticket.settledAt)ticket.settledAt=latestReview;
  ticket.result=result;
}
export function summaryOf(items){
  const unique=items.filter(x=>!x.duplicateOf);
  const hits=unique.filter(x=>x.result==="hit").length,misses=unique.filter(x=>x.result==="miss").length;
  const pushes=unique.filter(x=>x.result==="push").length,pending=unique.filter(x=>x.result==="pending").length;
  return {hits,misses,pushes,pending,settled:hits+misses,hitRate:hits+misses?Math.round(hits/(hits+misses)*10000)/100:null};
}
export const needsLegResults=ticket=>(ticket.legs||[]).some(leg=>(leg.result||"pending")==="pending");
async function run(){
  const dateToday=today();fs.mkdirSync(DIR,{recursive:true});
  const days=new Set();
  for(const kind of ["slips-reviewed","editorial-desk","slips"]){
    const loc=path.join(ROOT,"data",kind);
    if(!exists(loc))continue;
    for(const name of fs.readdirSync(loc))if(/^\d{4}-\d{2}-\d{2}\.json$/.test(name)&&name.slice(0,10)<=dateToday&&(!process.env.TRACK_SINCE||name.slice(0,10)>=process.env.TRACK_SINCE))days.add(name.slice(0,10));
  }
  for(const day of [...days].sort()){
    const file=path.join(DIR,day+".json");
    let snapshot;
    if(exists(file))snapshot=read(file);
    else {
      const published=sourceFor(day);
      if(!published||published.data.date!==day)continue;
      snapshot={date:day,source:published.path.replace(ROOT+path.sep,""),capturedAt:new Date().toISOString(),tickets:ticketsOf(published.data)};
    }
    // Fill an old empty capture from the actually published desk. Never replace
    // a saved ticket's selections.
    if(!snapshot.tickets.length){const published=sourceFor(day);if(published){snapshot.source=published.path.replace(ROOT+path.sep,"");snapshot.tickets=ticketsOf(published.data);}}
    // Existing verified full-time scores can supply a goal count for the exact
    // saved goal market without regrading or rewriting the original selection.
    for(const leg of snapshot.tickets.flatMap(t=>t.legs||[])){
      if(leg.observedStat!=null||!leg.finalScore)continue;
      const score=leg.finalScore.match(/^(\d+)-(\d+)$/),sides=leg.fixture.split(' vs ');
      if(!score||sides.length!==2)continue;
      const observed=scoreObservation(leg,{home:sides[0],away:sides[1],hs:Number(score[1]),as:Number(score[2]),completed:true});
      if(observed){leg.observedStat=observed.observed;leg.observedUnit=observed.unit;}
    }
    const upcoming=day===dateToday&&snapshot.tickets.flatMap(t=>t.legs||[]).every(l=>l.kickoff&&Date.parse(l.kickoff)>Date.now());
    const captureOnly=upcoming||process.env.TRACK_CAPTURE_ONLY==='1';
    if(!captureOnly){
      const verified=reviewedLegResults(day);
      for(const ticket of snapshot.tickets)applyReviewedResults(ticket,verified);
    }
    if(captureOnly||!snapshot.tickets.some(needsLegResults)){if(!exists(file)||snapshot.tickets.length)write(file,snapshot);continue;}
    const games=await finalResultsFor(day),byId=new Map(games.map(x=>[x.id,x])),byTeams=new Map(games.map(x=>[matchKey(x.home,x.away),x]));
    const researchPath=path.join(ROOT,"data","research-base-"+day+".json");
    const newsPath=path.join(ROOT,"data","team-intelligence",day+".json");
    const research=exists(researchPath)?read(researchPath):null,news=exists(newsPath)?read(newsPath):null;
    for(const ticket of snapshot.tickets){
      if(!needsLegResults(ticket))continue;
      for(const leg of ticket.legs){
        if(leg.result!=="pending")continue;
        let game=byId.get(leg.gameId);
        if(!game&&leg.fixture.includes(" vs ")){
          const sides=leg.fixture.split(" vs ");if(sides.length===2)game=byTeams.get(matchKey(sides[0],sides[1]));
        }
        if(game){
          leg.finalScore=game.hs+"-"+game.as;
          leg.result=scoreLeg(leg,game);
          const observed=scoreObservation(leg,game);
          if(observed){leg.observedStat=observed.observed;leg.observedUnit=observed.unit;}
          if(leg.result==="pending"){
            const summary=await matchSummary(leg),outcome=summary?summaryLegOutcome(leg,summary.data):null;
            if(outcome){leg.result=outcome.result;leg.observedStat=outcome.observed;leg.observedUnit=outcome.unit;leg.verifiedSource=summary.url;leg.verifiedAt=new Date().toISOString();leg.settlementEvidence=outcome.evidence;continue;}
            const prop=await playerOutcome(leg,day,game,research,news);
            if(prop){leg.result=prop.result;leg.verifiedSource=prop.source;leg.observedStat=prop.observed;leg.observedUnit=prop.unit;leg.verifiedAt=new Date().toISOString();}
          }
        }
      }
      ticket.result=settleTicket(ticket.legs);
      if(ticket.result!=="pending"&&!ticket.settledAt)ticket.settledAt=new Date().toISOString();
    }
    write(file,snapshot);
  }
  const docs=fs.readdirSync(DIR).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x))
    .map(x=>read(path.join(DIR,x))).filter(x=>x.date<=dateToday);
  const scope=(prefix)=>summaryOf(docs.filter(x=>x.date.startsWith(prefix)).flatMap(x=>x.tickets||[]));
  const month=dateToday.slice(0,7),year=dateToday.slice(0,4);
  const slipStats={trackingType:"entire-parlay-outcomes",generatedAt:new Date().toISOString(),month:{key:month,...scope(month)},
    year:{key:year,...scope(year)},
    recentDays:docs.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,14)
      .map(x=>({date:x.date,...summaryOf(x.tickets||[]),tickets:(x.tickets||[]).map(t=>({id:t.id,type:t.type,league:t.league,result:t.result,duplicateOf:t.duplicateOf,legResults:t.legs.map(l=>({label:l.label,result:l.result}))}))})),
    note:"Each distinct posted slip counts once, not each leg. Unverified shots, fouls and other player markets stay pending."};
  write(path.join(DIR,"summary.json"),slipStats);
  const overallPath=path.join(ROOT,"data","performance","summary.json");
  if(exists(overallPath)){const prior=read(overallPath);prior.slips=slipStats;write(overallPath,prior);}
  console.log("Whole-slip performance: "+JSON.stringify({month:slipStats.month,year:slipStats.year}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)run().catch(e=>{console.error(e);process.exitCode=1});
