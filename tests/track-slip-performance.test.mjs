import test from "node:test";
import assert from "node:assert/strict";
import {scoreLeg,settleTicket,summaryOf,playerStatResult} from "../scripts/track-slip-performance.mjs";

const final={id:"401",home:"Sporting CP",away:"LASK Linz",hs:3,as:1,completed:true};
test("grade only outcome-verifiable score/result markets",()=>{
  assert.equal(scoreLeg({label:"Sporting CP ML",category:"Match Result"},final),"hit");
  assert.equal(scoreLeg({label:"LASK Linz or Draw",category:"Double Chance"},final),"miss");
  assert.equal(scoreLeg({label:"Over 2.5 Goals",category:"Goals"},final),"hit");
  assert.equal(scoreLeg({label:"Under 4 Goals",category:"Goals"},final),"push");
  assert.equal(scoreLeg({label:"Sporting CP 1+ Goal",category:"Team Goals"},final),"hit");
  assert.equal(scoreLeg({label:"BTTS Yes",category:"BTTS"},final),"hit");
  assert.equal(scoreLeg({label:"Ivan Fresneda — 1+ Fouls Committed",category:"Player Fouls Committed"},final),"pending");
});
test("a slip settles as a whole, not as a count of winning legs",()=>{
  assert.equal(settleTicket([{result:"hit"},{result:"hit"},{result:"hit"}]),"hit");
  assert.equal(settleTicket([{result:"hit"},{result:"miss"},{result:"pending"}]),"miss");
  assert.equal(settleTicket([{result:"hit"},{result:"pending"}]),"pending");
  assert.equal(settleTicket([{result:"hit"},{result:"push"}]),"hit");
  assert.equal(settleTicket([{result:"push"},{result:"push"}]),"push");
  assert.equal(settleTicket([]),"pending");
});
test("duplicate tickets never inflate the whole-slip hit rate",()=>{
  assert.deepEqual(summaryOf([{id:"sgp",result:"hit"},{id:"league:uefa.champions",result:"hit",duplicateOf:"sgp"},{id:"acca",result:"miss"},{id:"league:eng.1",result:"pending"}]),{hits:1,misses:1,pushes:0,pending:1,settled:2,hitRate:50});
});
test("unfinished games are not automatically graded",()=>{
  assert.equal(scoreLeg({label:"Sporting CP ML"}, {...final,completed:false}),"pending");
  assert.equal(scoreLeg({label:"Sporting CP ML"}, {...final,hs:null}),"pending");
});
test("player markets settle only from matching dated verified match-log values",()=>{
  const leg={label:"Ivan Fresneda — 1+ Fouls Committed"};
  const matches=[{date:"2026-10-21",opponent:"LASK Linz",foulsCommitted:1},
    {date:"2026-10-14",opponent:"Porto",foulsCommitted:0}];
  assert.equal(playerStatResult(leg,matches,"LASK Linz","2026-10-21").result,"hit");
  assert.equal(playerStatResult({label:"Geny Catamo — 2+ Shots"},[{date:"2026-10-21",opponent:"LASK Linz",shots:1}],"LASK Linz","2026-10-21").result,"miss");
  assert.equal(playerStatResult(leg,matches,"Porto","2026-10-21"),null);
  assert.equal(playerStatResult(leg,[{date:"2026-10-21",opponent:"LASK Linz",foulsCommitted:null}],"LASK Linz","2026-10-21"),null);
});

test("reviewed slips settle formatted handicap and singular player-shot labels",()=>{
 const a={id:"652",home:"Braga",away:"KAA Gent",hs:1,as:2,completed:true};
 assert.equal(scoreLeg({label:"KAA Gent +1.5 Handicap",category:"Handicap"},a),"hit");
 assert.equal(scoreLeg({label:"Braga +1.5 Handicap",category:"Handicap"},a),"hit");
 assert.equal(scoreLeg({label:"Braga -1.5 Handicap",category:"Handicap"},a),"miss");
 const sample=[{date:"2026-10-22",opponent:"Bayer Leverkusen",shots:2,shotsOnTarget:1}];
 assert.equal(playerStatResult({label:"Ibrahim Maza 1+ Shot"},sample,"Bayer Leverkusen","2026-10-22").result,"hit");
 assert.equal(playerStatResult({label:"Ibrahim Maza 3+ Shots"},sample,"Bayer Leverkusen","2026-10-22").result,"miss");
 assert.equal(playerStatResult({label:"Patrik Wålemark 1+ Shot on Target"},sample,"Bayer Leverkusen","2026-10-22").result,"hit");
 assert.equal(scoreLeg({label:"Ibrahim Maza 1+ Shot"},a),"pending");
});
