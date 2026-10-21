import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAsianFeed} from '../scripts/sync-asia-research.mjs';
const date='2026-10-21';
const g=(id)=>({league_id:id,provider_id:'fixture-'+id,source_url:'https://licensed.example/match/'+id,kickoff:'2026-10-21T10:00:00Z',
 team_home:{id:101,name:'Home Club'},team_away:{id:102,name:'Away Club'},
 recent_results:{home:[{id:'r1',date:'2026-10-11',goals_for:2,goals_against:1,venue:'home',opponent:'Other'}],
 away:[{id:'r2',date:'2026-10-12',goals_for:0,goals_against:1,venue:'away',opponent:'Other'}]},
 h2h:[{date:'2026-10-01',goals_home:1,goals_away:1}],
 team_metrics:{home:{xg_per_match:1.4},away:{shots_per_match:11.2}},
 team_news:[{side:'home',headline:'Defender suspended',source_url:'https://official.example/statement',confirmed:true}]
});
const pack=(matches)=>({date,rights:{authorized:true,license:'contracted',permission_reference:'written-consent'},matches});
test('Both men’s Asian leagues appear without fabricated stats',()=>{
 const x=normalizeAsianFeed(pack([g(223),g(9080)]),date);
 assert.deepEqual(x.fixtures.map(f=>f.league),['jpn.1','kor.1']);
 assert.equal(x.fixtures[0].h2h.length,1);
 assert.equal(x.fixtures[1].teamNews[0].verified,true);
 assert.equal(x.fixtures[0].last10.home[0].result,'W');
 assert.equal(x.fixtures[0].teamMetrics.home.xg_per_match,1.4);
});
test('Unlicensed provider and unsupported competition are rejected',()=>{
 assert.throws(()=>normalizeAsianFeed({...pack([g(223)]),rights:{authorized:false}},date));
 assert.throws(()=>normalizeAsianFeed(pack([g(9999)]),date));
});
test('Future scores and implausible metrics are rejected',()=>{
 const e=g(223);e.recent_results.home[0].date=date;
 assert.throws(()=>normalizeAsianFeed(pack([e]),date));
 e.recent_results.home[0].date='2026-10-11';e.team_metrics.home.xg_per_match=1200;
 assert.throws(()=>normalizeAsianFeed(pack([e]),date));
});
test('Unknown source metrics are not invented',()=>{
 const e=g(223);e.team_metrics.home={imaginary:4};
 assert.deepEqual(normalizeAsianFeed(pack([e]),date).fixtures[0].teamMetrics.home,{});
});
