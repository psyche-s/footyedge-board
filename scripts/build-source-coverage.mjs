#!/usr/bin/env node
// Original FootyEdge provider ledger: listing a source is NOT equivalent to using it.
import fs from "node:fs/promises";
import path from "node:path";
async function main(){
 const t=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",
  year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(p=>[p.type,p.value]));
 const date=process.env.SLATE_DATE||t.year+"-"+t.month+"-"+t.day;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Bad review day");
 const read=async p=>{try{return JSON.parse(await fs.readFile(p,"utf8"))}catch(e){if(e.code==="ENOENT")return null;throw e}};
 const registry=await read("config/source-registry.json");
 if(!registry)throw Error("Source registry missing");
 const evidence=await read(path.join("data","source-opinions",date+".json"))||
  {date,opinions:[]};
 const audit=await read(path.join("data","consensus-audits",date+".json"));
 if(evidence.date!==date)throw Error("Source opinions date mismatch");
 const sources=new Map();
 for(const [role,rows] of [
   ["historical",registry.historical_sources],["application_adapter",registry.existing_application_sources],
   ["research_reference",registry.reference_only]]){
  for(const x of rows||[])if(!sources.has(x.id))
   sources.set(x.id,{id:x.id,name:x.name,sourceRole:role,
     configuredAdapter:!!x.module,mode:x.mode||"reference_only",sourceUrl:x.source_url||null,
     referenceLicenceCaveat:x.access||x.data_license||null});
 }
 const checked=new Map();
 for(const e of evidence.opinions||[]){
   const set=checked.get(e.source)||new Set();set.add(String(e.fixtureId));checked.set(e.source,set);
 }
 for(const src of sources.values()){
  src.verifiedMatchForecastFixtures=checked.get(src.id)?.size||0;
  src.checkedForEditorialForecast=src.verifiedMatchForecastFixtures>0;
  src.status=src.checkedForEditorialForecast?"dated_independent_forecasts_checked":"not_credited_as_editorial_review";
  src.notes=src.configuredAdapter?
    "Data adapter exists, which alone does not confirm a fixture-specific editorial prediction was checked.":
    "Research reference only until independently reviewed evidence is recorded.";
 }
 const rows=[...sources.values()].sort((a,b)=>b.verifiedMatchForecastFixtures-a.verifiedMatchForecastFixtures||
  a.name.localeCompare(b.name));
 const totals={registeredDistinctSources:rows.length,
  datedPredictionProviders:rows.filter(x=>x.checkedForEditorialForecast).length,
  notCreditedProviders:rows.filter(x=>!x.checkedForEditorialForecast).length,
  datedIndependentOpinionRecords:(evidence.opinions||[]).length,
  fixturesWithAnyCheckedIndependentForecast:audit?.summary?.fixturesWithExternalPrediction||0,
  fixturesWithTwoOrMoreIndependentSources:audit?.summary?.fixturesWithTwoOrMoreIndependentSources||0,
  picksWithTwoSourceAgreement:audit?.summary?.picksWithTwoSourceAgreement||0,
  picksWithConflictingForecasts:audit?.summary?.picksWithConflictingForecasts||0};
 const report={schema:"footyedge-original-source-coverage-v1",date,generatedAt:new Date().toISOString(),
   scope:"Dated independent editorial opinion checks only; source adapters and general stats are distinguished",
   notAllSourcesChecked:totals.notCreditedProviders>0,neverAssumeProviderAgrees:true,totals,sources:rows};
 const dest=path.join("data","source-coverage",date+".json");
 await fs.mkdir(path.dirname(dest),{recursive:true});
 await fs.writeFile(dest,JSON.stringify(report,null,2)+"\n");
 console.log("Editorial research source coverage:",totals);
}
main().catch(e=>{console.error(e);process.exitCode=1});
