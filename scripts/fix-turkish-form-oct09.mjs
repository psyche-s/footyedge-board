#!/usr/bin/env node
/**
 * Owner-approved source-backed form correction for Oct 9 men's Super Lig.
 * Only patches the two clubs' last-five league form and summary statistics.
 * Original ranked selections, odds, tracking and archived research stay intact.
 */
import fs from "node:fs/promises";
import crypto from "node:crypto";

const DAY="2026-10-09";
const BOARD="data/boards/"+DAY+".json";
const SOURCE="data/form-sources/"+DAY+"-tur1.json";
const REV="data/board-revisions/"+DAY;
const BACKUP=REV+"/before-turkish-form-fix.json";
const hash=x=>crypto.createHash("sha256").update(x).digest("hex");
const encode=x=>JSON.stringify(x,null,2)+"\n";
const read=async p=>JSON.parse(await fs.readFile(p,"utf8"));

function calc(team,asOf) {
  const items=team.matches;
  if(!Array.isArray(items)||items.length!==5)throw Error("Exactly 5 verified results are required");
  const seen=new Set(),cutoff=Date.parse(asOf);
  for(let i=0;i<items.length;i++){
    const x=items[i];
    const date=Date.parse(x.date+"T23:59:59Z");
    if(!Number.isFinite(date)||date>=cutoff||seen.has(x.date)||i>0&&x.date>items[i-1].date)
      throw Error("Unsafe date/ordering in Turkish league records");
    seen.add(x.date);
    if(!["W","D","L"].includes(x.result)||!["home","away"].includes(x.venue)||
       !Number.isInteger(x.gf)||!Number.isInteger(x.ga)||x.gf<0||x.ga<0||
       (x.gf>x.ga?"W":x.gf<x.ga?"L":"D")!==x.result)
      throw Error("Inconsistent full-time score/result record");
  }
  const n=items.length,gf=items.reduce((s,x)=>s+x.gf,0),
    ga=items.reduce((s,x)=>s+x.ga,0);
  return {
    n,form:items.map(x=>x.result).join(" "),
    gf:Number((gf/n).toFixed(2)),ga:Number((ga/n).toFixed(2)),
    btts:items.filter(x=>x.gf>0&&x.ga>0).length/n,
    o25:items.filter(x=>x.gf+x.ga>=3).length/n,
    formSource:"verified_2026_tur1_last5",
    lastFiveLeague:items,
  };
}

async function main(){
  const before=await fs.readFile(BOARD,"utf8"),board=JSON.parse(before);
  if(board.date!==DAY||board.state!=="locked"||board.immutable!==true||board.games.length!==8)
    throw Error("Expected immutable Oct 9 eight-game board");
  const g=board.games.find(x=>String(x.id)==="401888280");
  if(!g||g.league!=="tur.1"||String(g.teams?.home?.id)!=="432"||
     String(g.teams?.away?.id)!=="6870")throw Error("Wrong matchup/team IDs");
  if(g.model?.home?.formSource==="verified_2026_tur1_last5"){
    console.log("Verified Gala/Kasimpasa form already archived; leaving unchanged");
    return;
  }
  const source=await read(SOURCE);
  if(source.date!==DAY||source.league!=="tur.1"||Date.parse(source.kickoff)!==Date.parse(g.date)||
     !Array.isArray(source.sources)||source.sources.length<2)
    throw Error("Unverified form source or fixture mismatch");
  const home=calc(source.teams["432"],source.kickoff),
    away=calc(source.teams["6870"],source.kickoff);
  if(home.form!=="L W W W W"||away.form!=="D W D D W"||
     home.gf!==2.2||away.ga!==0.8)
    throw Error("Cross-check against verified league results failed");
  const preserved={
    top5:JSON.stringify(board.top5),
    leagueTop5:JSON.stringify(board.leagueTop5),
    allTop3:JSON.stringify(board.games.map(x=>[x.id,x.top,x.top3])),
  };
  g.model.home={...(g.model.home||{}),...home};
  g.model.away={...(g.model.away||{}),...away};
  // The UI prefers displayHome/displayAway when available.
  // Do not allow stale display overrides to mask these verified records.
  if(g.model.displayHome)g.model.displayHome={...g.model.displayHome,...home};
  if(g.model.displayAway)g.model.displayAway={...g.model.displayAway,...away};
  g.formProvenance={
    scope:"Last five Turkish Super Lig matches only; newest first",
    asOf:source.kickoff,
    verifiedSources:source.sources.map(x=>x.url),
    sourcePath:SOURCE,
    note:"Scores and team form only, not a new model probability",
  };
  if(JSON.stringify(board.top5)!==preserved.top5||
     JSON.stringify(board.leagueTop5)!==preserved.leagueTop5||
     JSON.stringify(board.games.map(x=>[x.id,x.top,x.top3]))!==preserved.allTop3)
    throw Error("Original published picks changed unexpectedly");
  const after=encode(board), audits=await read(REV+"/audit.json");
  await fs.writeFile(BACKUP,before,{flag:"wx"});
  audits.push({
    file:BOARD,owner:"Shaif",
    instruction:"Form is missing for Gala game. Show Galatasaray and Kasimpasa recent verified form on today's board.",
    correctedAt:new Date().toISOString(),beforeSha256:hash(before),afterSha256:hash(after),
    backupPath:BACKUP,
    reason:"Replaced empty last-five form and goals for both Turkish teams from independently verified 2026-27 league results. All pre-existing picks/odds/Top5 unchanged."
  });
  await fs.writeFile(REV+"/audit.json",encode(audits));
  await fs.writeFile(BOARD,after);
  console.log("Galatasaray last five league form:",home.form,"GF",home.gf,"GA",home.ga);
  console.log("Kasimpasa last five league form:",away.form,"GF",away.gf,"GA",away.ga);
}
main().catch(e=>{console.error(e);process.exitCode=1});
