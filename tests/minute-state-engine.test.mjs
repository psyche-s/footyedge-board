import {test} from "node:test";import assert from "node:assert/strict";
import {simulateMinuteMatch} from "../scripts/minute-state-engine.mjs";
import {summarizeEventLedger} from "../scripts/event-ledger-projections.mjs";
test("minute state engine produces 10000 coherent match outcomes with seeded RNG",()=>{
 let state=123456789;const rand=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296};
 const profile={goalRate:1.4,tempo:1,ppda:10};
 const matches=Array.from({length:10000},()=>simulateMinuteMatch({home:profile,away:profile,rand}));
 for(const m of matches){
  assert.ok(Number.isInteger(m.homeGoals)&&m.homeGoals>=0);
  assert.ok(Number.isInteger(m.awayGoals)&&m.awayGoals>=0);
  assert.equal(m.events.filter(e=>e.goal&&e.team===0).length,m.homeGoals);
  assert.equal(m.events.filter(e=>e.goal&&e.team===1).length,m.awayGoals);
 }
 const p=summarizeEventLedger(matches);
 assert.equal(p.match_outcome_probabilities.home_win+p.match_outcome_probabilities.draw+p.match_outcome_probabilities.away_win,100);
 assert.equal(p.double_chance.away_or_draw,p.match_outcome_probabilities.away_win+p.match_outcome_probabilities.draw);
 assert.equal(p.market_derivatives.over_3_5+p.market_derivatives.under_3_5,100);
});
test("rejects missing goal baselines",()=>assert.throws(()=>simulateMinuteMatch({home:{},away:{goalRate:1},rand:()=>0.5})));
