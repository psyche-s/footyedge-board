import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const source=readFileSync(new URL("../scripts/track-performance.mjs",import.meta.url),"utf8");
const between=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b));
const helpers=between("function eventInfo(e){","async function verifiedScoreboardFor(date){")
 + between("function settlePick(p,event){","async function settleDailyFile(file){");
const api=runInNewContext('const norm=v=>String(v||"").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();\n'
 +helpers+'\n({eventInfo,settlePick})', {Number,String,Boolean});

test("numeric string and ESPN score objects are graded only at full time",()=>{
 const event={status:{type:{completed:true}},competitions:[{competitors:[
 {homeAway:"home",team:{displayName:"Nashville SC"},score:{value:4,displayValue:"4"}},
 {homeAway:"away",team:{displayName:"Sporting Kansas City"},score:"0"}]}]};
 const val=api.eventInfo(event);
 assert.equal(val.done,true);assert.equal(val.homeScore,4);assert.equal(val.awayScore,0);
 const pre={...event,status:{type:{completed:false,state:"pre"}}};
 const unsettled=api.settlePick({selection:"Over 1.5 Goals",category:"Goals"},api.eventInfo(pre));
 assert.equal(unsettled.result,"pending");
});
test("team-goal totals are not mistakenly graded as full-match totals",()=>{
 const e={done:true,home:"Nashville SC",away:"Sporting Kansas City",homeScore:1,awayScore:3};
 assert.equal(api.settlePick({selection:"Nashville SC Over 0.5 Team Goals",category:"Team Goals"},e).result,"hit");
 assert.equal(api.settlePick({selection:"Nashville SC Over 1.5 Team Goals",category:"Team Goals"},e).result,"miss");
 assert.equal(api.settlePick({selection:"Nashville SC Under 1.5 Team Goals",category:"Team Goals"},e).result,"hit");
 assert.equal(api.settlePick({selection:"Over 1.5 Goals",category:"Goals"},e).result,"hit");
 assert.equal(api.settlePick({selection:"St. Louis CITY SC 1+ Goal",category:"Team Goals"}, {...e,home:"St. Louis CITY SC"}).result,"hit");
});
