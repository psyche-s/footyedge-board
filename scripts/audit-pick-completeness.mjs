import fs from "node:fs";
const date=process.argv[2]||"2026-10-15";
const file="data/corrections/"+date+"-v4.json";
const doc=JSON.parse(fs.readFileSync(file,"utf8"));
const report={date,source:file,fixtures:doc.games.length,top5:doc.top5.length,byLeague:{},empty:[],incomplete:[],invalid:[],researchOnly:0,priced:0};
for(const g of doc.games){
 const n=(g.top3||[]).length,l=g.league;
 const row=report.byLeague[l]??={fixtures:0,empty:0,one:0,two:0,three:0};
 row.fixtures++;row[n===0?"empty":n===1?"one":n===2?"two":"three"]++;
 if(n===0)report.empty.push({id:g.id,league:l,match:g.home+" vs "+g.away});
 if(n<3)report.incomplete.push({id:g.id,league:l,match:g.home+" vs "+g.away,have:n,missing:3-n});
 if(n>3)report.invalid.push({id:g.id,problem:"more than three picks"});
 for(const p of g.top3||[]){
  if(!p.label||!p.reason||p.reason.length<40)report.invalid.push({id:g.id,problem:"missing pick label or meaningful reasoning"});
  if(/\b(?:model|soccerdata|fbref|understat|source|openfootball|research-only)\b/i.test(p.reason))report.invalid.push({id:g.id,problem:"internal jargon in public reason"});
  if(p.researchOnly){report.researchOnly++;if(p.odds!=null||p.ev!=null||p.score!=null)report.invalid.push({id:g.id,problem:"unverified numeric claim"});}
  else if(p.verifiedPrice&&p.odds!=null)report.priced++;
 }
}
console.log(JSON.stringify(report,null,2));
if(report.invalid.length)process.exitCode=1;
if(process.env.REQUIRE_ALL_THREE==="1"&&report.incomplete.length)process.exitCode=2;
