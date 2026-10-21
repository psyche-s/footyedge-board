import test from "node:test";import assert from "node:assert/strict";
import{extractStarters,injuries}from"../api/match-updates.js";
test("only genuine eleven starters create confirmed XI",()=>{
 const roster=Array.from({length:11},(_,i)=>({starter:true,athlete:{displayName:"Player "+i}}));
 assert.equal(extractStarters({rosters:[{team:{id:"11"},roster}]}).length,1);
 assert.equal(extractStarters({rosters:[{team:{id:"11"},roster:roster.slice(0,10)}]}).length,0);
 assert.equal(extractStarters({rosters:[{team:{id:"11"},roster:roster.map(x=>({...x,starter:false}))}]}).length,0);
});
test("avoid source-free injury assertions",()=>{
 assert.deepEqual(injuries({injuries:[{team:{id:"4"},injuries:[{athlete:{displayName:"P"},status:"out"}]}]}),{"4":["P (out)"]});
 assert.deepEqual(injuries({}),{});
});
