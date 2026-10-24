import {test} from "node:test";
import assert from "node:assert/strict";
import {buildReviewedPicks} from "../scripts/build-top3-review.mjs";
const day="2026-10-25",kid="2026-10-25T16:00:00Z";
const form=(gf,ga)=>Array.from({length:10},(_,i)=>({id:String(i),date:"2026-10-15T10:00:00Z",gf,ga,result:gf>ga?"W":gf<ga?"L":"D",venue:i%2?"away":"home"}));
const research={date:day,fixtures:[{id:"f1",league:"eng.1",date:kid,home:{id:"1",name:"Test Home"},away:{id:"2",name:"Test Away"},last10:{home:form(2,0),away:form(1,2)}}]};
const simulation={date:day,fixtures:[{fixtureId:"f1",expectedGoals:{home:1.9,away:.8},winDrawLossPct:{homeWin:63,draw:23,awayWin:14},marketsPct:{over1_5:71,over2_5:52,under3_5:77,bttsYes:44},dataQuality:{h2hGames:2}}]};
test("top-3 overlay has date-matched evidence, ranks and no sportsbook prices",()=>{
 const result=buildReviewedPicks({research,simulation,news:{fixtures:[]}});
 assert.equal(result.totals.fixtures,1);
 const picks=result.matches[0].picks;
 assert.ok(picks.length>=2&&picks.length<=3);
 for(let i=0;i<picks.length;i++){
   assert.equal(picks[i].rank,i+1);
   assert.equal(picks[i].odds,null);
   assert.equal(picks[i].probabilityCalibrated,false);
   assert.ok(picks[i].reason.length>=70);
   if(i)assert.ok(picks[i-1].confidenceRating>=picks[i].confidenceRating);
 }
 assert.equal(new Set(picks.map(x=>x.family)).size,picks.length);
 assert.equal(result.archiveUnmodified,true);
});
test("a missing matched forecast cannot generate fabricated tips",()=>{
 const res=buildReviewedPicks({research,simulation:{date:day,fixtures:[]}});
 assert.equal(res.totals.zero,1);
 assert.equal(res.matches[0].reviewed,false);
});
test("wrong date model is rejected",()=>{
 const out=buildReviewedPicks({research,simulation:{date:"2026-10-24",fixtures:[]}});
 assert.ok(out.error);
});
