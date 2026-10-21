import test from 'node:test';
import assert from 'node:assert/strict';
import {extractPreviousMeetings} from '../scripts/build-h2h-cache.mjs';
const fixture={id:'new',date:'2026-10-21T10:00:00Z',league:'jpn.1',home:{id:'7107',name:'Avispa Fukuoka'},away:{id:'7102',name:'Gamba Osaka'}};
const match=(id,date,home,away,hs,as)=>({id,date,competitions:[{competitors:[
 {id:home,homeAway:'home',team:{displayName:home==='7107'?'Avispa Fukuoka':'Gamba Osaka'},score:hs},
 {id:away,homeAway:'away',team:{displayName:away==='7107'?'Avispa Fukuoka':'Gamba Osaka'},score:as}
]}]});
test('Keep previous completed meetings, sort recent first, dedupe across sources',()=>{
 const a=match('a','2025-07-21T10:00:00Z','7107','7102',{value:2},{value:1});
 const b=match('b','2024-05-18T10:00:00Z','7102','7107',{value:0},{value:0});
 const r=extractPreviousMeetings(fixture,[{events:[b,a]},{events:[a]}],Date.parse('2026-10-20'));
 assert.deepEqual(r.map(x=>x.id),['a','b']);
 assert.equal(r[0].homeScore,2);assert.equal(r[1].awayScore,0);
});
test('Never accept other teams, incomplete scores, future results or fixtures without dates',()=>{
 const data=[match('other','2025-07-21T10:00:00Z','7107','99',2,1),
   match('incomplete','2025-07-21T10:00:00Z','7107','7102',null,1),
   match('future','2026-10-22T10:00:00Z','7107','7102',2,1),
   match('same','2026-10-21T10:00:00Z','7107','7102',3,0)];
 assert.equal(extractPreviousMeetings(fixture,[{events:data}],Date.parse('2026-10-20')).length,0);
});
test('Do not manufacture games when upstream schedule is empty',()=>{
 assert.deepEqual(extractPreviousMeetings(fixture,[{events:[]}]),[]);
});
test('Never accept an explicitly unfinished result',()=>{
 const m=match('x','2024-05-18T10:00:00Z','7107','7102',2,1);
 m.status={type:{completed:false}};
 assert.deepEqual(extractPreviousMeetings(fixture,[{events:[m]}]),[]);
});
