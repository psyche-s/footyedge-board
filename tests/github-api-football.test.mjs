import test from "node:test";
import assert from "node:assert/strict";
import {boardMatches,canonicalMatch,sanitizeXI,torontoDate} from "../scripts/build-github-api-football.mjs";

const fixture={
 fixture:{id:1234567,date:"2026-10-30T20:00:00Z"},
 league:{id:140,name:"La Liga"},
 teams:{home:{id:102,name:"Villarreal"},away:{id:88,name:"Espanyol"}}
};
const board={games:[{id:"ESPN-123",home:"Villarreal",away:"Espanyol",date:"2026-10-30T20:00:00Z"}]};
const xi=Array.from({length:11},(_,i)=>({player:{id:100000+i,name:"Sample Player "+i,number:i, pos:i===0?"G":"D"}}));

test("date is Toronto-aware around the midnight UTC boundary",()=>{
 assert.equal(torontoDate(new Date("2026-10-31T01:30:00Z")),"2026-10-30");
 assert.equal(torontoDate(new Date("2026-10-31T05:30:00Z")),"2026-10-31");
});
test("club aliases are allowed only where explicitly verified",()=>{
 assert.equal(canonicalMatch("AFC Bournemouth","Manchester City"),canonicalMatch("Bournemouth","Man City"));
});
test("same-day original fixture is matched without confusing API and ESPN ids",()=>{
 const rows=boardMatches(board,[fixture]);
 assert.equal(rows.length,1);
 assert.equal(rows[0].originalGameId,"ESPN-123");
 assert.equal(rows[0].fixture.fixture.id,1234567);
});
test("different kickoff times or ambiguous provider matches are rejected",()=>{
 assert.equal(boardMatches(board,[{...fixture,fixture:{...fixture.fixture,date:"2026-10-31T03:00:00Z"}}]).length,0);
 assert.equal(boardMatches(board,[fixture,{...fixture,fixture:{...fixture.fixture,id:1234568}}]).length,0);
});
test("confirmed XI must contain exactly eleven unique, source-identified players",()=>{
 const p=sanitizeXI([{team:{id:102,name:"Villarreal"},formation:"4-2-3-1",startXI:xi}],{id:102});
 assert.ok(p);
 assert.equal(p.confirmedXI.length,11);
 assert.equal(p.confirmedXI[0].name,"Sample Player 0");
 assert.equal(sanitizeXI([{team:{id:88},startXI:xi}],{id:102}),null);
 assert.equal(sanitizeXI([{team:{id:102},startXI:xi.slice(0,10)}],{id:102}),null);
 assert.equal(sanitizeXI([{team:{id:102},startXI:[...xi.slice(0,10),xi[0]]}],{id:102}),null);
});
