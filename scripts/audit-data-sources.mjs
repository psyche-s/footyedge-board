#!/usr/bin/env node
// Audit existing provider adapters and the latest published history mirror.
// No network requests, credentials, board rewrites, or unlicensed source copies.
import fs from "node:fs/promises";
import {existsSync} from "node:fs";
import path from "node:path";
const root=process.cwd();
function isInside(p){const full=path.resolve(root,p);return full.startsWith(root+path.sep)}
function statusFor(source){
 const adapters=[source.module,...(source.related||[])].filter(Boolean);
 if(adapters.some(x=>!isInside(x)))throw Error("Unsafe configured source path");
 return {id:source.id,name:source.name,mode:source.mode,adapterPresent:adapters.length?adapters.every(x=>existsSync(path.join(root,x))):null,
  canPublishCompletedScores:source.can_publish_completed_scores===true,sourceUrl:source.source_url,rights:source.data_license||"See provider terms"};
}
export function verifyRegistry(reg){
 if(!reg||reg.schema_version!==1||!Array.isArray(reg.historical_sources)||!Array.isArray(reg.existing_application_sources))throw Error("Invalid FootyEdge source registry");
 const ids=new Set();for(const group of ["historical_sources","existing_application_sources"]){
  for(const item of reg[group]){if(!item.id||ids.has(item.id))throw Error("Missing or duplicate source id");ids.add(item.id);
   if(item.can_publish_completed_scores&&item.id!=="openfootball")throw Error("Only approved CC0 results can enter historical mirror");
  }
 }
 return true;
}
export function health(reg,history,runDate=new Date()){
 verifyRegistry(reg);
 const modules=[...reg.historical_sources,...reg.existing_application_sources].map(statusFor);
 if(history!==null&&(history.schema!=="footyedge-history-manifest-v1"||history.license!=="CC0-1.0"))throw Error("Unverified history manifest");
 return {schema:"footyedge-source-health-v1",reportedAt:runDate.toISOString(),
  hubRepository:reg.github_hub,history:{mode:history?.syncMode||"not-published",
   throughDateExclusive:history?.throughDateExclusive||null,completedMatches:history?.totalCompleted??0,
   leagues:history?.leagues?.length??0,warehouseRevision:history?.warehouseRevision||null,
   attemptedHistoricSeasons:history?.attemptedHistoricSeasons||[]},
  sources:modules,referenceOnly:reg.reference_only.map(x=>({id:x.id,name:x.name,mode:"manual/reference only",url:x.source_url})),
  policy:"Module presence is NOT a live API availability check. Provider keys, odds and licensed content are not published. Only completed CC0 scores may enter the history mirror."};
}
async function main(){
 const reg=JSON.parse(await fs.readFile(path.join(root,"config/source-registry.json"),"utf8"));
 let manifest=null;try{manifest=JSON.parse(await fs.readFile(path.join(root,"data/football-hub/manifest.json"),"utf8"))}catch(e){if(e.code!=="ENOENT")throw e}
 const result=health(reg,manifest);const target=path.join(root,"data/football-hub/source-health.json");
 const output=JSON.stringify(result,null,2)+"\n";
 await fs.writeFile(target,output);
 console.log("Source health: "+result.sources.filter(x=>x.adapterPresent).length+" modules present, "+result.history.completedMatches+" archived CC0 results; mode="+result.history.mode);
}
if(process.argv[1]&&import.meta.url===new URL("file://"+path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e);process.exitCode=1});
