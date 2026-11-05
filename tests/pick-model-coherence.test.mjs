import test from "node:test";
import assert from "node:assert/strict";
import {modelFrequency,auditPickModel} from "../scripts/audit-pick-model-coherence.mjs";
const sim={fixtureId:"42",home:"Home",away:"Away",status:"pre_kickoff_experimental",
 winDrawLossPct:{homeWin:60,draw:20,awayWin:20},
 marketsPct:{over1_5:78,over2_5:60,under3_5:70,bttsYes:65},
 dataQuality:{level:"limited_experimental",usedVerifiedLineupDelta:false}};
test("Map exact market names, including double chance, without inventing unsupported markets",()=>{
 assert.equal(modelFrequency({key:"home_or_draw"},sim),80);
 assert.equal(modelFrequency({key:"btts_no"},sim),35);
 assert.equal(modelFrequency({label:"Away ML"},sim),20);
 assert.equal(modelFrequency({label:"Under 4.5 Goals"},sim),null);
});
test("Flag disagreement and avoid changing source picks, probabilities or archived fixtures",()=>{
 const review={date:"2026-11-05",matches:[
   {gameId:"42",home:"Home",away:"Away",league:"uefa.europa",picks:[{key:"away_win",label:"Away ML",confidenceRating:81}]},
   {gameId:"43",home:"A",away:"B",league:"eng.2",picks:[{key:"home_win",label:"A ML",confidenceRating:90}]}
 ]};
 const copy=JSON.stringify(review);
 const report=auditPickModel({date:"2026-11-05",review,simulations:{date:"2026-11-05",fixtures:[sim]}});
 assert.equal(report.totals.picks,1);
 assert.equal(report.totals.requiresReview,1);
 assert.equal(report.alerts[0].experimentalModelFrequencyPct,20);
 assert.ok(report.alerts[0].flags.includes("recommended_outcome_opposes_model_favorite"));
 assert.equal(report.noAutomaticRetuning,true);
 assert.equal(JSON.stringify(review),copy);
});
test("Fail on mismatched dates, preventing post-kickoff lookahead",()=>{
 assert.throws(()=>auditPickModel({date:"2026-11-05",
  review:{date:"2026-11-04",matches:[]},simulations:{date:"2026-11-05",fixtures:[]}}));
});
