import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('assets/board-availability.js','utf8');
function helper(){const c=vm.createContext({Intl,Date,Map,Set});vm.runInContext(source,c);return c.FootyEdgeAvailability}
const event=(date,id='g1',league=700)=>({id,date,uid:'s:600~l:'+league+'~e:'+id,status:{type:{name:'STATUS_SCHEDULED'}}});
test('A verified empty day names the first future game on both pages',async()=>{
  const h=helper();const read=async url=>({events:url.includes('20261009')?[event('2026-10-09T18:00:00Z')]:[]});
  const info=await h.load('2026-10-07',read);
  assert.equal(info.kind,'empty');assert.equal(info.nextGameDate,'2026-10-09');
  assert.equal(h.message(info,true),'No games today. Next game on Oct 9, 2026.');
  assert.equal(h.message(info,false),'No games on Oct 7, 2026. Next game on Oct 9, 2026.');
});
test('Scheduled matches without odds are games awaiting publication',async()=>{
  const h=helper();const info=await h.load('2026-10-10',async()=>({events:[event('2026-10-10T14:00:00Z')]}));
  assert.equal(info.kind,'games');assert.equal(info.count,1);
  assert.equal(h.message(info,true),'Today’s picks have not been published yet.');
  assert.equal(h.leagueOf(event('2026-10-09T18:30:00Z','g2',720)),'ger.1');
  assert.equal(h.leagueOf(event('2026-10-07T15:00:00Z','g3',3923)),'fifa.friendly');
});
test('Failed and restricted schedule responses cannot claim no games',async()=>{
  for(const read of [async()=>{throw new Error('offline')},async()=>({errors:{plan:'restricted'}})]){
    const h=helper();const info=await h.load('2026-10-07',read);
    assert.equal(info.kind,'unavailable');assert.match(h.message(info,true),/schedule unavailable/);
  }
});
test('A missing earlier future schedule cannot make a later game the next game',async()=>{
  const h=helper();const info=await h.load('2026-10-07',async url=>{
    if(url.includes('20261009'))throw new Error('offline');
    return {events:url.includes('20261010')?[event('2026-10-10T14:00Z')]:[]};
  });
  assert.equal(info.kind,'empty');assert.equal(info.nextGameDate,null);assert.equal(info.searchComplete,false);
});
test('After-midnight UTC fixtures belong to the Toronto calendar date',async()=>{
  const h=helper();const info=await h.load('2026-10-07',async url=>({events:url.includes('20261008')?[event('2026-10-08T01:30Z')]:[]}));
  assert.equal(info.kind,'games');assert.equal(info.date,'2026-10-07');
});
test('Home and Picks load the same availability helper',()=>{
  for(const file of ['index.html','ui/part1.html'])assert.match(fs.readFileSync(file,'utf8'),/assets\/board-availability\.js/);
  assert.match(fs.readFileSync('ui/part2.html','utf8'),/FootyEdgeAvailability.message/);
});
test('Football provider errors use the existing ESPN fallback',async()=>{
  const c=vm.createContext({console,URLSearchParams,Number,String,Boolean,Object,Array,Date,Math,process:{env:{FOOTBALL:'test-key'}},fetch:async url=>({status:200,ok:true,json:async()=>String(url).includes('api-sports')?{errors:{access:'suspended'},response:[]}:{events:[]}})});
  vm.runInContext(source,c);
  vm.runInContext(fs.readFileSync('api/football.js','utf8').replace(/^import .*\n/,'').replace('export default async function handler','async function handler'),c);
  const result={};c.req={query:{endpoint:'fixtures',date:'2026-10-07'}};c.res={status(n){result.status=n;return this},setHeader(){},json(x){result.body=x}};
  await vm.runInContext('handler(req,res)',c);
  assert.equal(result.body._footyedgeFallback,'ESPN');assert.equal(result.status,200);
});
