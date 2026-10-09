#!/usr/bin/env node
/** Owner-authorized Oct 9 Saudi fixture addition. Does not fabricate earlier picks. */
import fs from "node:fs/promises";
import crypto from "node:crypto";

const DAY="2026-10-09";
const BOARD="data/boards/"+DAY+".json",REV="data/board-revisions/"+DAY;
const BACKUP=REV+"/before-saudiproleague-expansion.json";
const ids=["401900908","401900912","401900907"];
const form={
 "401900908":{home:"L W D W D",away:"W W W W D",
  why:"Al Kholood have been competitive at home, but Al Qadsiah have started strongly and arrived with five league wins. Both teams have attacking threat.",
  h2h:"Recent meetings favour Al Qadsiah, but those matches span different seasons and are not a strong standalone prediction.",
  url:"https://www.thestatszone.com/al-kholood-vs-al-qadsiah-preview-prediction-228290"},
 "401900912":{home:"L L D D D",away:"W L W L L",
  why:"Al Fateh came in without a win in their last five, while Al Ahli have the stronger attack but mixed away results.",
  h2h:"Recent league meetings have been competitive. Their previous four were split two wins apiece.",
  url:"https://www.sportytrader.com/en/betting-tips/al-fateh-al-ahli-377417/"},
 "401900907":{home:"D W L W W",away:"D W L W D",
  why:"Al Nassr have 16 points from seven league matches and are strong at home. Newly promoted Diriyah have 11 points and are capable of frustrating stronger opponents.",
  h2h:"The sides last met in the King's Cup in August, when Al Nassr won 4-1. Cup form is only limited H2H evidence.",
  url:"https://www.sportsmole.co.uk/football/al-nassr/preview/al-nassr-vs-al-draih-prediction-team-news-lineups_606402.html"}
};
const decode=async file=>JSON.parse(await fs.readFile(file,"utf8"));
const json=x=>JSON.stringify(x,null,2)+"\n";
const sha=x=>crypto.createHash("sha256").update(x).digest("hex");
function nativePrice(v){
 if(!/^[-+]\d{2,5}$/.test(String(v??"")))return null;
 const n=Number(v);
 return n>=-500&&n!==0&&Number.isInteger(n)?n:null;
}
function estimateMarket(a,b,price) {
 const probability=n=>n<0?-n/(-n+100):100/(n+100);
 const raw=probability(price),den=a.map(probability).reduce((s,p)=>s+p,0);
 return Math.round(100*raw/den);
}
function marketPick(title,group,score,odds,reason,source){
 return {label:title,category:group,score,modelScore:null,baseScore:null,
   stars:"★★★",odds,displayOdds:odds,provider:"DraftKings",bookKey:"draftkings",
   bookExact:true,verifiedPrice:true,priceEligible:true,ev:null,modelProb:null,
   confidenceSource:"market_only_no_league_model",researchOnly:true,
   marketProb:odds<0?(-odds)/(-odds+100):100/(odds+100),
   archivedCommentary:reason,archivedSupportFacts:[reason],
   editorialSource:source,
   displayOnly:true};
}
function build(event,now) {
 const id=String(event.id),c=event.competitions?.[0],
   h=c?.competitors?.find(t=>t.homeAway==="home"),a=c?.competitors?.find(t=>t.homeAway==="away");
 if(!h||!a||!String(event.uid).includes("~l:21231~")||!form[id])throw Error("Wrong Saudi fixture ID/team");
 const q=c.odds?.find(o=>o.provider?.name==="DraftKings"||o.provider?.displayName==="DraftKings");
 const ml=["home","draw","away"].map(k=>nativePrice(q?.moneyline?.[k]?.close?.odds));
 const totalLine=Number(q?.overUnder);
 const totals=["over","under"].map(k=>nativePrice(q?.total?.[k]?.close?.odds));
 const prices={provider:"DraftKings",source:"Original saved pre-kickoff ESPN/DraftKings price, not a live offer",
   homeML:ml[0],drawML:ml[1],awayML:ml[2],goalLine:Number.isFinite(totalLine)?totalLine:null,
   over:totals[0],under:totals[1]};
 const info=form[id],kickoff=Date.parse(event.date);
 // No newly authored pre-match tips for any fixture already started.
 const before=now<kickoff && event.status?.type?.completed!==true;
 const picks=[];
 if(before&&id==="401900907"&&ml.every(x=>x!=null)&&totals[1]!=null&&totalLine===3.5){
   const noVig=estimateMarket(ml,ml[0],ml[0]);
   const first=marketPick("Al Nassr ML","Match Result",noVig,ml[0],
     "Al Nassr have five league wins in seven and beat Diriyah 4-1 in the August King's Cup. Diriyah have shown resilience, so this remains a market-backed lean rather than a tested FootyEdge probability.",
     info.url);
   picks.push(first);
   const twoWay=[totals[0],totals[1]],p=n=>n<0?-n/(-n+100):100/(n+100);
   const prob=Math.round(p(totals[1])/(p(twoWay[0])+p(twoWay[1]))*100);
   picks.push(marketPick("Under 3.5 Goals","Goals",prob,totals[1],
     "A narrow Al Nassr win is plausible, but the recent 4-1 Cup meeting warns against treating the under as a safe play. This is an alternative to consider separately.",info.url));
 }
 const team=t=>({id:String(t.id),name:t.team.displayName,logo:t.team.logo||null,score:Number(t.score||0)});
 const hh=team(h),aa=team(a);
 const support={
   home:{n:5,form:info.home,gf:null,ga:null,formSource:"dated_independent_match_preview"},
   away:{n:5,form:info.away,gf:null,ga:null,formSource:"dated_independent_match_preview"},
 };
 return {
   id,home:hh.name,away:aa.name,date:event.date,year:2026,
   league:"ksa.1",leagueName:"Saudi Pro League",
   leagueLogo:"https://a.espncdn.com/i/leaguelogos/soccer/500/21231.png",
   teams:{home:hh,away:aa},top:picks[0]||null,top3:picks,
   ownerEditorial:{primary:info.why,headToHead:info.h2h,source:info.url,updatedForOwner:true},
   model:{top:picks[0]||null,top3:picks,candidates:picks,rankedCandidates:[],
     researchCandidates:picks,...support,
     noModelReason:"Insufficient historical Saudi Pro League training source; no fabricated probability"},
   ownerResearchNote:null,
   saudiOddsEvidence:prices,
   ownerAddition:{addedAfterLock:true,hasPrematchPick:before&&picks.length>0,
     sourceFixtureId:id,reason:before?"Fixture added before kick-off, saved sportsbook markets only":
       "Fixture added after kickoff; no new retrospective pre-match picks"}};
}
async function main(){
 const original=await fs.readFile(BOARD,"utf8"),board=JSON.parse(original);
 if(board.date!==DAY||board.state!=="locked"||board.immutable!==true)throw Error("Expected owner-preserved locked Oct 9 board");
 const existing=new Set(board.games.map(g=>String(g.id)));
 if(ids.every(id=>existing.has(id))){console.log("Saudi fixture expansion already applied");return}
 if(ids.some(id=>existing.has(id)))throw Error("Partial expansion requires manual audit");
 const events=(await decode("data/"+DAY+"/scoreboard.json")).events;
 const dateNow=new Date();
 const additions=ids.map(id=>{const e=events.find(x=>String(x.id)===id);if(!e)throw Error("Missing saved Saudi ESPN match "+id);return build(e,dateNow.getTime())});
 if(additions.length!==3||additions.some(g=>g.league!=="ksa.1"))throw Error("Incorrect Saudi scope");
 const previousTop5=json(board.top5),previousPicks=board.games.map(g=>[g.id,json(g.top3)]);
 board.games=[...board.games,...additions].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 board.leagueTop5={...board.leagueTop5,"ksa.1":[]};
 board.ownerCorrection={...(board.ownerCorrection||{}),
   saudiProLeagueAdded:true,saudiAdditionTime:dateNow.toISOString(),
   saudiModelStatus:"Unavailable: no timely fit-ready Saudi historical match-source",
   originalTop5Preserved:true,
   publishedAfterLock:true};
 if(previousTop5!==json(board.top5))throw Error("Historical Top5 modified");
 for(const [id,picks] of previousPicks){
   if(json(board.games.find(g=>String(g.id)===String(id)).top3)!==picks)throw Error("Original pick modified "+id);
 }
 const after=json(board), audits=await decode(REV+"/audit.json");
 await fs.writeFile(BACKUP,original,{flag:"wx"});
 audits.push({file:BOARD,owner:"Shaif",instruction:"Add men's Saudi Pro League to FootyEdge and explain missing sportsbook odds.",
   correctedAt:dateNow.toISOString(),beforeSha256:sha(original),afterSha256:sha(after),backupPath:BACKUP,
   reason:"Three verified ESPN Saudi fixtures appended after original lock; no retrospectively generated picks after kickoff. Pre-kickoff Al Nassr quote only if still before kickoff; no Saudi model-confidence claim. Preserved previous picks and Top 5."});
 await fs.writeFile(REV+"/audit.json",json(audits));
 await fs.writeFile(BOARD,after);
 console.log("Appended verified Saudi league fixtures to board:",additions.map(g=>({game:g.home+" vs "+g.away,picks:g.top3.map(p=>p.label),beforeKickoff:g.ownerAddition.hasPrematchPick})));
}
main().catch(e=>{console.error(e);process.exitCode=1});
