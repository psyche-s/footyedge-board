#!/usr/bin/env node
// The sole public Top-3 overlay: original language, dated external-evidence audits.
// This DOES NOT change published/frozen board archives or confidence ratings.
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {audit} from "./audit-source-consensus.mjs";
export function addAuditedConsensus(review,auditDoc){
 if(!review||!auditDoc||review.date!==auditDoc.date)throw Error("Date-matched original research and independent forecast audit required");
 const by=new Map((auditDoc.matches||[]).map(x=>[String(x.gameId),x]));
 const updated=review.matches.map(m=>{
  const checked=by.get(String(m.gameId));
  const picks=m.picks.map(p=>{
    const v=checked?.picks?.find(x=>x.label===p.label);
    if(!v)return {...p,independentForecastReview:"not_checked"};
    let extra="";
    if(v.verdict==="independent_agreement")
      extra=" Two distinct pre-match forecasts also favour this result direction; individual match predictions still carry draw and game-state uncertainty.";
    if(v.verdict==="conflicting_forecasts")
      extra=" The independent pre-match forecasts disagree on the result direction, so this selection does not have an external consensus.";
    if(v.verdict==="competing_directional_forecasts")
      extra=" Independent forecasts lean toward different sides; both protected outcomes include a draw, so the matchup has no clear directional consensus.";
    return {...p,independentForecastReview:v.verdict,
      externalSupportCount:v.support,externalOppositionCount:v.oppose,
      reason:extra&&!(p.reason||"").includes(extra.trim())?(p.reason||"")+extra:p.reason};
  });
  return {...m,picks,externalSourceAudit:checked?{
    status:checked.sourcesChecked.length?"partially_checked":"unverified_no_external_forecast",
    publishersChecked:checked.sourcesChecked.length,
    doNotClaimFullRegistryCoverage:true
  }:null};
 });
 return {...review,generatedAt:new Date().toISOString(),auditVersion:"independent-opinion-consensus-v1",
   researchMethod:review.method,sourceNamesOnUi:false,archiveUnmodified:true,
   notes:"A source in the reference registry is not counted as checked without a dated, fixture-matched opinion; absence of verified data cannot be treated as a supporting vote.",
   consensusSummary:auditDoc.summary,matches:updated};
}
async function main(){
 const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",
  year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 const day=process.env.SLATE_DATE||p.year+"-"+p.month+"-"+p.day;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error("Invalid date");
 const read=async name=>{try{return JSON.parse(await fs.readFile(name,"utf8"))}catch(e){if(e.code==="ENOENT")return null;throw e}};
 const review=await read(path.join("data","pick-reviews",day+".json"));
 if(!review){console.log("No dated pick review; no consensus overlay");return}
 const evidence=await read(path.join("data","source-opinions",day+".json"))||
  {date:day,capturedAt:new Date().toISOString(),opinions:[]};
 const audited=audit(review,evidence);
 if(audited.invalid?.length)throw Error("Invalid source opinions; refused to build public copy");
 const output=addAuditedConsensus(review,audited);
 const dest=path.join("data","consensus-reviewed",day+".json");
 await fs.mkdir(path.dirname(dest),{recursive:true});
 await fs.writeFile(dest,JSON.stringify(output,null,2)+"\n");
 console.log("Consensus reviewed matches:",output.matches.length,"two-source supported picks:",audited.summary.picksWithTwoSourceAgreement);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
 main().catch(e=>{console.error(e);process.exitCode=1});
