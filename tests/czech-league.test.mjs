import test from "node:test";
import assert from "node:assert/strict";
import {parseCzechSeason,eventsForCzechDate,sourceUrlForDate} from "../assets/czech-first-league.mjs";
import "../assets/board-availability.js";
const source=[
"= Czech Republic | First League 2026/27",
"▪ Regular Season - 9",
"Sun Sep 20",
"  18:00   Slavia Praha  2-1 (0-0)  Viktoria Plzeň",
"▪ Regular Season - 10",
"Fri Oct 9",
"  18:00   FC Fastav Zlín   v   Slavia Praha",
"Sat Oct 10",
"  15:00   Viktoria Plzeň   v   FK Mlada Boleslav",
"          Hradec Kralove   v   Artis Brno",
"          Zbrojovka Brno   v   FK Jablonec",
"  18:00   Bohemians 1905   v   Baník Ostrava",
"Sun Oct 11",
"  13:00   Slovan Liberec   v   1.FC Slovácko",
"  15:00   FK Teplice   v   Sigma Olomouc",
"  18:00   Sparta Praha   v   FK Pardubice"].join("\n");
test("Parse Czech games including inherited kickoff slots and no fabricated results",()=>{
 const rows=parseCzechSeason(source,{seasonStart:2026});
 assert.equal(rows.length,9);
 assert.equal(rows.filter(x=>x.score).length,1);
 const today=eventsForCzechDate(rows,"2026-10-09");
 assert.equal(today.length,1);
 assert.equal(today[0].date,"2026-10-09T16:00:00.000Z");
 assert.equal(today[0].status.type.completed,false);
 assert.equal(globalThis.FootyEdgeAvailability.leagueOf(today[0]),"cze.1");
 assert.equal(globalThis.FootyEdgeAvailability.eventDay(today[0]),"2026-10-09");
 assert.equal(globalThis.FootyEdgeAvailability.eventsForDay({events:today},"2026-10-09").length,1);
 const tomorrow=eventsForCzechDate(rows,"2026-10-10");
 assert.equal(tomorrow.length,4);
 assert.deepEqual(tomorrow.slice(0,3).map(x=>x.date),Array(3).fill("2026-10-10T13:00:00.000Z"));
});
test("Completed score is not inferred from upcoming fixtures",()=>{
 const rows=parseCzechSeason(source,{seasonStart:2026});
 assert.deepEqual(rows[0].score,[2,1]);
 assert.equal(rows[1].score,null);
});
test("Current source route derives season from Prague calendar date",()=>{
 assert.equal(sourceUrlForDate("2026-10-09"),"https://raw.githubusercontent.com/openfootball/europe/master/czech-republic/2026-27_cz1.txt");
 assert.equal(sourceUrlForDate("2027-05-01"),"https://raw.githubusercontent.com/openfootball/europe/master/czech-republic/2026-27_cz1.txt");
});
test("Explicit women's competition excluded",()=>{
 const e=eventsForCzechDate(parseCzechSeason(source,{seasonStart:2026}),"2026-10-09")[0];
 e.season.slug="czech-womens-first-league";
 assert.equal(globalThis.FootyEdgeAvailability.eventsForDay({events:[e]},"2026-10-09").length,0);
});
