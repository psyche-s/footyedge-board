import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const first=fs.readFileSync('ui/part1.html','utf8'),last=fs.readFileSync('ui/part2.html','utf8');
const combined=first+last;
test('FootyEdge loader fetches local published board before remote GitHub',()=>{
 const pos=last.indexOf('async function repoData(path){');
 const code=last.slice(pos,last.indexOf('\nfunction renderMeta(){',pos));
 assert.match(code,/await json\("\/"\+path/);
 assert.ok(code.indexOf('await json("/"+path')<code.indexOf('raw.githubusercontent.com'));
});
test('Live API requests are bounded and always clear abort timers',()=>{
 const pos=first.indexOf('async function json(url){');
 const code=first.slice(pos,first.indexOf('\nfunction leagueOf(',pos));
 assert.match(code,/new AbortController\(\)/);
 assert.match(code,/setTimeout\(\(\)=>controller\.abort\(\),8000\)/);
 assert.match(code,/finally\{clearTimeout\(timeout\)\}/);
});
test('Missing live data never leaves a permanent spinner and has a retry',()=>{
 const load=last.slice(last.indexOf('async function load(date=S.date){'));
 assert.match(load,/const loadingWatchdog=setTimeout/);
 assert.match(load,/11200/);
 assert.match(load,/board\.innerHTML/);
 assert.match(load,/onclick="load\(S.date\)"/);
 assert.match(load,/finally\{clearTimeout\(loadingWatchdog\)\}/);
});
test('Combined fixture inline JavaScript parses in one script context',()=>{
 const code=[...combined.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
 assert.doesNotThrow(()=>new vm.Script(code));
});