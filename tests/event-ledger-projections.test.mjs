import {test} from "node:test";import assert from "node:assert/strict";import {summarizeEventLedger} from "../scripts/event-ledger-projections.mjs";
test("all market probabilities derive from same 10000 match ledger",()=>{
 const rows=Array.from({length:10000},(_,i)=>({homeGoals:i%4,awayGoals:(i*3)%5}));
 const r=summarizeEventLedger(rows);
 assert.equal(r.match_outcome_probabilities.home_win+r.match_outcome_probabilities.draw+r.match_outcome_probabilities.away_win,100);
 assert.equal(r.double_chance.home_or_draw,r.match_outcome_probabilities.home_win+r.match_outcome_probabilities.draw);
 assert.equal(r.market_derivatives.over_3_5+r.market_derivatives.under_3_5,100);
 assert.equal(r.score_matrix_10x10_plus_overflow.flat().reduce((a,b)=>a+b,0),10000);
 assert.equal(r.match_totals.combined_projected_goals,r.score_projection.projected_goals.home_team+r.score_projection.projected_goals.away_team);
});
test("reject missing or invented match scores",()=>assert.throws(()=>summarizeEventLedger(Array(10000).fill({homeGoals:null,awayGoals:0}))));
