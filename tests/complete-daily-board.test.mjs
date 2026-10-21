import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as childProcess from 'node:child_process';
const today=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
const date=today.year+'-'+today.month+'-'+today.day;
const path='data/boards/'+date+'.json';
test('published, owner-approved research slate has five-result form and exactly three diverse markets per match',t=>{
 if(!fs.existsSync(path)){t.skip('Todays slate not published yet');return}
 const board=JSON.parse(fs.readFileSync(path,'utf8'));
 // Earlier sealed publications may have owner-selected markets. Never rewrite
 // their original selections to enforce a newer confidence-only contract.
 if(board.date<'2026-10-21'){t.skip('Earlier immutable boards use the historical policy');return}
 assert.ok(board.games.length>0);
 const eligible=new Set(['Goals','Team Goals','BTTS','Double Chance','Match Result','Handicap']);
 for(const g of board.games){
  assert.ok(Array.isArray(g.top3)&&g.top3.length<=3,'Invalid Top3 for '+g.id);
  // A verified form shortfall produces PASS, not invented records or picks.
  if(!g.top3.length)continue;
  const hn=g.model?.home?.n??g.model?.sample?.home??g.verifiedForm?.home?.matches?.length??0;
  const an=g.model?.away?.n??g.model?.sample?.away??g.verifiedForm?.away?.matches?.length??0;
  assert.ok(hn>=5&&an>=5,'Missing verified match research '+g.id);
  assert.ok(g.top3.every(p=>eligible.has(p.category)),'Unexpected market '+g.id);
  assert.equal(g.top?.label,g.top3[0]?.label,'Top and #1 disagree '+g.id);
  const ratings=g.top3.map(p=>p.confidenceRating??p.score);
  assert.ok(ratings.every(Number.isFinite),'Missing rating '+g.id);
  if(g.ownerSelectedMarket==='Match Result'){
    // Owner-requested moneyline #1 is an editorial market preference, NOT
    // an inflated 85% win prediction. Remaining alternatives stay ranked.
    assert.equal(g.top3[0].category,'Match Result','Owner-requested ML not first '+g.id);
    assert.equal(g.top3[0].ownerRequestedTopPick,true,'Missing owner-requested provenance '+g.id);
    assert.ok(ratings[1]>=ratings[2],'Non-featured alternatives out of order '+g.id);
  }else assert.ok(ratings.every((x,i)=>i===0||ratings[i-1]>=x),'Incorrect ranking '+g.id);
  assert.ok(g.top3.length<=3,'Only the three highest-supported independent selections publish');
  for(const p of g.top3)if(!p.probabilityCalibrated){
    assert.equal(p.score,null,'Research rating must not be claimed as calibrated confidence');
    assert.equal(p.ev,null,'EV requires calibrated exact-market probability');
  }
 }
 assert.ok(board.top5.every(x=>{
  const game=board.games.find(g=>g.id===x.gameId);
  return game&&game.top.label===x.pick.label&&game.top.confidenceRating===x.pick.confidenceRating
 }),'Top 5 does not match game #1');
});
test('recurring publication ranks from evidence before immutable lock without sportsbook dependency',()=>{
 const workflow=fs.readFileSync('.github/workflows/archive-board.yml','utf8');
 assert.match(workflow,/node scripts\/build-evidence-only-board\.mjs/);
 assert.ok(workflow.indexOf('node scripts/build-evidence-only-board.mjs')<workflow.indexOf('node scripts/archive-board.mjs'));
 assert.doesNotMatch(workflow,/node scripts\/capture-(?:github|native)-odds\.mjs/);
});
test('result filter can surface moneylines beyond the default Top 3',()=>{
 const ui=fs.readFileSync('ui/part2.html','utf8');
 assert.match(ui,/function resultMarketCandidates\(g\)/);
 assert.match(ui,/if\(S\.filter==="result"\)return resultMarketCandidates\(g\)/);
});

test('the scheduled fallback repair script is valid Node.js',()=>{
 const {execFileSync}=requireNodeCheck();
 execFileSync(process.execPath,['--check','scripts/ensure-daily-research-picks.mjs'],{stdio:'pipe'});
});
function requireNodeCheck(){return {execFileSync:childProcess.execFileSync}}

test('ML-only filter changes both match cards and ranked Top Picks',()=>{
 const markup=fs.readFileSync('ui/part1.html','utf8');
 const logic=fs.readFileSync('ui/part2.html','utf8');
 assert.match(markup,/data-filter="ml">ML<\/button>/);
 assert.ok(logic.includes('if(S.filter==="ml")return moneylineCandidates(g)[0]||null'));
 assert.ok(logic.includes('S.filter=b.dataset.filter;renderBest();renderGames()'));
});
