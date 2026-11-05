import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
import {buildHistory} from "../scripts/build-hit-rate-history.mjs";
test("player slips appear separately in history and player hit rates, no inflation of official wager record",()=>{
 const day="2026-11-05";
 const goal={schema:"footyedge-player-goal-slips-v1",date:day,slips:[{key:"atgs",status:"hold",legs:[{gameId:"1",player:"A",label:"A Anytime Goal",fixture:"A vs B",league:"uefa.europa",kickoff:day+"T20:00Z"}]},{key:"scoreOrAssist",status:"hold",legs:[{gameId:"2",player:"B",label:"B Score or Assist",fixture:"C vs D",league:"uefa.europa",kickoff:day+"T20:00Z"}]}]};
 const result=buildHistory({date:day,performanceDays:[],slipDays:[],candidates:[],playerGoalResearch:[goal]});
 assert.deepEqual(result.days[0].tickets.map(x=>x.type),["player_atgs","player_soa"]);
 assert.equal(result.playerGoals.month.atgs.pending,1);
 assert.equal(result.playerGoals.month.scoreOrAssist.pending,1);
 assert.equal(result.slips.month.settled,0);
 const page=fs.readFileSync("hit-rate.html","utf8");assert.match(page,/id="atgsRecord"/);assert.match(page,/id="soaRecord"/);
});
