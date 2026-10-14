import test from 'node:test';
import assert from 'node:assert/strict';
import {rankPublishedBoard} from '../scripts/rank-published-picks.mjs';
const p=(label,score,opts={})=>({
 label,score,category:opts.category||'Goals',verifiedPrice:!!opts.verifiedPrice,
 odds:opts.odds??null,displayOdds:opts.odds??null,
 ev:opts.ev??null,modelProb:opts.modelProb??null,
 reason:opts.reason||'This market is supported by saved match research.'});
const game=(id,league,top3)=>({
 id:String(id),home:'Home '+id,away:'Away '+id,league,
 top3:[...top3],top:top3[0],model:{top3:[...top3],top:top3[0],candidates:[...top3]}});
test('a higher confidence unpriced market becomes #1 without borrowing ML odds',()=>{
 const ml=p('Away ML',63,{category:'Match Result',verifiedPrice:true,odds:'-371',ev:-.2,modelProb:.63});
 const total=p('Over 1.5 Goals',79),btts=p('BTTS Yes',59);
 const board={games:[game('lask','uefa.champions',[ml,total,btts])],sourceQuality:{}};
 const r=rankPublishedBoard(board,{minimumTop5Confidence:70});
 assert.equal(r.correctedMatches,1);
 const g=board.games[0];
 assert.deepEqual(g.top3.map(x=>x.score),[79,63,59]);
 assert.equal(g.top.label,'Over 1.5 Goals');
 assert.equal(g.model.top.label,g.top.label);
 assert.equal(g.top3[0].odds,null);
 assert.equal(g.top3[0].ev,null);
 assert.equal(g.top3[1].odds,'-371');
 assert.equal(g.top3[1].ev,-.2);
 assert.equal(board.top5[0].pick.label,g.top.label);
});
test('confidence beats pricing; equal scores use verified pricing as a tie break',()=>{
 const board={sourceQuality:{},games:[game('tie','usa.1',[
 p('Unpriced',88),p('Priced',88,{verifiedPrice:true,odds:'-200',ev:-.01}),p('Third',80)
 ])]};
 rankPublishedBoard(board,{minimumTop5Confidence:85});
 assert.deepEqual(board.games[0].top3.map(x=>x.label),['Priced','Unpriced','Third']);
 assert.equal(board.top5[0].pick.label,'Priced');
});
test('Top 5 and league Top 5 mirror the highest-score #1 of each game',()=>{
 const board={sourceQuality:{},games:[
 game('a','usa.1',[p('ML a',60),p('Goals a',91),p('BTTS a',50)]),
 game('b','uefa.champions',[p('ML b',70),p('Goals b',88),p('BTTS b',51)]),
 game('c','uefa.champions',[p('ML c',86),p('Goals c',72),p('BTTS c',55)]),
 game('d','usa.1',[p('ML d',80),p('Goals d',62),p('BTTS d',50)])
 ]};
 rankPublishedBoard(board);
 assert.deepEqual(board.top5.map(x=>x.pick.score),[91,88,86]);
 assert.equal(board.leagueTop5['usa.1'].length,1);
 assert.deepEqual(board.leagueTop5['uefa.champions'].map(x=>x.pick.score),[88,86]);
 for(const ref of board.top5){
  const g=board.games.find(x=>x.id===ref.gameId);
  assert.equal(ref.pick.label,g.top3[0].label);
 }
 const previous=JSON.stringify(board);
 rankPublishedBoard(board);
 assert.equal(JSON.stringify(board),previous,'repeat ranking is deterministic');
});
