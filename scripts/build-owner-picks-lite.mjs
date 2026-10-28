#!/usr/bin/env node
// Small, fully source-graded fallback for mobile browser loads of Original board.
// Built only from a previously validated, owner-approved published board.
import fs from "node:fs/promises";
import path from "node:path";
import {validateBoard} from "./validate-published-boards.mjs";
const date=process.env.OWNER_OVERRIDE_DATE;
if(!/^2026-10-28$/.test(String(date)))throw Error("Explicit same-day owner-approved compact publication only");
const raw=JSON.parse(await fs.readFile(path.join("data","boards",date+".json"),"utf8"));
if(raw.date!==date||raw.ownerOverride!==true||raw.state!=="published")throw Error("No approved source board");
validateBoard(raw,{requireFull:true});
const lite={schema:raw.schema,date,ownerOverride:true,state:"published",immutable:false,
  coverage:raw.coverage,generatedAt:new Date().toISOString(),
  source:"Compact owner-approved published board",
  top5:raw.top5,leagueTop5:raw.leagueTop5,
  games:raw.games.map(g=>({
    id:g.id,date:g.date,year:g.year,league:g.league,leagueName:g.leagueName,leagueLogo:g.leagueLogo,
    home:g.home,away:g.away,teams:g.teams,
    top:g.top,top3:g.top3,model:{
      top:g.top,top3:g.top3,
      home:g.model?.home,away:g.model?.away,
      displayHome:g.model?.displayHome,displayAway:g.model?.displayAway,
      expectedGoals:g.model?.expectedGoals
    },
    h2h:g.h2h||[],teamNews:g.teamNews||[],
    recoveryStatus:g.recoveryStatus,
    dataCompleteness:g.dataCompleteness
  }))};
validateBoard(lite,{requireFull:true});
const dest=path.join("data","boards-lite",date+".json");
await fs.mkdir(path.dirname(dest),{recursive:true});
await fs.writeFile(dest,JSON.stringify(lite)+"\n");
console.log("Owner-approved compact Top 3 snapshot",JSON.stringify({
  games:lite.games.length,top3:lite.games.filter(x=>x.top3.length===3).length,
  oneOrMore:lite.games.filter(x=>x.top3.length).length,bytes:Buffer.byteLength(JSON.stringify(lite))
}));
