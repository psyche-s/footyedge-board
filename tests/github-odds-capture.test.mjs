import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {summarize} from '../scripts/capture-github-odds.mjs';
const event={
 id:'fixture-101',sport_key:'soccer_epl',sport_title:'EPL',
 commence_time:'2026-10-18T14:00:00Z',home_team:'Manchester City',away_team:'Ipswich Town',
 bookmakers:[
  {key:'fanduel',markets:[
   {key:'h2h',last_update:'2026-10-17T04:30:00Z',outcomes:[
    {name:'Manchester City',price:-350},{name:'Draw',price:480},{name:'Ipswich Town',price:860}]},
   {key:'totals',outcomes:[{name:'Over',point:2.5,price:-155},{name:'Under',point:2.5,price:+125}]}
  ]},
  {key:'draftkings',markets:[
   {key:'h2h',last_update:'2026-10-17T04:32:00Z',outcomes:[
    {name:'Manchester City',price:-365},{name:'Draw',price:490},{name:'Ipswich Town',price:910}]},
   {key:'totals',outcomes:[{name:'Over',point:2.5,price:-160},{name:'Under',point:2.5,price:+130}]}
  ]}
 ]};
test('three-way City ML uses DraftKings and keeps draw risk',()=>{
 const d=summarize(event,'eng.1','2026-10-17T04:34:00Z');
 assert.equal(d.homeML,-365);
 assert.equal(d.drawML,490);
 assert.equal(d.awayML,910);
 assert.equal(d.mlBook?.key,'draftkings');
 assert.ok(Math.abs(d.probs.home+d.probs.draw+d.probs.away-1)<1e-10);
 assert.equal(d.quoteSource.vendor,'The Odds API');
 assert.ok(!('apiKey' in d));
});
test('separate totals price and bookmaker attribution, no invented spreads',()=>{
 const d=summarize(event,'eng.1','2026-10-17T04:34:00Z');
 assert.equal(d.over25,-160);assert.equal(d.under25,130);
 assert.equal(d.totals['2.5'].book.key,'draftkings');
 assert.deepEqual(d.spreads,[]);
});
test('incomplete soccer ML market remains unpriced, never turn home or draw into ML',()=>{
 const partial=structuredClone(event);
 partial.bookmakers.forEach(b=>b.markets[0].outcomes=b.markets[0].outcomes.filter(x=>x.name!=='Draw'));
 const d=summarize(partial,'eng.1','2026-10-17T04:34:00Z');
 assert.equal(d.homeML,null);assert.equal(d.drawML,null);
 assert.equal(d.mlBook,null);assert.equal(d.probs.home,null);
});
test('code must limit paid calls and avoid printing the key',()=>{
 const source=fs.readFileSync('scripts/capture-github-odds.mjs','utf8');
 assert.match(source,/ODDS_MAX_PAID_CALLS/);
 assert.match(source,/ODDS_MAX_CREDITS/);
 assert.match(source,/Existing verified same-day odds snapshot preserved/);
 assert.match(source,/Board already frozen; no extra paid calls/);
 assert.doesNotMatch(source,/console\.log\([^\n]*\bkey\b/);
});
