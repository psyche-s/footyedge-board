#!/usr/bin/env node
/**
 * Read-only FootyEdge coverage audit (asset existence is NOT a rights grant).
 * Default-deny semantics for unsupported player events, lineups, odds and EV.
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function readJSON(path, root=ROOT) {
  try { return JSON.parse(readFileSync(join(root,path), "utf8")); }
  catch (err) { if (err.code==="ENOENT") return null; throw err; }
}
export function audit({config,logoManifest,hubManifest,root=ROOT}) {
  const liveLogoSet=new Set(Object.keys(logoManifest?.competitions||{}));
  const historyLeagues=new Map((hubManifest?.leagues||[]).map(l=>[l.league,l.games]));
  const entries=config.competitions.map(c=>{
    const path=c.logo;
    const cached=Boolean(path&&liveLogoSet.has(c.code)&&existsSync(join(root,path.replace(/^\/+/,""))));
    const games=historyLeagues.get(c.code)||0;
    return {code:c.code,league:c.name,short:c.short,
      logo:{status:cached?"cached_rights_review":"missing",path:cached?path:null,
        candidateUrl:c.candidate||null,rights:"review_required",
        fallback:{type:"text_monogram",label:c.short}},
      history:{status:games>0?"available_cc0":"not_in_current_hub",completedMatches:games},
      statistics:{playerEvents:"not_connected",xg:"not_connected",lineups:"not_connected",odds:"not_connected"}};
  });
  const missing=entries.filter(e=>e.logo.status==="missing").map(e=>e.code);
  return {schema:"footyedge-coverage-audit-v1",
    summary:{leagues:entries.length,cachedLogoFiles:entries.length-missing.length,missingLogoFiles:missing.length,
      historicalLeagues:entries.filter(e=>e.history.completedMatches>0).length,
      missingLogoCodes:missing,
      availablePlayerEventFeeds:0,availableCalibratedModelFeeds:0,
      note:"Asset file existence does not establish reproduction rights."},
    fields:config.fields,leagues:entries};
}
function run() {
  const argv=process.argv.slice(2);let out=null;
  for(let i=0;i<argv.length;i++)if(argv[i]==="--out")out=argv[++i];
  const config=readJSON("config/league-coverage.json");
  if(!config)throw Error("config/league-coverage.json missing");
  const report=audit({config,logoManifest:readJSON("assets/logos/manifest.json"),
    hubManifest:readJSON("data/football-hub/manifest.json")});
  const text=JSON.stringify(report,null,2)+"\n";
  if(out){const dest=resolve(out);if(dest.startsWith(resolve(ROOT,"data/boards")+ "/"))
    throw Error("Cannot write inside immutable board archive");
    writeFileSync(dest,text,"utf8");
  }else process.stdout.write(text);
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))run();
