import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validateBoard} from '../scripts/validate-published-boards.mjs';
const html=['ui/part0.html','ui/part1.html','ui/part2.html'].map(f=>fs.readFileSync(f,'utf8')).join('');
const full=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
const code=full.slice(0,full.lastIndexOf('document.getElementById("prev").onclick'));
function context(search=""){
  const nodes=new Map(),element=()=>({innerHTML:'',textContent:'',classList:{contains:()=>false,toggle(){},add(){},remove(){}},style:{setProperty(){}},querySelectorAll:()=>[]});
  const ctx=vm.createContext({console,Intl,URL,URLSearchParams,Date,setTimeout:()=>0,clearTimeout(){},window:{location:{search}},document:{getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)},querySelectorAll:()=>[]},localStorage:{getItem:()=>null,setItem(){}},fetch:async()=>{throw new Error('Unexpected network/model call')}});
  vm.runInContext(fs.readFileSync('assets/board-availability.js','utf8'),ctx);vm.runInContext(code,ctx);return ctx;
}
const board=JSON.parse(fs.readFileSync('data/boards/2026-10-06.json','utf8'));
const input=board.games.map(g=>({id:g.id,date:g.date,league:g.league,leagueName:g.leagueName,home:{...g.teams.home,score:2},away:{...g.teams.away,score:0},done:true,model:{top:{label:'Recalculated replacement',score:99},top3:[{label:'Recalculated replacement',score:99}],candidates:[{label:'Player Anytime Goalscorer',category:'Player',score:99}]}}));
for(const day of ['2026-10-06','2026-10-07'])test('Published board locks all picks on '+day,()=>{
  const c=context();c.board=structuredClone(board);c.games=structuredClone(input);c.today=day;
  vm.runInContext('etDate=()=>today;S.date=board.date;S.archive=board;S.status="all";S.games=applyBoardArchive(games,board)',c);
  const top=JSON.parse(vm.runInContext('JSON.stringify(topPicks().map(g=>[g.home.name,g.archiveTopPick.label,g.archiveTopPick.score]))',c));
  assert.deepEqual(top,board.top5.map(x=>[x.home,x.pick.label,x.pick.score]));
  assert.equal(vm.runInContext('S.games[0].home.score',c),2,'scores can update');
  assert.equal(vm.runInContext('S.games.some(g=>g.model.candidates.some(p=>p.label==="Recalculated replacement"))',c),false);
  assert.equal(vm.runInContext('S.games.filter(g=>!g.model.top).every(g=>playerCandidates(g,"atgs").length===0)',c),true);
  assert.equal(vm.runInContext('JSON.stringify(window.FootyEdgeArchive())',c),JSON.stringify(board));
});
test('Published loader bypasses recalculation and works with feed unavailable',async()=>{
  const c=context();c.board=board;
  vm.runInContext('S.date=board.date;repoData=async path=>path.includes("data/boards/")?board:path.includes("scoreboard")?{events:[]}:null;json=async()=>{throw new Error("feed offline")};model=()=>{throw new Error("Model must not run")}',c);
  await vm.runInContext('load(S.date)',c);
  assert.equal(vm.runInContext('S.games.length',c),board.games.length);
  assert.equal(vm.runInContext('topPicks().length',c),5);
});
test('Absent snapshot cannot publish newly computed picks',async()=>{
  const c=context();vm.runInContext('S.date="2026-10-08";repoData=async()=>null;json=async()=>({events:[]});model=()=>{throw new Error("Model must not run")}',c);
  await vm.runInContext('load(S.date)',c);assert.equal(vm.runInContext('window.FootyEdgeArchive()',c),null);
});
test('Schema accepts preserved legacy partial history, requires complete new publication',()=>{
  const old=JSON.parse(fs.readFileSync('data/boards/2026-10-05.json','utf8'));validateBoard(old);validateBoard(board);
  assert.throws(()=>validateBoard(board,{requireFull:true}),/complete board/);
  assert.throws(()=>validateBoard({...board,immutable:false}),/immutable/);
  const changed=structuredClone(board);changed.top5[0].pick.label='Replacement';assert.throws(()=>validateBoard(changed),/disagrees/);
});
test('October 6 restore matches screenshot including ranks, odds and confidence',()=>{
  assert.deepEqual(board.top5.map(x=>[x.home,x.pick.label,x.pick.odds,x.pick.score]),[
    ['Switzerland','Under 3.5 Goals',-135,96],['Kazakhstan','Under 2.5 Goals',-185,96],['Albania','Under 4.5 Goals',-135,94],['Scotland','Under 2.5 Goals',-165,94],['Estonia','Estonia +0.5',130,93]
  ]);
});
test('Complete capture freezes alternatives and player filters independent of view',()=>{
  const c=context('?archiveCapture=1');
  c.p={label:'Under 2.5 Goals',category:'Goals',score:90,odds:-150,bookExact:true,verifiedPrice:true,archived:true,archivedCommentary:'Original',archivedSupportFacts:['Original fact']};
  c.q={...c.p,label:'Forward Anytime Goalscorer',category:'Player',score:88};
  vm.runInContext('S.date="2026-10-08";S.boardReady=true;S.games=[{id:"g1",date:"2026-10-08T18:00Z",home:{name:"A"},away:{name:"B"},league:"l1",model:{top:p,top3:[p,q],candidates:[p,q],researchCandidates:[q]}}];S.filter="atgs";S.league="other";S.status="live"',c);
  const frozen=JSON.parse(vm.runInContext('JSON.stringify(window.FootyEdgeArchive())',c));validateBoard(frozen,{requireFull:true});
  assert.equal(frozen.top5.length,1);assert.equal(frozen.games[0].model.candidates.length,2);
  c.frozen=frozen;vm.runInContext('S.archive=frozen;S.games=applyBoardArchive(S.games,frozen);S.games[0].dailyInsight={markets:[{label:"New Player Anytime Goalscorer",score:99}]};',c);
  assert.equal(vm.runInContext('playerCandidates(S.games[0],"atgs")[0].label',c),c.q.label);
  assert.equal(vm.runInContext('cardCommentary(S.games[0],S.games[0].model.top)',c),'Original');
});
test('Integrity rejects an unaudited overwrite',async()=>{
  const {validateIntegrity}=await import('../scripts/validate-published-boards.mjs');
  const file='data/boards/2026-10-06.json',saved=fs.readFileSync(file,'utf8');
  try{
    fs.writeFileSync(file,saved+' ');
    assert.throws(()=>validateIntegrity('HEAD'),/without preserved explicit owner correction/);
  }finally{fs.writeFileSync(file,saved)}
});
test('Tracking renders month and YTD separately with requested labels',()=>{
  const c=context();c.summary={month:{key:'2026-10',hits:7,misses:3,settled:10,hitRate:70},year:{key:'2026',hits:7,misses:3,settled:10,hitRate:70}};
  vm.runInContext('S.performance=summary;renderPerformance()',c);
  assert.equal(vm.runInContext('document.getElementById("perfMonthLabel").textContent',c),'Oct Tracking');
  assert.equal(vm.runInContext('document.getElementById("perfYearLabel").textContent',c),'2026 Tracking');
  assert.equal(vm.runInContext('document.getElementById("perfYearRate").textContent',c),'70% Hit Rate');
  assert.equal(vm.runInContext('document.getElementById("perfYearCount").textContent',c),'10 official picks tracked YTD');
});
