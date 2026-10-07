import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function context(){
  const c=vm.createContext({Intl,Date,Map,Set,Object,console});vm.runInContext(fs.readFileSync('assets/hit-rate.js','utf8'),c);return c;
}
const pick=(rank=1,result='hit')=>({rank,result,selection:'Under 3.5 Goals',home:'Switzerland',away:'North Macedonia',finalScore:'Switzerland 3-0 North Macedonia'});
test('Hit Rate retains the whole current month in newest-first date order',()=>{
  const h=context().FootyEdgeHitRate;
  const summary={monthDays:['2026-10-01','2026-09-30','2026-10-06','2026-10-08'].map(date=>({date,top5:[pick(2),pick(1)]}))};
  const days=h.monthDays(summary,'2026-10-07');
  assert.deepEqual(Array.from(days,x=>x.date),['2026-10-06','2026-10-01']);
  assert.deepEqual(Array.from(days[0].top5,x=>x.rank),[1,2]);
});
test('Month rollover clears October rows without changing saved history',()=>{
  const h=context().FootyEdgeHitRate,summary={monthDays:[{date:'2026-10-31',top5:[pick()]}]};
  const before=JSON.stringify(summary);
  assert.equal(h.monthDays(summary,'2026-11-01').length,0);assert.equal(JSON.stringify(summary),before);
  assert.equal(h.todayToronto(new Date('2026-11-01T03:30:00Z')),'2026-10-31');
  assert.equal(h.todayToronto(new Date('2026-11-01T04:00:00Z')),'2026-11-01');
});
test('History scores contain only the numeric score, with clear hit/miss marks',()=>{
  const h=context().FootyEdgeHitRate;
  const html=h.historyHtml([{date:'2026-10-06',top5:[pick(1),pick(2,'miss')]}]);
  assert.equal(h.scoreOnly('Switzerland 3-0 North Macedonia'),'3–0');
  assert.equal(h.scoreOnly('2-1'),'2–1');assert.equal(h.scoreOnly(null),'—');
  assert.match(html,/aria-label="Hit">✓/);assert.match(html,/aria-label="Miss">✕/);
  assert.match(html,/<td class="score">3–0<\/td>/);assert.doesNotMatch(html,/Switzerland 3-0 North Macedonia/);
  assert.match(html,/class="date">OCT 6, 2026/);assert.match(html,/<table class="results"/);
});
test('Month and YTD cards use real records and roll over independently',()=>{
  const c=context(),nodes=new Map();c.document={getElementById(id){if(!nodes.has(id))nodes.set(id,{});return nodes.get(id)}};
  const h=c.FootyEdgeHitRate,summary={monthDays:[{date:'2026-10-06',top5:[pick(),pick(2,'miss')]}],year:{key:'2026',hits:7,misses:3,settled:10,hitRate:70}};
  h.render(summary,'2026-10-07');assert.equal(nodes.get('monthRate').textContent,'50% Hit Rate');assert.equal(nodes.get('yearRate').textContent,'70% Hit Rate');
  h.render(summary,'2026-11-01');assert.equal(nodes.get('monthLabel').textContent,'Nov Tracking');assert.equal(nodes.get('monthRecord').textContent,'0–0');assert.equal(nodes.get('yearRecord').textContent,'7–3');
  assert.match(nodes.get('history').innerHTML,/No official picks tracked this month/);
});
test('All navigation places Hit Rate before About; Picks no longer contains tracking cards',()=>{
  for(const file of ['index.html','about.html','ui/part1.html','hit-rate.html']){
    const s=fs.readFileSync(file,'utf8');assert.ok(s.indexOf('href="/hit-rate.html"')<s.indexOf('href="/about.html"'),file);
  }
  assert.doesNotMatch(fs.readFileSync('ui/part1.html','utf8'),/<section class="performanceBar"/);
  assert.match(fs.readFileSync('index.html','utf8'),/id="yearHitRate"/);
});
test('Tracker exports every current-month day instead of only seven recent days',()=>{
  const source=fs.readFileSync('scripts/track-performance.mjs','utf8');
  const start=source.indexOf('function statsFromFiles'),end=source.indexOf('\nfunction publishedTop5');
  const c=vm.createContext({fs:{existsSync:()=>true,readdirSync:()=>Array.from({length:20},(_,i)=>'2026-10-'+String(i+1).padStart(2,'0')+'.json')},PERF_DIR:'data/performance',path:{join:(_,file)=>file},readJson:file=>({date:file.slice(0,10),top5:[pick()]}),addDays:()=> '2026-10-14',Date,norm:x=>x});
  vm.runInContext(source.slice(start,end),c);
  const summary=vm.runInContext('buildSummary("2026-10-20")',c);
  assert.equal(summary.monthDays.length,20);assert.equal(summary.monthDays.at(-1).date,'2026-10-01');
});
