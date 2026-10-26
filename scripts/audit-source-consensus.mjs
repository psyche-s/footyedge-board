#!/usr/bin/env node
// Internal-only source consensus audit. No scraping, invented sources, or live-site source names.
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
export const lookup=(m,p)=>{
 if(p.family==="result"){
  const label=String(p.label).toLowerCase();
  const h=String(m.home).toLowerCase(),a=String(m.away).toLowerCase();
  if(label.includes(h))return label.includes(" or draw")?"home_or_draw":label.endsWith(" ml")?"home_win":null;
  if(label.includes(a))return label.includes(" or draw")?"away_or_draw":label.endsWith(" ml")?"away_win":null;
 }
 if(p.label==="BTTS Yes")return "btts_yes";
 if(p.label==="BTTS No")return "btts_no";
 return null;
}
export function audit(review,doc){
 if(!review||!doc||review.date!==doc.date||!Array.isArray(review.matches)||!Array.isArray(doc.opinions))throw Error("Date match required");
 const allowed={windrawwin:"windrawwin.com",sports_mole:"sportsmole.co.uk",football_whispers:"footballwhispers.com",the_analyst:"theanalyst.com",forebet:"forebet.com"};
 const matchesBy=new Map(review.matches.map(x=>[String(x.gameId),x]));
 const seen=new Set(),eligible=[],invalid=[];
 for(const e of doc.opinions){
  const m=matchesBy.get(String(e.fixtureId)),domain=allowed[e.source];
  try{
   const host=String(e.url||"").match(/^https:\/\/([^\/]+)(?:\/|$)/i)?.[1]?.toLowerCase()||"";
   if(!m||e.fixtureDate!==review.date||!domain||(host!==domain&&!host.endsWith("."+domain)))throw Error("Fixture/source/date mismatch");
   if(!["match_winner","btts","double_chance"].includes(e.market)||e.kind!=="explicit_pre_match_prediction"||
   !({match_winner:["home","away","draw"],btts:["yes","no"],double_chance:["home_or_draw","away_or_draw"]}[e.market]).includes(e.prediction))throw Error("Invalid market");
   const key=e.fixtureId+"|"+e.source+"|"+e.market;
   if(seen.has(key))throw Error("Duplicate source opinion");
   seen.add(key);eligible.push(e);
  }catch(err){invalid.push({fixtureId:String(e.fixtureId),issue:String(err.message)})}
 }
 const byFixture=new Map();
 for(const e of eligible){const xs=byFixture.get(e.fixtureId)||[];xs.push(e);byFixture.set(e.fixtureId,xs)}
 const matches=[];
 for(const m of review.matches){
  const opinions=byFixture.get(String(m.gameId))||[],coverageSources=[...new Set(opinions.map(o=>o.source))];
  const picks=m.picks.map(p=>{
   const label=lookup(m,p);
   const market=label?.startsWith("btts")?"btts":"match_winner";
   const relevant=label?opinions.filter(x=>x.market===market||(market==="match_winner"&&x.market==="double_chance")):[];
   const favor=o=>{
     if(o.market==="double_chance")return label==="home_or_draw"?o.prediction==="home_or_draw":label==="away_or_draw"?o.prediction==="away_or_draw":false;
     if(market==="btts")return o.prediction===(label==="btts_yes"?"yes":"no");
     if(label==="home_win")return o.prediction==="home";
     if(label==="away_win")return o.prediction==="away";
     if(label==="home_or_draw")return o.prediction==="home"||o.prediction==="draw";
     if(label==="away_or_draw")return o.prediction==="away"||o.prediction==="draw";
     return false;
   };
   const supporters=[...new Set(relevant.filter(favor).map(o=>o.source))];
   const dissenters=[...new Set(relevant.filter(o=>!favor(o)).map(o=>o.source))];
   const directionalCompetition=relevant.some(o=>o.market==="double_chance"&&!favor(o))&&supporters.length>0;
   const verdict=relevant.length===0?"not_independently_checked":
     directionalCompetition?"competing_directional_forecasts":
     supporters.length>=2&&dissenters.length===0?"independent_agreement":
     supporters.length&&dissenters.length?"conflicting_forecasts":
     supporters.length?"limited_independent_support":"independent_forecast_opposes";
   return {label:p.label,family:p.family,verdict,support:supporters.length,oppose:dissenters.length,providersChecked:relevant.length,marketValidated:!!label};
  });
  matches.push({gameId:String(m.gameId),home:m.home,away:m.away,league:m.league,
    sourcesChecked:coverageSources,opinionsRecorded:opinions.length,picks});
 }
 const sum={fixtures:matches.length,fixturesWithExternalPrediction:matches.filter(x=>x.sourcesChecked.length).length,
    fixturesWithTwoOrMoreIndependentSources:matches.filter(x=>x.sourcesChecked.length>=2).length,
    picksWithTwoSourceAgreement:matches.flatMap(x=>x.picks).filter(x=>x.verdict==="independent_agreement").length,
    picksWithConflictingForecasts:matches.flatMap(x=>x.picks).filter(x=>x.verdict==="conflicting_forecasts").length,
    picksWithCompetingDirections:matches.flatMap(x=>x.picks).filter(x=>x.verdict==="competing_directional_forecasts").length,
    picksNotIndependentlyChecked:matches.flatMap(x=>x.picks).filter(x=>x.verdict==="not_independently_checked").length,
    sourceOpinionRecords:eligible.length,invalidRecords:invalid.length};
 return {schema:"footyedge-source-consensus-audit-v1",date:review.date,generatedAt:doc.capturedAt,notes:["A site's market odds are not an editorial prediction.","A home-win prediction supports home-or-draw as a weaker directional opinion; it does not establish a direct double-chance pick.","No approval to bulk ingest a commercial reference site is assumed.","Independent agreement is only awarded for two or more distinct forecast publishers supporting the same selection with no recorded contrary direction.","Goal-total and player-prop picks are not considered independently checked by winner-only forecasts.","Ratings are unchanged; recorded external opinions are not calibrated probabilities."],summary:sum,invalid,matches};
}
async function main(){
 const date=process.env.SLATE_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Invalid date");
 const read=async file=>{try{return JSON.parse(await fs.readFile(file,"utf8"))}catch(e){if(e.code==="ENOENT")return null;throw e}};
 const review=await read(path.join("data","pick-reviews",date+".json"));
 if(!review){console.log("No date-matched Top 3 review; audit not possible");return}
 const evidence=await read(path.join("data","source-opinions",date+".json"))||
   {schema:"footyedge-source-opinions-v1",date,capturedAt:new Date().toISOString(),opinions:[]};
 const out=audit(review,evidence),dest=path.join("data","consensus-audits",date+".json");
 await fs.mkdir(path.dirname(dest),{recursive:true});
 await fs.writeFile(dest,JSON.stringify(out,null,2)+"\n");
 console.log("Independent source consensus audit:",JSON.stringify(out.summary));
 if(out.summary.invalidRecords)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
 main().catch(e=>{console.error(e);process.exitCode=1});
