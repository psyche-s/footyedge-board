import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validatePublicMetrics} from '../scripts/validate-public-metrics.mjs';

const html=['ui/part0.html','ui/part1.html','ui/part2.html'].map(f=>fs.readFileSync(f,'utf8')).join('');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
const code=scripts.slice(0,scripts.lastIndexOf('document.getElementById("prev").onclick'));
const context=()=>{
  const node=()=>({innerHTML:'',textContent:'',classList:{contains:()=>false,toggle(){},add(){},remove(){}},style:{setProperty(){}},querySelectorAll:()=>[]});
  const nodes=new Map(),ctx=vm.createContext({console,Intl,URL,URLSearchParams,Date,setTimeout:()=>0,clearTimeout(){},window:{location:{search:''}},document:{getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},querySelectorAll:()=>[]},localStorage:{getItem:()=>null,setItem(){}},fetch:async()=>{throw Error('no network')}});
  vm.runInContext(fs.readFileSync('assets/board-availability.js','utf8'),ctx);vm.runInContext(code,ctx);return ctx;
};

test('renderer suppresses ungrounded EV while showing the confidence-only ranking grade',()=>{
  const c=context();
  for(const ev of [5.4,16.2,40.4,null,NaN]){
    c.pick={score:85,ev,modelProb:.85,priceDecimal:7.53,verifiedPrice:true,bookExact:true,probabilityCalibrated:false};
    assert.equal(vm.runInContext('priceInfo(pick).ev',c),'N/A');
    assert.equal(vm.runInContext('pickScoreValue(pick)',c),'85%');
  }
});

test('calibrated exact-market metrics use the required EV formula',()=>{
  const c=context();
  c.pick={score:60,modelProb:.6,priceDecimal:2,verifiedPrice:true,bookExact:true,probabilityCalibrated:true};
  assert.equal(vm.runInContext('priceInfo(pick).ev',c),'+20.0%');
  assert.equal(vm.runInContext('pickScoreValue(pick)',c),'60%');
  assert.doesNotThrow(()=>validatePublicMetrics({games:[{id:'g',top3:[c.pick]}]}));
});

test('validator rejects null/NaN/default confidence and extreme ungrounded EV',()=>{
  for(const pick of [
    {score:0,modelProb:null,ev:null,probabilityCalibrated:false},
    {score:null,modelProb:null,ev:5.4,probabilityCalibrated:false},
    {score:null,modelProb:null,ev:16.2,probabilityCalibrated:false},
    {score:null,modelProb:null,ev:40.4,probabilityCalibrated:false},
    {score:85,modelProb:NaN,ev:null,probabilityCalibrated:true}
  ])assert.throws(()=>validatePublicMetrics({games:[{id:'g',top3:[pick]}]}));
});

test('research ratings remain separate from confidence and EV',()=>{
  const pick={score:null,modelProb:null,probabilityCalibrated:false,confidenceRating:90,ev:null};
  assert.equal(validatePublicMetrics({games:[{id:'r1',top3:[pick]}]}),true);
  assert.equal(pick.score,null);
  assert.equal(pick.ev,null);
});
