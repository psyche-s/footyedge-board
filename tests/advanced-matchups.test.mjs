import test from "node:test";
import assert from "node:assert/strict";
import {buildAdvancedSimulations} from "../scripts/simulate-matchups-v3.mjs";
const date="2026-10-25",kickoff=date+"T18:00:00Z";
const rows=(gf,ga,other)=>Array.from({length:10},(_,i)=>({id:String(i),date:"2026-10-"+String(10+i).padStart(2,"0")+"T12:00:00Z",
 gf,ga,result:gf>ga?"W":gf<ga?"L":"D",venue:i%2?"home":"away",oppId:String(other)}));
const research={date,generatedAt:"2026-10-25T00:01:00Z",
 fixtures:[{id:"fixture",date:kickoff,league:"eng.1",home:{name:"Alpha",id:"1"},away:{name:"Beta",id:"2"},
 last10:{home:rows(2,1,"3"),away:rows(1,2,"4")}}]};
const standings={date,capturedAt:"2026-10-25T00:03:00Z",leagues:{"eng.1":{table:[
 {id:"1",played:8,points:17,gf:15,ga:9},{id:"2",played:8,points:14,gf:14,ga:11},
 {id:"3",played:8,points:16,gf:13,ga:11},{id:"4",played:8,points:14,gf:14,ga:12}]}}};
const analytics={date,matches:[]};
const args={research,analytics,standings,h2h:{date,fixtures:[]},teamNews:{date,fixtures:[]},
 asof:date+"T01:00:00Z",simulations:10000};
test("10k v3 draws yield normalized WDL, predicted score and provenance",()=>{
 const z=buildAdvancedSimulations(args),m=z.fixtures[0];
 assert.equal(z.totalSimulations,10000);
 assert.equal(z.coverage.fixtures,1);
 assert.ok(Math.abs(Object.values(m.winDrawLossPct).reduce((a,b)=>a+b,0)-100)<.025);
 assert.match(m.predictedScore,/^\d+-\d+$/);
 assert.ok(m.matchupContext.analogHome?.sample>=2&&m.matchupContext.analogAway?.sample>=2);
 assert.equal(m.dataQuality.usedVerifiedLineupDelta,false);
 assert.equal(m.statTotals.tackles.projection,null);
 assert.equal(m.statTotals.passes.projection,null);
});
test("verified matched shots and passes are present while unreported fouls remain absent",()=>{
 const fields={sample:9,source:"independent verified match logs",shotsAvg:14,shotsOnTargetAvg:5,
   passesAvg:460,tacklesAvg:16};
 const copy={...args,analytics:{date,matches:[{fixtureId:"fixture",verifiedJoin:true,homeStats:fields,
  awayStats:{...fields,shotsAvg:11,passesAvg:405,tacklesAvg:14}}]}};
 const z=buildAdvancedSimulations(copy).fixtures[0];
 assert.equal(z.teamProjections.home.passes,460);
 assert.equal(z.teamProjections.away.tackles,14);
 assert.equal(z.statTotals.passes.status,"modeled_from_verified_inputs");
 assert.equal(z.statTotals.tackles.lines.length,3);
 assert.equal(z.statTotals.fouls.projection,null);
 assert.ok(z.statTotals.passes.projection>800);
});
test("future score rows are omitted and out-of-period H2H is not used",()=>{
 const copy=structuredClone(args);
 copy.research.fixtures[0].last10.home.unshift({id:"future",date:"2026-10-26T12:00:00Z",
   venue:"home",gf:12,ga:0,oppId:"3"});
 copy.h2h.fixtures=[{fixtureId:"fixture",h2h:[{date:"2025-09-22T12:00:00Z",
 home:"Alpha",away:"Beta",homeScore:12,awayScore:0}]}];
 const result=buildAdvancedSimulations(copy).fixtures[0];
 assert.equal(result.matchupContext.recent12MonthH2H,0);
 assert.ok(result.expectedGoals.home<4);
});
