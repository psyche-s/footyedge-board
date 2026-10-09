#!/usr/bin/env node
/** One-time, owner-authorized 2026-10-09 expansion.
 * Copies the old official board verbatim to a revision backup, appends an audit,
 * and adds two verified male fixtures. No invented 85% picks or odds.
 */
import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
const DAY="2026-10-09";
const OLD="data/boards/"+DAY+".json";
const REV="data/board-revisions/"+DAY;
const BACKUP=REV+"/before-owner-expanded-two-leagues.json";
const AUDIT=REV+"/audit.json";
const NEW_IDS=new Set(["401880233","401888280"]);
const INSTRUCTION="Also we should include turkiye super lig and England championship. Please include those and update the slate for picks and write ups with our new model. Confirm evolved model applied to today's slate, update and push.";
const SOURCES={
 "401880233":[
  {name:"West Ham United FC (October 7 match preview)",url:"https://www.whufc.com/en/news/west-ham-united-v-queens-park-rangers-or-all-you-need-to-know-oct-2026"},
  {name:"West Ham United FC (October 8 team news)",url:"https://www.whufc.com/en/news/team-news-or-nuno-provides-squad-update-ahead-of-qpr-derby"}
 ],
 "401888280":[
  {name:"Sports Mole October 7 Turkish Süper Lig preview",url:"https://www.sportsmole.co.uk/football/galatasaray/preview/galatasaray-vs-kasimpasa-prediction-team-news-lineups_606401.html"}
 ]
};
const NOTES={
 "401880233":{
  title:"West Ham vs QPR",
  lean:"West Ham ML",
  body:"West Ham are unbeaten in their last six league matches and sit second after eight rounds. QPR have lost only once but have drawn four of eight, making them a difficult opponent to dismiss. West Ham's home attacking output favours the hosts; the published -220 moneyline is not a verified 85% play, so the safer-looking result is a research lean rather than a newly promoted Top 3 pick.",
  homeNews:"Keiber Lamadrid is out and Mohamadou Kanté is suspended. Tomáš Souček has returned to training but a competitive start has not been confirmed.",
  awayNews:"No material QPR availability update has been independently verified for a model adjustment.",
 },
 "401888280":{
  title:"Galatasaray vs Kasımpaşa",
  lean:"Galatasaray ML",
  body:"Galatasaray have 13 points from six league games but arrive off a 4-0 defeat at Trabzonspor. Kasımpaşa have started unbeaten with 10 points, so the visitor's resistance and Galatasaray's recent defensive lapse matter. The -380 home-moneyline quote is within our minimum price floor, but current-season Turkish match-result coverage is incomplete. It is a research lean, not a fitted Dixon–Coles confidence or promoted Top 3 pick.",
  homeNews:"No sufficiently sourced player-specific absence has passed the model adjustment threshold. Galatasaray's heavy last-game defeat is a form concern, not an injury claim.",
  awayNews:"No sufficiently sourced player-specific absence has passed the model adjustment threshold. No team-news model adjustment has been applied.",
 }
};
async function read(file){try{return JSON.parse(await fs.readFile(file,"utf8"))}catch(e){if(e.code==="ENOENT")return null;throw e}}
const checksum=s=>crypto.createHash("sha256").update(s).digest("hex");
const fmt=s=>JSON.stringify(s,null,2)+"\n";
function summaryTeam(team,rows){
 const matches=Array.isArray(rows)?rows:[];
 const n=matches.length;
 if(!n)return {n:0,form:"",gf:null,ga:null};
 return {n,form:matches.slice(0,5).map(x=>x.result).join(" "),
  gf:Number((matches.reduce((s,x)=>s+Number(x.gf||0),0)/n).toFixed(2)),
  ga:Number((matches.reduce((s,x)=>s+Number(x.ga||0),0)/n).toFixed(2))};
}
function priceFor(odds,side){
 const raw=odds?.moneyline?.[side]?.close?.odds;
 if(!/^[-+]\d{2,5}$/.test(String(raw||"")))return null;
 return Number(raw);
}
function buildGame(event,research,dc){
 const id=String(event.id),notes=NOTES[id],comp=event.competitions?.[0]||{};
 const home=comp.competitors?.find(x=>x.homeAway==="home"),away=comp.competitors?.find(x=>x.homeAway==="away");
 if(!home||!away||!notes)throw Error("Missing verified matchup "+id);
 const league=id==="401880233"?"eng.2":"tur.1";
 if(!String(event.uid).includes("~l:"+(league==="eng.2"?"3914":"3946")+"~"))throw Error("Unexpected league UID");
 if(event.status?.type?.completed)throw Error("Cannot add completed fixtures as pregame analysis");
 const q=comp.odds?.find(x=>x.provider?.name==="DraftKings"||x.provider?.displayName==="DraftKings");
 const quote=priceFor(q,"home");
 const match=research?.fixtures?.find(x=>String(x.id)===id);
 const estimate=dc?.fixtures?.find(x=>String(x.fixtureId)===id);
 const homeInfo={id:String(home.id),name:home.team.displayName,logo:home.team.logo||null,score:Number(home.score||0)};
 const awayInfo={id:String(away.id),name:away.team.displayName,logo:away.team.logo||null,score:Number(away.score||0)};
 const mode=estimate?.status==="shadow_prediction"?"model_available":"model_not_available";
 const intro=notes.body;
 const meta={fixtureId:id,market:notes.lean,homeML:quote,provider:quote==null?null:"DraftKings",
  source:"Original stored ESPN sportsbook quote, NOT confirmed currently available",
  modelVersion:dc?.modelVersion||null,
  modelStatus:estimate?.status||"expanded_model_snapshot_not_available",
  modelHomeWinProbability:estimate?.probabilities?.home_win??null,
  sourceResearchSha256:dc?.researchInputSha256||null};
 const teamNews=[homeInfo,awayInfo].map((t,i)=>({
  team:t.name,type:"availability",status:i===0&&id==="401880233"?"confirmed":"unverified",
  fixtureDate:DAY,material:i===0&&id==="401880233",
  text:i===0?notes.homeNews:notes.awayNews,
  impact:i===0&&id==="401880233"?"Two unavailable squad players; Souček's minutes are unconfirmed. Do not apply an unsupported numerical boost.":"No unsupported team-news boost has been applied.",
  sources:SOURCES[id]
 }));
 const homeStats=summaryTeam(homeInfo.name,match?.last10?.home);
 const awayStats=summaryTeam(awayInfo.name,match?.last10?.away);
 return {id,home:homeInfo.name,away:awayInfo.name,date:event.date,year:2026,league,
  leagueName:league==="eng.2"?"EFL Championship":"Turkish Süper Lig",
  leagueLogo:"https://a.espncdn.com/i/leaguelogos/soccer/500/"+(league==="eng.2"?"3914":"3946")+".png",
  teams:{home:homeInfo,away:awayInfo},teamNews,top:null,top3:[],
  ownerResearchNote:{title:notes.title,lean:notes.lean,body:intro,
    quote:meta,sourceLinks:SOURCES[id],process:mode,
    disclaimer:"Research lean only. It did not qualify as an 85%+ independently calibrated selection and is not part of the tracked Top 3 or global Top 5."},
  model:{top:null,top3:[],candidates:[],rankedCandidates:[],researchCandidates:[],
    home:homeStats,away:awayStats,
    expectedGoals:estimate?.expectedGoals||null,
    trendFacts:(match?.facts||[]).slice(0,8),
    bestAngle:null,shadowEstimate:estimate?.probabilities||null,
    modelReview:"Read-only Dixon–Coles evidence; no automatic confidence increase"}};
}
async function main(){
 const board=await read(OLD);
 if(!board||board.date!==DAY||board.immutable!==true||board.state!=="locked")throw Error("No immutable October 9 original board");
 if(board.games?.some(x=>NEW_IDS.has(String(x.id)))){console.log("October 9 already expanded; no repeat correction");return}
 const originalText=await fs.readFile(OLD,"utf8");
 const saved=await read("data/"+DAY+"/scoreboard.json");
 const research=await read("data/research-base-expanded-"+DAY+".json");
 const dc=await read("data/model-candidates-expanded/"+DAY+".json");
 if(!saved?.events?.length)throw Error("Cannot verify original archived ESPN fixtures");
 const events=[...NEW_IDS].map(id=>saved.events.find(x=>String(x.id)===id));
 if(events.some(x=>!x))throw Error("Missing owner-added fixture in original ESPN snapshot");
 const newGames=events.map(e=>buildGame(e,research,dc));
 board.games=[...board.games,...newGames].sort((a,b)=>new Date(a.date)-new Date(b.date));
 board.leagueTop5={...board.leagueTop5,"eng.2":[],"tur.1":[]};
 board.ownerCorrection={
  dated:DAY,ownerAuthorized:true,reason:"Add two verified men's competitions and their research without fabricating a high-confidence pick",
  originalTop5Preserved:true,originalSixSelectionRecordsPreserved:true,
  expandedModelVersion:dc?.modelVersion||null,
  expandedModelCoverage:dc?.coverage||null,
  sourceResearch:"data/research-base-expanded-"+DAY+".json"
 };
 const after=fmt(board);
 await fs.mkdir(REV,{recursive:true});
 if(await read(BACKUP))throw Error("Owner correction backup already exists but board is unexpanded");
 await fs.writeFile(BACKUP,originalText,{flag:"wx"});
 const prior=await read(AUDIT)||[];
 prior.push({
  file:OLD,owner:"Shaif",
  instruction:INSTRUCTION,
  correctedAt:new Date().toISOString(),
  beforeSha256:checksum(originalText),afterSha256:checksum(after),
  backupPath:BACKUP,
  reason:"Explicitly add men-only Turkish Süper Lig and English Championship to October 9 slate, preserving original selection ranking, price and outcomes. Expanded model is uncalibrated; leave new markets as unpromoted research notes."
 });
 await fs.writeFile(AUDIT,fmt(prior));
 await fs.writeFile(OLD,after);
 console.log("Audited owner correction: October 9 board now",board.games.length,
   "fixtures; previous",board.top5.length,"Top 5 unchanged; model status",
   newGames.map(g=>g.ownerResearchNote.quote.modelStatus).join(","));
}
main().catch(e=>{console.error(e);process.exitCode=1});
