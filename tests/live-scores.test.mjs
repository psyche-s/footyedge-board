import test from "node:test";
import assert from "node:assert/strict";
import {normalizeEvent} from "../api/live-scores.js";
function event(status,homeScore,awayScore){
  return {id:"401",date:"2026-10-11T17:30:00Z",status:{
    type:status,displayClock:"67'"
  },competitions:[{competitors:[
    {homeAway:"home",score:homeScore,team:{displayName:"FC Utrecht"}},
    {homeAway:"away",score:awayScore,team:{displayName:"Willem II"}}
  ]}]};
}
test("scheduled games cannot display a fabricated live 0-0",()=>{
  const s=normalizeEvent(event({state:"pre",name:"STATUS_SCHEDULED"},null,null));
  assert.equal(s.live,false);assert.equal(s.done,false);
  assert.equal(s.homeScore,null);assert.equal(s.awayScore,null);
});
test("live 0-0 remains a genuine score",()=>{
  const s=normalizeEvent(event({state:"in",name:"STATUS_IN_PROGRESS"},{value:0},{value:0}));
  assert.equal(s.live,true);assert.equal(s.homeScore,0);
  assert.equal(s.awayScore,0);assert.equal(s.clock,"67'");
});
test("final state displays only upstream-confirmed results",()=>{
  const s=normalizeEvent(event({state:"post",name:"STATUS_FINAL",completed:true},{value:2},{value:1}));
  assert.equal(s.done,true);assert.equal(s.homeScore,2);assert.equal(s.awayScore,1);
});
test("missing event identity is never normalized as confirmed",()=>{
  assert.equal(normalizeEvent({date:"2026-10-11T17:30:00Z"}),null);
});
