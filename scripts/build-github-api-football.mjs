#!/usr/bin/env node
/**
 * FootyEdge ORIGINAL — GitHub Actions API-Football ingestion.
 *
 * FSAPI is read only in GitHub Actions. Commit ONLY a small, validated,
 * same-day match/confirmed-XI snapshot for existing saved board fixtures.
 * No raw API responses, provider logos/photos, odds, predictions, or secrets.
 * Never rewrite frozen selections or another project's files.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {canonicalTeamName} from "./owner-fixture-identity.mjs";

const ROOT=process.cwd();
const API="https://v3.football.api-sports.io/";
const VERSION="footyedge-api-football-github-v1";
const TZ="America/Toronto";
const MAX_LINEUP_QUERIES=5;
const MIN_RESERVED_QUOTA=8;
const hours=n=>n*60*60*1000;

export function torontoDate(at=new Date()){
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(at);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 return p.year+"-"+p.month+"-"+p.day;
}
export function canonicalMatch(home,away){
 return canonicalTeamName(home)+"|"+canonicalTeamName(away);
}
export function boardMatches(board,fixtures){
 const games=Array.isArray(board?.games)?board.games:[];
 const events=Array.isArray(fixtures)?fixtures:[];
 const used=new Set();
 return games.flatMap(g=>{
  const home=String(g.home||g.teams?.home?.name||"");
  const away=String(g.away||g.teams?.away?.name||"");
  const kickoff=Date.parse(g.date||g.kickoff||"");
  if(!home||!away)return [];
  const key=canonicalMatch(home,away);
  const same=events.filter(f=>{
   const nameKey=canonicalMatch(f?.teams?.home?.name,f?.teams?.away?.name);
   if(nameKey!==key||!Number.isInteger(Number(f?.fixture?.id)))return false;
   const fdate=Date.parse(f?.fixture?.date||"");
   return Number.isFinite(fdate)&&(!Number.isFinite(kickoff)||Math.abs(kickoff-fdate)<=hours(3));
  });
  if(same.length!==1)return []; // no guessing between duplicate fixtures
  const fixture=same[0],id=String(fixture.fixture.id);
  if(used.has(id))return [];
  used.add(id);
  return [{originalGameId:String(g.id||""),fixture}];
 });
}
export function sanitizeXI(raw,expectedTeam){
 const list=Array.isArray(raw)?raw:[];
 const teamId=String(expectedTeam?.id||"");
 const match=list.filter(x=>String(x?.team?.id||"")===teamId);
 if(match.length!==1)return null;
 const source=match[0],formation=String(source.formation||"");
 const starters=Array.isArray(source.startXI)?source.startXI:[];
 if(starters.length!==11)return null;
 const players=starters.map(x=>{
  const p=x?.player||{};
  const name=String(p.name||"").trim().slice(0,90);
  const id=String(p.id||"");
  if(!name||!/^\d{1,12}$/.test(id))return null;
  return {name,id,jersey:Number.isInteger(Number(p.number))&&Number(p.number)>=0&&Number(p.number)<100?Number(p.number):null,
   position:String(p.pos||"").slice(0,9)||null};
 });
 if(players.some(x=>!x))return null;
 if(new Set(players.map(p=>p.id)).size!==11)return null;
 return {teamId,formation:/^\d(?:-\d){2,4}$/.test(formation)?formation:null,
  confirmedXI:players};
}
function safeText(x,n=120){return String(x||"").trim().slice(0,n)}
function cleanFixture(entry){
 const f=entry.fixture,fixture=f.fixture||{},t=f.teams||{},league=f.league||{};
 return {
  originalGameId:entry.originalGameId,
  apiFixtureId:String(fixture.id),
  kickoff:safeText(fixture.date,35),
  league:{id:Number.isInteger(Number(league.id))?Number(league.id):null,name:safeText(league.name,90)},
  home:{id:String(t.home?.id||""),name:safeText(t.home?.name,90)},
  away:{id:String(t.away?.id||""),name:safeText(t.away?.name,90)},
  homeXI:null,awayXI:null
 };
}
function safePrevious(old,row){
 const prior=(old?.matches||[]).find(m=>String(m.apiFixtureId)===row.apiFixtureId&&
  canonicalMatch(m.home?.name,m.away?.name)===canonicalMatch(row.home.name,row.away.name));
 if(!prior)return row;
 for(const k of ["homeXI","awayXI"]){
  const team=k==="homeXI"?row.home:row.away;
  if(prior[k]?.confirmedXI?.length===11&&prior[k].confirmedXI.every(p=>p?.name&&/^\d{1,12}$/.test(String(p.id||""))) &&
    String(prior[k].teamId||"")===String(team.id))row[k]=prior[k];
 }
 return row;
}
function errorCategories(data){
 if(!data?.errors||typeof data.errors!=="object")return [];
 return Object.entries(data.errors).filter(([,value])=>Boolean(value)).map(([key])=>key);
}
async function getEndpoint(endpoint,key,params){
 const url=new URL(endpoint,API);
 for(const [k,v] of Object.entries(params||{}))url.searchParams.set(k,String(v));
 const response=await fetch(url,{headers:{"x-apisports-key":key},signal:AbortSignal.timeout(12000)});
 const data=await response.json().catch(()=>null);
 const errors=errorCategories(data);
 if(!response.ok||!data||errors.length)throw Error("API-Football "+endpoint+" rejected (HTTP "+response.status+
  "; error categories: "+errors.join(",")+")");
 if(!Array.isArray(data.response)&&endpoint!=="status")throw Error("Invalid provider response format: "+endpoint);
 return data;
}
function canCallRemaining(status){
 const quota=status?.response?.requests||{};
 const current=Number(quota.current),limit=Number(quota.limit);
 return Number.isFinite(current)&&Number.isFinite(limit)&&limit>0?Math.max(0,limit-current):null;
}
function shouldLoadXI(row,now=Date.now()){
 const kickoff=Date.parse(row.kickoff);
 return Number.isFinite(kickoff)&&kickoff-now<=hours(3)&&kickoff-now>=-hours(9);
}
async function readJSON(p){
 try{return JSON.parse(await fs.readFile(path.join(ROOT,p),"utf8"))}catch{return null}
}
export async function buildSnapshot({date=torontoDate(),key=process.env.FSAPI||process.env.fsAPI||"",now=Date.now()}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Math.abs(Date.parse(date+"T12:00:00Z")-now)>hours(72))
  throw Error("Only the current or nearby Toronto board date can be ingested");
 if(!key)throw Error("GitHub Actions secret FSAPI is unavailable");
 const board=await readJSON("data/boards/"+date+".json");
 if(!board||board.date!==date||!Array.isArray(board.games)||!board.games.length){
  console.log("Saved original board not available for "+date+"; no files were modified.");
  return {date,written:false,reason:"no_original_board"};
 }
 const status=await getEndpoint("status",key,{});
 if(!status.response||typeof status.response!=="object"||Array.isArray(status.response))
  throw Error("API-Football token is not authenticated");
 let remaining=canCallRemaining(status);
 if(remaining!==null&&remaining<=MIN_RESERVED_QUOTA)
  throw Error("API-Football daily quota is nearly exhausted; no requests made.");
 const fixtureData=await getEndpoint("fixtures",key,{date,timezone:TZ});
 if(remaining!==null)remaining--;
 const matches=boardMatches(board,fixtureData.response).map(cleanFixture);
 if(!matches.length){
  console.log("No unambiguous matches between API-Football and the Original board for "+date+"; kept prior data.");
  return {date,written:false,reason:"no_verified_matches"};
 }
 const outPath="data/github-api-football/"+date+".json";
 const previous=await readJSON(outPath);
 for(const row of matches)safePrevious(previous,row);
 const targets=matches.filter(row=>shouldLoadXI(row,now));
 let inspected=0;
 for(const row of targets.slice(0,MAX_LINEUP_QUERIES)){
  if(remaining!==null&&remaining<=MIN_RESERVED_QUOTA)break;
  try{
   const response=await getEndpoint("fixtures/lineups",key,{fixture:row.apiFixtureId});
   row.homeXI=sanitizeXI(response.response,row.home)||row.homeXI;
   row.awayXI=sanitizeXI(response.response,row.away)||row.awayXI;
   inspected++;
  }catch{
   // A missing XI never becomes "confirmed" and never erases previously verified data.
   console.log("Lineup data unavailable for a reviewed fixture; retaining verified fallback.");
  }
  if(remaining!==null)remaining--;
 }
 const snapshot={
  schema:VERSION,date,source:{label:"API-Football",url:"https://www.api-football.com"},
  checkedAt:new Date(now).toISOString(),
  coverage:{boardMatches:board.games.length,matchedFixtures:matches.length,xiQueries:inspected,
   confirmedSides:matches.reduce((n,m)=>n+(m.homeXI?1:0)+(m.awayXI?1:0),0)},
  matches:matches
 };
 // A provider outage must never delete older verified XIs or any source-approved picks.
 await fs.mkdir(path.dirname(path.join(ROOT,outPath)),{recursive:true});
 await fs.writeFile(path.join(ROOT,outPath),JSON.stringify(snapshot,null,2)+"\n","utf8");
 console.log("API-Football snapshot validated. Board fixtures: "+board.games.length+
  ", identity matches: "+matches.length+", confirmed XI sides: "+snapshot.coverage.confirmedSides+
  ", lineup queries: "+inspected+". No picks were altered.");
 return {date,written:true,path:outPath,coverage:snapshot.coverage};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const date=process.env.FOOTYEDGE_API_DATE||torontoDate();
 buildSnapshot({date}).catch(e=>{console.error("::error::"+e.message);process.exitCode=1});
}
