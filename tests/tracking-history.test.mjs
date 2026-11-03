import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {buildHistory} from '../scripts/build-hit-rate-history.mjs';
import {sourceFor,ticketsOf,needsLegResults,scoreLeg,playerStatResult,settleTicket} from '../scripts/track-slip-performance.mjs';
const leg=(gameId='1',result='pending')=>({gameId,fixture:'Home vs Away',league:'eng.1',label:'Over 1.5 Goals',category:'Goals',kickoff:'2026-11-02T20:00:00Z',result});
const ticket=(id,result='pending')=>({id,type:'acca',result,legs:[leg('1',result),leg('2',result)]});
const top5=result=>({rank:1,gameId:'1',home:'Home',away:'Away',selection:'Over 1.5 Goals',result,finalScore:result==='pending'?null:'Home 2-1 Away'});
test('tracking uses the reviewed desk actually displayed on Top Picks, including the current day',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'footyedge-tracking-'));
 try{
  for(const kind of ['boards','slips-reviewed','editorial-desk'])fs.mkdirSync(path.join(root,'data',kind),{recursive:true});
  const save=(kind,d)=>fs.writeFileSync(path.join(root,'data',kind,'2026-11-02.json'),JSON.stringify(d));
  save('boards',{});save('editorial-desk',{date:'2026-11-02',sgp:{status:'pass',legs:[]}});
  const sgp={status:'qualified',league:'eng.1',combinedReferenceAmerican:253,legs:[leg()]};
  save('slips-reviewed',{date:'2026-11-02',sgp,sgpsByLeague:[sgp]});
  const source=sourceFor('2026-11-02',root);assert.match(source.path,/slips-reviewed/);
  const captured=ticketsOf(source.data);assert.equal(captured[0].combinedReferenceAmerican,253);assert.equal(captured[0].legs[0].kickoff,'2026-11-02T20:00:00Z');assert.equal(captured[1].duplicateOf,'sgp');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('daily history includes posted Top 5, distinct slips and unpriced candidates with separate denominators',()=>{
 const first=ticket('first','hit'),duplicate={...first,id:'duplicate',duplicateOf:'first'};
 const desk={date:'2026-11-02',acca:{status:'hold',legs:[leg('3'),leg('4')]},sgpsByLeague:[{league:'fra.1',status:'hold',legs:[leg('5')]}]};
 const held=ticketsOf(desk);
 assert.equal(held.find(t=>t.type==='acca').trackable,false);
 const settled={...held.find(t=>t.league==='fra.1'),result:'miss',legs:[leg('5','miss')]};
 const result=buildHistory({date:'2026-11-02',performanceDays:[{date:'2026-11-01',top5:[top5('hit'),{...top5('miss'),rank:2}]},{date:'2026-11-02',top5:[top5('pending')]},{date:'2026-10-31',top5:[top5('miss')]}],slipDays:[{date:'2026-11-01',tickets:[first,duplicate]},{date:'2026-11-02',tickets:[ticket('today'),settled]}],candidates:[desk]});
 assert.deepEqual(result.days.map(d=>d.date),['2026-11-02','2026-11-01']);assert.equal(result.days[1].tickets.length,1);
 assert.deepEqual(result.days[0].tickets.map(t=>[t.id,t.trackable,t.result]),[
  ['today',true,'pending'],['candidate:fra.1',false,'miss'],['candidate:acca',false,'pending']
 ]);
 assert.equal(result.slips.month.hits,1);assert.equal(result.slips.month.pending,1);assert.equal(result.slips.month.hitRate,100);
 assert.equal(result.slips.month.misses,0);
 assert.equal(result.top5.month.hits,1);assert.equal(result.top5.month.misses,1);assert.equal(result.top5.month.pending,1);assert.equal(result.top5.month.hitRate,50);
 assert.equal(result.top5.year.misses,2);
});
test('lost slips still need remaining leg results, and full-time scores cannot settle half-specific props',()=>{
 const t={result:'miss',legs:[leg('1','miss'),leg('2','pending')]};assert.equal(needsLegResults(t),true);assert.equal(settleTicket(t.legs),'miss');
 const final={home:'Home',away:'Away',hs:2,as:0,completed:true};
 assert.equal(scoreLeg({label:'1st Half Over 0.5 Goals'},final),'pending');assert.equal(scoreLeg({label:'2nd Half Over 0.5 Goals'},final),'pending');
 assert.equal(scoreLeg({label:'Over 1.5 Goals'},final),'hit');
 const recent=[{date:'2026-11-01',opponent:'Away',tackles:1,yellowCards:0}];
 assert.equal(playerStatResult({label:'Player 2+ Tackles'},recent,'Away','2026-11-01').result,'miss');
 assert.equal(playerStatResult({label:'Player 1+ Yellow Card'},recent,'Away','2026-11-01').result,'miss');
 assert.equal(playerStatResult({label:'Player 2+ Tackles'},[{...recent[0],tackles:null}],'Away','2026-11-01'),null);
 assert.equal(playerStatResult({label:'Player 2+ Tackles'},[{...recent[0],minutes:0,tackles:0}],'Away','2026-11-01'),null);
});
test('the carousel renders whole-slip loss independently of pending legs and escapes source text',()=>{
 const context=vm.createContext({Intl,Date,Map,Set,Object,console});vm.runInContext(fs.readFileSync('assets/hit-rate.js','utf8'),context);
 const day={date:'2026-11-01',top5:[top5('hit')],tickets:[{...ticket('lost','miss'),legs:[leg('1','miss'),{...leg('2'),label:'<img src=x onerror=alert(1)>'}]}]};
 const html=context.FootyEdgeHitRate.historyHtml([day]);
 assert.match(html,/DIDN’T LAND/);assert.match(html,/1 miss · 1 pending/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img src=x/);
 assert.equal((html.match(/class="railDot(?: active)?"/g)||[]).length,2);assert.match(html,/Next card for NOV 1, 2026/);
 const held=context.FootyEdgeHitRate.slipCard({...ticket('held'),trackable:false},'2026-11-02');assert.match(held,/PRICE PENDING/);assert.match(held,/Not included in the slip hit rate/);
 assert.match(held,/Matchday ACCA/);
 const settledHold=context.FootyEdgeHitRate.slipCard({...ticket('held','miss'),trackable:false},'2026-11-02');
 assert.match(settledHold,/DIDN’T LAND/);assert.match(settledHold,/2 miss · Not included in the slip hit rate/);
});
test('publication snapshots current-day picks after archiving them and builds the carousel feed in the same refresh',()=>{
 const workflow=fs.readFileSync('.github/workflows/archive-board.yml','utf8'),start=workflow.indexOf('- name: Capture posted Top 5 and slips');
 assert.ok(start>workflow.indexOf('run: node scripts/archive-board.mjs'));
 const step=workflow.slice(start,workflow.indexOf('\n      - name:',start+10));
 assert.match(step,/TRACK_SINCE="\$TODAY" node scripts\/track-performance\.mjs/);assert.match(step,/node scripts\/track-slip-performance\.mjs/);assert.match(step,/node scripts\/build-hit-rate-history\.mjs/);
});
