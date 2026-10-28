#!/usr/bin/env node
/**
 * Publish manually audited, dated predicted XIs already recorded in the
 * FootyEdge source-provenance ledger. No external scraping, pick edits, odds
 * edits, UI changes, or claims that editorial XIs are confirmed starters.
 *
 * The optional approved feed in sync-team-news.mjs remains authoritative;
 * this importer fills only missing full-XI pairs for the correct fixture.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {canonicalTeamName} from "./owner-fixture-identity.mjs";

const safeDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v||""));
const norm = s => String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const validXI = list => Array.isArray(list) && list.length===11 &&
 list.every(x=>typeof x==="string" && x.trim().length>=2 && x.trim().length<=100) &&
 new Set(list.map(norm)).size===11;
const freshUrl = url => {
 try {
  const u=new URL(url);
  return u.protocol==="https:" && /(^|\.)(sportsmole\.co\.uk|bulinews\.com)$/.test(u.hostname);
 } catch {return false;}
};
const recent = (when, now) => {
 const t=Date.parse(when);
 return Number.isFinite(t) && t<=now+3600000 && now-t<=48*3600000;
};
export function importAuditedPredictions({date,audit,base,existing=null,now=Date.now()}){
 if(!safeDate(date) || audit?.date!==date || base?.date!==date ||
  !Array.isArray(audit.fixtures) || !Array.isArray(base.fixtures))
   throw Error("A dated provenance ledger and matching researched fixtures are required.");
 const checkedAt=audit.checkedAt||audit.recordedAt;
 if(!recent(checkedAt,now))return {document:existing,added:[],rejected:["stale-audit"]};
 const known=new Map(base.fixtures.map(f=>[String(f.id),f]));
 const byTeams=new Map();
 const pairing=(home,away)=>canonicalTeamName(home)+"|"+canonicalTeamName(away);
 for(const g of base.fixtures){const k=pairing(g.home?.name,g.away?.name);if(!byTeams.has(k))byTeams.set(k,[]);byTeams.get(k).push(g)}
 const previous=existing?.schema==="footyedge-sourced-team-intelligence-v1" &&
  existing.date===date && Array.isArray(existing.fixtures)?
    existing.fixtures.filter(x=>known.has(String(x.fixtureId))):[];
 const byId=new Map(previous.map(row=>[String(row.fixtureId),row]));
 const added=[], rejected=[];
 for(const f of audit.fixtures){
  const teamMatches=byTeams.get(pairing(f.home,f.away))||[];
  const matched=f?.fixtureId?known.get(String(f.fixtureId)):(teamMatches.length===1?teamMatches[0]:null);
  const id=String(matched?.id||f?.fixtureId||""),g=matched,news=f?.teamNews;
  if(!g || canonicalTeamName(g.home?.name)!==canonicalTeamName(f.home) ||
     canonicalTeamName(g.away?.name)!==canonicalTeamName(f.away)){
   rejected.push(id+":fixture-mismatch");continue;
  }
  const home=news?.predictedXI?.home||news?.homeProjectedXI,away=news?.predictedXI?.away||news?.awayProjectedXI;
  const sourceOn=news?.sourcePublishedOn||f.publisherOpinions?.find(p=>p.url===news?.sourceUrl)?.publishedOn||null;
  const auditedSource=!sourceOn&&recent(checkedAt,now)&&freshUrl(news?.sourceUrl)&&news?.status==="dated_editorial_predicted_XI_unconfirmed";
  if(!["unconfirmed_predicted_XI_from_dated_editorial_preview","dated_editorial_predicted_XI_unconfirmed"].includes(news?.status)||
   !validXI(home)||!validXI(away)||!freshUrl(news?.sourceUrl)||
   (!auditedSource&&(!safeDate(sourceOn)||sourceOn>date||
   Date.parse(date+"T00:00:00Z")-Date.parse(sourceOn+"T00:00:00Z")>5*86400000))){
   if(news?.predictedXI||news?.homeProjectedXI)rejected.push(id+":invalid-or-undated-XI");
   continue;
  }
  // Preserve any prior full predicted pair, including from a licensed feed.
  const old=byId.get(id);
  const full=x=>validXI(x?.predictedXI)||Array.isArray(x?.confirmedXI)&&x.confirmedXI.length===11;
  if(old && full(old.home) && full(old.away))continue;
  const side=(name,xi,s)=>({
   ...(old?.[s]||{}),
   name,predictedXI:xi.map(x=>x.trim()),
   lineupStatus:"predicted-not-confirmed",
   out:Array.isArray(news?.injuryAndSuspensionContext?.[s])?news.injuryAndSuspensionContext[s]:[],
   doubtful:Array.isArray(news?.doubtful?.[s])?news.doubtful[s]:[]
  });
  const row={
   fixtureId:id,home:side(g.home.name,home,"home"),
   away:side(g.away.name,away,"away"),
   source:{label:"Independently researched editorial predicted XI",
    url:news.sourceUrl,checkedAt,sourcePublishedOn:sourceOn,publicationDateVerified:!!sourceOn},
   notes:"Predicted lineup from a dated preview; not an official starting XI. Formations not independently confirmed."
  };
  byId.set(id,row);added.push(id);
 }
 return {
  document:{
   schema:"footyedge-sourced-team-intelligence-v1",
   date,mode:"pre-match-predicted",
   noLineupClaimsOfConfirmation:true,doNotChangeFrozenPicks:true,
   generatedAt:new Date(now).toISOString(),
   fixtures:[...byId.values()]
  },
  added,rejected
 };
}
async function read(p){try{return JSON.parse(await fs.readFile(p,"utf8"))}
 catch(e){if(e.code==="ENOENT")return null;throw e;}}
async function main(){
 const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"})
  .formatToParts(new Date()).map(x=>[x.type,x.value]));
 const date=process.env.TEAM_NEWS_DATE||p.year+"-"+p.month+"-"+p.day;
 if(!safeDate(date))throw Error("Invalid local slate date");
 const audit=await read(path.join("data","source-provenance",date+".json"));
 if(!audit){console.log("No independently audited XI ledger for "+date+"; no synthetic lineup generated.");return}
 const base=await read(path.join("data","research-base-"+date+".json"));
 if(!base)throw Error("Dated research missing");
 const destination=path.join("data","team-intelligence",date+".json");
 const existing=await read(destination);
 const {document,added,rejected}=importAuditedPredictions({date,audit,base,existing});
 if(!added.length){console.log("Audited XI import: nothing additional. Rejected:",rejected.length);return}
 await fs.mkdir(path.dirname(destination),{recursive:true});
 await fs.writeFile(destination,JSON.stringify(document,null,2)+"\n");
 console.log("Audited predicted XIs added:",added.length,"total:",document.fixtures.length,
 "rejected:",rejected.length,"date:",date);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 main().catch(e=>{console.error(e);process.exitCode=1});
}
