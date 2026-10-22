import test from "node:test";
import assert from "node:assert/strict";
import {chooseResearch,produce,independent} from "../scripts/build-review-shortlist.mjs";
const d="2026-11-05";
const H=Array.from({length:10},(_,i)=>({date:"2026-10-"+String(i+1).padStart(2,"0"),gf:2,ga:0,venue:i%2?"away":"home"}));
const A=Array.from({length:10},(_,i)=>({date:"2026-10-"+String(i+1).padStart(2,"0"),gf:0,ga:2,venue:i%2?"home":"away"}));
const fixture={id:"114",date:d+"T18:00Z",league:"uefa.europa",home:{name:"Alpha"},away:{name:"Beta"},last10:{home:H,away:A}};
test("reviewed history still produces top picks when licensed article feed is absent",()=>{
 const p=chooseResearch(fixture,null,null,d);
 assert.ok(p.length>0);assert.ok(p.length<=3);
 assert.ok(p.every(x=>x.confidenceRating<=78&&x.odds===null&&!x.probabilityCalibrated));
 assert.ok(p.every((a,i)=>p.slice(i+1).every(b=>independent(a,b))));
});
test("shallow/future result histories cannot generate fake selection percentages",()=>{
 assert.deepEqual(chooseResearch({...fixture,last10:{home:H.slice(0,2),away:A}},null,null,d),[]);
 assert.deepEqual(chooseResearch({...fixture,last10:{home:H.map(x=>({...x,date:"2026-12-01"})),away:A}},null,null,d),[]);
});
test("external preview observations only count when link and fixture identity are valid",()=>{
 const row=chooseResearch(fixture,{signals:[{market:"home_win",url:"https://footballwhispers.com/preview"}]},null,d);
 assert.ok(row.some(x=>x.reviewCount>0));
 const bad=chooseResearch(fixture,{signals:[{market:"home_win",url:"javascript:bad"}]},null,d);
 assert.ok(bad.every(x=>x.reviewCount===0));
});
test("dated draft is changed without mutating archived-original input",()=>{
 const board={date:d,immutable:false,games:[{id:fixture.id,date:fixture.date,league:fixture.league,home:"Alpha",away:"Beta",model:{top3:[]},top3:[]}],top5:[],leagueTop5:{}};
 const source=JSON.stringify(board);
 const out=produce({date:d,board,research:{date:d,fixtures:[fixture]}});
 assert.equal(JSON.stringify(board),source);assert.ok(out.board.top5.length);
 assert.equal(out.desk.noSportsbookOdds,true);
 assert.equal(out.desk.props.length,0);
});
