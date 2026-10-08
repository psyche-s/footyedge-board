import fs from "node:fs";
import path from "node:path";

const SITE=(process.env.FOOTYEDGE_URL||"https://footyedge-board.vercel.app").replace(/\/$/,"");
const ROOT=process.cwd(),OUT=path.join(ROOT,"data","postmortems");
const FORCE=process.env.FORCE_TRACK==="1";
const norm=v=>String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const fixtureKey=(h,a)=>norm(h)+"|"+norm(a);
function toronto(){const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).map(x=>[x.type,x.value]));return{date:`${p.year}-${p.month}-${p.day}`,hour:p.hour}}
async function json(url){const r=await fetch(url,{headers:{accept:"application/json","user-agent":"FootyEdgePostmortem/1.0"}});if(!r.ok)throw new Error(`HTTP ${r.status} for ${url}`);return r.json()}
function eventInfo(e){const c=e?.competitions?.[0]||{},cs=c.competitors||[],h=cs.find(x=>x.homeAway==="home")||cs[0],a=cs.find(x=>x.homeAway==="away")||cs[1];return{home:h?.team?.displayName||"",away:a?.team?.displayName||"",homeScore:Number(h?.score??0),awayScore:Number(a?.score??0),done:Boolean(e?.status?.type?.completed)||e?.status?.type?.state==="post"}}
function settle(p,e){if(!e?.done)return"pending";const s=String(p?.label||""),cat=norm(p?.category),hs=e.homeScore,as=e.awayScore,total=hs+as;
  if(cat.includes("match result")||/\sML$/i.test(s)){const t=s.replace(/\s+ML$/i,"");return norm(t)===norm(e.home)?(hs>as?"hit":"miss"):norm(t)===norm(e.away)?(as>hs?"hit":"miss"):"pending"}
  const m=s.match(/\b(Over|Under)\s+(\d+(?:\.\d+)?)\s+Goals?/i);if(m){const line=Number(m[2]);if(total===line)return"push";return m[1].toLowerCase()==="over"?(total>line?"hit":"miss"):(total<line?"hit":"miss")}
  if(cat.includes("btts")||/BTTS/i.test(s)){const both=hs>0&&as>0;return /yes/i.test(s)?(both?"hit":"miss"):(!both?"hit":"miss")}
  const dc=s.match(/^(.*?)\s+or\s+Draw$/i);if(dc)return norm(dc[1])===norm(e.home)?(hs>=as?"hit":"miss"):norm(dc[1])===norm(e.away)?(as>=hs?"hit":"miss"):"pending";
  const handicap=s.match(/^(.*?)\s+([+-]\d+(?:\.\d+)?)$/);if(handicap){const line=Number(handicap[2]),d=norm(handicap[1])===norm(e.home)?hs-as:norm(handicap[1])===norm(e.away)?as-hs:null;if(d!=null){if(d+line===0)return"push";return d+line>0?"hit":"miss"}}
  return"pending"
}
function disruption(details=[],commentary=[]){const cards=details.filter(x=>x.redCard).map(x=>({type:"red-card",minute:Number(x.clock?.value||0)/60,team:x.team?.displayName||x.team?.name||null,player:x.participants?.[0]?.athlete?.displayName||null}));const pens=details.filter(x=>x.penaltyKick).map(x=>({type:"penalty",minute:Number(x.clock?.value||0)/60,team:x.team?.displayName||x.team?.name||null}));const injuries=(commentary||[]).filter(x=>/injury|injured|forced off/i.test(x.text||"")).slice(0,3).map(x=>({type:"injury-delay",text:x.text}));return[...cards,...pens,...injuries]}
function family(p){const c=norm(p?.category),raw=String(p?.label||""),s=norm(raw);if(c.includes("goals")){const line=raw.match(/(\d+(?:\.\d+)?)/)?.[1]?.replace(".","_")||"other";return(s.includes("under")?"goals_under_":"goals_over_")+line}if(c.includes("match result"))return"match_result";if(c.includes("double chance"))return"double_chance";if(c.includes("handicap"))return"handicap";if(c.includes("btts"))return"btts";if(c.includes("player")){if(/score or assist|goal or assist/.test(s))return"player_score_or_assist";if(/assist/.test(s))return"player_assist";if(/2 goals|2 or more goals|to score 2/.test(s))return"player_2plus_goals";if(/anytime|atgs|to score/.test(s))return"player_atgs";return"player_other"}return c.replace(/ /g,"_")||"other"}
function matchupProfile(p){const f=family(p);if(f.startsWith("goals_under"))return"total-under";if(f.startsWith("goals_over"))return"total-over";if(f.startsWith("player_"))return"attacking-player";if(f==="match_result")return"moneyline";if(f==="double_chance"||f==="handicap")return"protected-result";return f}
async function review(date,board){
  const scoreboard=await json(`${SITE}/api/espn-scoreboard?dates=${date.replaceAll("-","")}&limit=1000`),events=new Map((scoreboard.events||[]).map(e=>{const x=eventInfo(e);return[fixtureKey(x.home,x.away),{raw:e,...x}]}));
  const candidates=[];for(const g of board.games||[])for(const [i,p] of (g.top3||[]).entries())candidates.push({game:g,pick:p,rank:i+1});
  const seen=new Set(),reviews=[];
  for(const {game,pick,rank} of candidates){const k=fixtureKey(game.home,game.away)+"|"+rank+"|"+norm(pick.label);if(seen.has(k))continue;seen.add(k);const ev=events.get(fixtureKey(game.home,game.away));let summary=null;if(ev&&game.id)try{summary=await json(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${encodeURIComponent(game.id)}`)}catch{}
    const disruptions=disruption(summary?.header?.competitions?.[0]?.details||[],summary?.commentary||[]),result=ev?settle(pick,ev):"pending",facts=pick.archivedSupportFacts||[],explanation=String(pick.archivedCommentary||"");const evidenceAvailable=facts.length>0&&!/not saved|unavailable/i.test(explanation);
    let processGrade="MIXED",classification="pending";
    if(result==="hit"&&evidenceAvailable){processGrade="GOOD";classification="good_process_good_result"}
    else if(result==="hit")classification="result_confirmed_process_ungraded";
    else if(result==="miss"&&disruptions.length){classification=evidenceAvailable?"mixed_process_disrupted_result":"result_confirmed_disruption_process_ungraded"}
    else if(result==="miss"&&evidenceAvailable){processGrade="BAD";classification="weak_process_bad_result"}
    else if(result==="miss")classification="result_confirmed_process_ungraded";
    else if(result==="push")classification="push";
    reviews.push({gameId:game.id==null?null:String(game.id),home:game.home,away:game.away,rank,competition:game.league||game.leagueName||"unavailable",matchupProfile:matchupProfile(pick),marketFamily:family(pick),evidenceTypes:[...new Set(facts.flatMap(f=>f?.tags||[]))].filter(Boolean).slice(0,8),selection:pick.label,confidence:pick.score,originalOdds:pick.odds??pick.oddsDisplay??null,result,finalScore:ev?.done?`${ev.homeScore}-${ev.awayScore}`:null,processGrade,classification,reviewWeight:evidenceAvailable?1:0,reviewStatus:ev?result==="pending"?"pending-reliable-market-evidence":"reviewed":"pending-scoreboard-match-unavailable",disruptions,saferLineReview:"Check only against exact frozen adjacent prices; never infer an unavailable line.",explanationReview:evidenceAvailable?"Review whether the saved facts were the most predictive evidence.":"Original explanation unavailable; do not backfill or grade its wording."})
  }
  return{date,generatedAt:new Date().toISOString(),sourceBoard:path.relative(ROOT,path.join(ROOT,"data","boards",date+".json")),policy:"Every saved frozen Top 3 pick is reviewed regardless of confidence. Official result and process quality are separate. Disruptions are context, not automatic excuses. Historical explanations are never rewritten.",coverage:board.coverage||"full-board",savedTop3Count:candidates.length,reviewCount:reviews.length,missingHistoricalPositions:"Only selections actually preserved in the immutable board can be reviewed; unsaved historical Pick #2/#3 positions remain explicitly unavailable and are never reconstructed.",reviews}
}
function reviewKey(r){return fixtureKey(r.home,r.away)+"|"+Number(r.rank||1)+"|"+norm(r.selection)}
function gradeFor(r){const c=String(r?.classification||"");if(c.startsWith("good_process_"))return"GOOD";if(c.startsWith("weak_process_"))return"BAD";return r?.processGrade||"MIXED"}
function merge(existing,fresh){
  const current=new Map((existing?.reviews||[]).map(r=>[reviewKey(r),r]));
  const reviews=fresh.reviews.map(r=>{const prior=current.get(reviewKey(r))||{};const merged={...r,...prior,rank:r.rank,home:r.home,away:r.away,selection:r.selection};merged.processGrade=gradeFor(merged);return merged});
  return{...fresh,...existing,generatedAt:new Date().toISOString(),policy:fresh.policy,savedTop3Count:fresh.savedTop3Count,reviewCount:reviews.length,missingHistoricalPositions:fresh.missingHistoricalPositions,reviews};
}
async function main(){const now=toronto();if(!FORCE&&now.hour!=="06"){console.log("Skip: Toronto local hour is",now.hour,"not 06");return}fs.mkdirSync(OUT,{recursive:true});const dir=path.join(ROOT,"data","boards");for(const name of fs.readdirSync(dir).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x)&&x.slice(0,10)<now.date).sort()){const date=name.slice(0,10),file=path.join(OUT,name),board=JSON.parse(fs.readFileSync(path.join(dir,name),"utf8")),fresh=await review(date,board),existing=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,"utf8")):null,out=merge(existing,fresh);fs.writeFileSync(file,JSON.stringify(out,null,2)+"\n");console.log("Wrote",file,out.reviews.length,"saved Top 3 reviews")}}
main().catch(e=>{console.error(e);process.exit(1)});
