import test from "node:test";
import assert from "node:assert/strict";
import {generateAnalystV4} from "../scripts/simulate-matchups-v4-analyst.mjs";
const date="2026-10-25",kickoff="2026-10-25T18:00:00Z",asof="2026-10-25T08:00:00Z";
const baseFixture={fixtureId:"f1",league:"eng.1",home:"Home FC",away:"Away FC",kickoff,status:"pre_kickoff_experimental",
 expectedGoals:{home:1.9,away:0.8},winDrawLossPct:{homeWin:65,draw:20,awayWin:15},marketsPct:{over1_5:70,over2_5:50,under3_5:75,bttsYes:40},
 teamProjections:{home:{goals:1.9},away:{goals:.8}},statTotals:{goals:{status:"modeled_from_verified_inputs"}}};
const baseline={date,generatedAt:"2026-10-25T07:00:00Z",fixtures:[baseFixture],coverage:{fixtures:1}};
const source={date,capturedAt:"2026-10-25T07:30:00Z",forecastInputPolicy:{blendWithFootyEdgeBaseline:0.25},fixtures:[{
 fixtureId:"f1",home:"Home FC",away:"Away FC",publishedOn:"2026-10-24",article:"https://theanalyst.com/articles/match",
 homeWin:43,draw:27,awayWin:30,teamStats:{},qualitative:["Reported view only"]}]};
const run=(external=source)=>generateAnalystV4({baseline,external,asof,draws:10000});
test("exactly 10000 simulation draws, normalized WDL and coherent goal distributions",()=>{
 const s=run(),m=s.fixtures[0];assert.equal(s.totalSimulations,10000);assert.equal(m.simulations,10000);
 assert.equal(Object.values(m.winDrawLossPct).reduce((a,b)=>a+b,0),100);
 assert.ok(m.marketsPct.over1_5>=m.marketsPct.over2_5);
 assert.ok(Math.abs(m.marketsPct.under3_5+m.statTotals.goals.lines[2].overPct-100)<.001);
 assert.equal(m.mostLikelyScores[0].score,m.predictedScore);
 assert.equal(m.dataQuality.externalMatchForecastVerified,true);
});
test("external research is capped at 25%, not a replacement for the statistical model",()=>{
 const s=run(),m=s.fixtures[0];
 assert.equal(m.externalOpinion.blendFraction,.25);
 assert.ok(m.winDrawLossPct.homeWin>43);
 assert.ok(m.winDrawLossPct.homeWin<70);
 const again=run();assert.deepEqual(s.fixtures[0].winDrawLossPct,again.fixtures[0].winDrawLossPct);
});
test("no editorial forecast falls back to a fresh V3 10K rerun",()=>{
 const e={date,fixtures:[],forecastInputPolicy:{blendWithFootyEdgeBaseline:.25}};
 const m=run(e).fixtures[0];assert.equal(m.externalOpinion,null);assert.equal(m.dataQuality.externalMatchForecastVerified,false);
});
test("after kickoff the output is explicitly retrospective, never a live forecast",()=>{
 const m=generateAnalystV4({baseline,external:source,asof:"2026-10-25T20:00:00Z",draws:10000}).fixtures[0];
 assert.equal(m.status,"retrospective_rerun_not_valid_live_prematch");
});
test("wrong fixture, date or external source published after kickoff fails validation",()=>{
 const e={...source,fixtures:[{...source.fixtures[0],home:"Wrong Home"}]};
 assert.throws(()=>run(e),/Unverified\/mismatched/);
 const late={...source,fixtures:[{...source.fixtures[0],publishedOn:"2026-10-25"}]};
 assert.throws(()=>run(late),/Unverified\/mismatched/);
});
