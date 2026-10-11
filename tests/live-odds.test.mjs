import test from "node:test";
import assert from "node:assert/strict";
import {parseEvent,american} from "../api/live-odds.js";
const clock="2026-10-11T14:00:00Z";
function game(){
 return{id:"g1",date:"2026-10-11T20:00:00Z",status:{type:{state:"pre"}},
 competitions:[{competitors:[{homeAway:"home",team:{displayName:"Utrecht"}},{homeAway:"away",team:{displayName:"Willem II"}}],
 odds:[{provider:{name:"DraftKings"},moneyline:{home:{close:{odds:150}},draw:{close:{odds:220}},away:{close:{odds:180}}},
 total:{over:{close:{odds:-125,line:"o2.5"}},under:{close:{odds:110,line:"u2.5"}}}}]}]};
}
test("explicit book and full three-way soccer odds",()=>{
 const p=parseEvent(game(),clock).prices;
 assert.equal(p.find(x=>x.label==="Utrecht ML").odds,150);
 assert.equal(p.find(x=>x.label==="Over 2.5 Goals").odds,-125);
 assert.equal(p[0].source,"ESPN-reported");
});
test("unknown book or draw absence never gets published",()=>{
 const unknown=game();unknown.competitions[0].odds[0].provider=null;
 assert.deepEqual(parseEvent(unknown,clock).prices,[]);
 const noDraw=game();delete noDraw.competitions[0].odds[0].moneyline.draw;
 assert.equal(parseEvent(noDraw,clock).prices.some(x=>x.label.includes("ML")),false);
});
test("past match, in-game odds and impossible numbers rejected",()=>{
 const old=game();old.date="2026-10-11T12:00:00Z";
 assert.equal(parseEvent(old,clock),null);
 const live=game();live.status.type.state="in";
 assert.equal(parseEvent(live,clock),null);
 assert.equal(american(1.88),null);
 assert.equal(american(""),null);
 assert.equal(american(-110),-110);
});
