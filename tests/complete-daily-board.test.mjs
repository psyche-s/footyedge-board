import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const today=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
const date=today.year+'-'+today.month+'-'+today.day;
const path='data/boards/'+date+'.json';
test('published, owner-approved research slate has five-result form and exactly three diverse markets per match',t=>{
 if(!fs.existsSync(path)){t.skip('Todays slate not published yet');return}
 const board=JSON.parse(fs.readFileSync(path,'utf8'));
 if(board.date<'2026-10-17'){t.skip('Rule begins October 17');return}
 assert.ok(board.games.length>0);
 const eligible=new Set(['Goals','Team Goals','BTTS','Double Chance','Match Result']);
 for(const g of board.games){
  assert.equal(g.top3?.length,3,'Top3 missing for '+g.id);
  assert.ok((g.verifiedForm?.home?.matches||[]).length>=5,'Home last-five missing '+g.id);
  assert.ok((g.verifiedForm?.away?.matches||[]).length>=5,'Away last-five missing '+g.id);
  assert.ok(g.top3.every(p=>eligible.has(p.category)),'Unexpected market '+g.id);
  assert.equal(g.top?.label,g.top3[0]?.label,'Top and #1 disagree '+g.id);
  const ratings=g.top3.map(p=>p.confidenceRating??p.score);
  assert.ok(ratings.every(Number.isFinite),'Missing rating '+g.id);
  assert.ok(ratings[0]>=ratings[1]&&ratings[1]>=ratings[2],'Incorrect ranking '+g.id);
  assert.equal((g.model?.resultCandidates||[]).filter(p=>p.category==='Match Result').length,2,'Two moneylines must be evaluated '+g.id);
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
test('recurring publication restores form and ML candidates before locking',()=>{
 const workflow=fs.readFileSync('.github/workflows/archive-board.yml','utf8');
 assert.match(workflow,/node scripts\/ensure-daily-research-picks\.mjs/);
 assert.ok(workflow.indexOf('node scripts/ensure-daily-research-picks.mjs')<workflow.indexOf('node scripts/archive-board.mjs'));
});
test('result filter can surface moneylines beyond the default Top 3',()=>{
 const ui=fs.readFileSync('ui/part2.html','utf8');
 assert.match(ui,/function resultMarketCandidates\(g\)/);
 assert.match(ui,/if\(S\.filter==="result"\)return resultMarketCandidates\(g\)/);
});
