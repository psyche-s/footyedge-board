import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {summaryLegOutcome,scoreObservation,countOutcome,parseCountMarket,validReviewedResult,applyReviewedResults} from '../scripts/track-slip-performance.mjs';

const summary=JSON.parse(fs.readFileSync(new URL('./fixtures/settlement-lyon-angers-2026-11-01.json',import.meta.url)));
const leg=label=>({gameId:'401876418',label});
test('finished match periods settle their own goal and corner counts',()=>{
 for(const [label,result,value,unit] of [
  ['1st Half Over 0.5 Goals','hit',1,'1st-half goals'],
  ['2nd Half Over 0.5 Goals','hit',1,'2nd-half goals'],
  ['1st Half 4+ Corners','hit',4,'1st-half corners'],
  ['2nd Half 4+ Corners','miss',3,'2nd-half corners']
 ]){
  const outcome=summaryLegOutcome(leg(label),summary);
  assert.equal(outcome.result,result);assert.equal(outcome.observed,value);assert.equal(outcome.unit,unit);
 }
 assert.equal(countOutcome(parseCountMarket('Over 4 Corners'),4).result,'push');
 assert.equal(countOutcome(parseCountMarket('4+ Corners'),4).result,'hit');
});
test('period settlement rejects incomplete, mismatched and unfinished match evidence',()=>{
 const missing=structuredClone(summary);missing.commentary.pop();
 assert.equal(summaryLegOutcome(leg('2nd Half 4+ Corners'),missing),null);
 const unknownPeriod=structuredClone(summary);delete unknownPeriod.commentary[0].play.period;
 assert.equal(summaryLegOutcome(leg('1st Half 4+ Corners'),unknownPeriod),null);
 const wrongGoals=structuredClone(summary);wrongGoals.header.competitions[0].competitors[0].linescores[0].displayValue='0';
 assert.equal(summaryLegOutcome(leg('1st Half Over 0.5 Goals'),wrongGoals),null);
 const unfinished=structuredClone(summary);unfinished.header.competitions[0].status.type.completed=false;
 assert.equal(summaryLegOutcome(leg('1st Half Over 0.5 Goals'),unfinished),null);
 assert.equal(summaryLegOutcome({...leg('1st Half Over 0.5 Goals'),gameId:'other'},summary),null);
});
test('duplicate corner commentary is counted once and stoppage time follows the provider period',()=>{
 const replay=structuredClone(summary);replay.commentary.push(replay.commentary[0]);
 replay.commentary[0].play.clock={value:2820,displayValue:"45'+2'"};
 assert.equal(summaryLegOutcome(leg('1st Half 4+ Corners'),replay).observed,4);
 assert.equal(summaryLegOutcome(leg('2nd Half 4+ Corners'),replay).observed,3);
});
test('match player stats require an exact athlete, an appearance, and an explicitly recorded value',()=>{
 const s=structuredClone(summary);
 s.rosters=[{roster:[{athlete:{id:'1',displayName:'Player One'},stats:[{name:'appearances',value:1},{name:'totalShots',value:2},{name:'foulsCommitted',value:0}]}]}];
 assert.equal(summaryLegOutcome(leg('Player One 2+ Shots'),s).observed,2);
 assert.equal(summaryLegOutcome(leg('Player One 1+ Fouls Committed'),s).result,'miss');
 assert.equal(summaryLegOutcome(leg('Player One 2+ Tackles'),s),null);
 assert.equal(summaryLegOutcome(leg('Other Player 2+ Shots'),s),null);
 s.rosters[0].roster[0].stats[0].value=0;
 assert.equal(summaryLegOutcome(leg('Player One 2+ Shots'),s),null);
});
test('reviewed numeric outcomes must agree with the exact saved prop threshold',()=>{
 const result={gameId:'1',label:'Player 2+ Tackles',result:'hit',observedStat:3,sourceUrl:'https://example.com/match/1',verifiedAt:'2026-11-02T06:00:00Z'};
 assert.equal(validReviewedResult(result),true);
 assert.equal(validReviewedResult({...result,observedStat:1}),false);
 assert.equal(validReviewedResult({...result,observedStat:null}),false);
 assert.equal(validReviewedResult({...result,observedStat:'3'}),false);
 assert.equal(validReviewedResult({...result,label:'2nd Half 4+ Corners',observedStat:3}),false);
 assert.equal(validReviewedResult({...result,label:'2nd Half 4+ Corners',observedStat:3,result:'miss'}),true);
});
test('a verified non-starter void can correct a settled loss to a win',()=>{
 const review={gameId:'1',label:'Player One 1+ Foul Committed',result:'push',voidReason:'did_not_start',
  sourceUrl:'https://example.com/match/1',verifiedAt:'2026-11-03T07:00:00Z',
  evidence:{started:false,rulesUrl:'https://example.com/rules'}};
 assert.equal(validReviewedResult(review),true);
 assert.equal(validReviewedResult({...review,observedStat:0}),false);
 assert.equal(validReviewedResult({...review,evidence:{...review.evidence,started:true}}),false);
 const settledAt='2026-11-03T06:00:00Z';
 const leg={gameId:review.gameId,label:review.label,result:'miss',verifiedAt:settledAt,observedStat:0,observedUnit:'Fouls committed'};
 const ticket={result:'miss',settledAt,legs:[leg,{result:'hit'},{result:'hit'},{result:'hit'}]};
 const key='1|player one 1 foul committed';
 applyReviewedResults(ticket,new Map([[key,{...review,verifiedAt:'2026-11-03T05:00:00Z'}]]));
 assert.equal(ticket.result,'miss');
 const reviews=new Map([[key,review]]);
 applyReviewedResults(ticket,reviews);
 assert.equal(ticket.result,'hit');
 assert.equal(ticket.settledAt,review.verifiedAt);
 assert.equal(leg.voidReason,'did_not_start');
 assert.equal(leg.observedStat,undefined);
 assert.equal(leg.observedUnit,undefined);
 const corrected=structuredClone(ticket);
 applyReviewedResults(ticket,reviews);
 assert.deepEqual(ticket,corrected);
});
test('full-time goal observations never masquerade as a half or player stat',()=>{
 const event={completed:true,home:'Home',away:'Away',hs:2,as:0};
 assert.equal(scoreObservation(leg('Over 1.5 Goals'),event).observed,2);
 assert.equal(scoreObservation(leg('Home 1+ Goal'),event).observed,2);
 assert.equal(scoreObservation(leg('Away 1+ Goal'),event).observed,0);
 assert.equal(scoreObservation(leg('Player 1+ Goal'),event),null);
 assert.equal(scoreObservation(leg('1st Half Over 0.5 Goals'),event),null);
});
test('prop rows display actual zero/count/unit, never substitute a final score',()=>{
 const context=vm.createContext({Intl,Date,Map,Set,Object,console});vm.runInContext(fs.readFileSync('assets/hit-rate.js','utf8'),context);
 const display=l=>context.FootyEdgeHitRate.legValue(l),pending={label:'Player 2+ Tackles',result:'pending',finalScore:'3-1'};
 assert.equal(display(pending).value,'—');assert.equal(display(pending).detail,'Awaiting stat');
 assert.equal(display({...pending,observedStat:null}).value,'—');
 assert.equal(display({...pending,observedStat:0,observedUnit:'Tackles',result:'miss'}).value,'0');
 assert.equal(display({...pending,observedStat:3,observedUnit:'Tackles',result:'hit'}).detail,'Tackles');
 const voided=display({...pending,result:'push',voidReason:'did_not_start'});
 assert.equal(voided.value,'Void');assert.equal(voided.detail,'Did not start');
 assert.equal(display({label:'1st Half 4+ Corners',finalScore:'2-0'}).value,'—');
 assert.equal(display({label:'Home ML',finalScore:'2-0'}).value,'2–0');
 assert.equal(display({label:'Over 1.5 Goals',finalScore:'Home 2-0 Away'}).value,'2');
 assert.equal(display({selection:'Home 1+ Goal',home:'Home',away:'Away',finalScore:'Home 2-0 Away'}).value,'2');
 assert.equal(display({label:'Player 1+ Goal',fixture:'Home vs Away',finalScore:'2-0'}).value,'—');
});
