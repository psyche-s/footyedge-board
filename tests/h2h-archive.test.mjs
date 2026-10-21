import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const src=fs.readFileSync("ui/part2.html","utf8");
const start=src.indexOf("function extractVerifiedH2H(g,payloads){");
const end=src.indexOf("\nasync function loadVerifiedMatchDetails(g){",start);
if(start<0||end<=start)throw Error("Published H2H parser missing");
const context={Date,Set,String,Number,Array,Math,scoreVal(x){const value=typeof x==="object"&&x?(x.value??x.displayValue):x;const n=Number(value);return Number.isFinite(n)?n:null}};
vm.createContext(context);vm.runInContext(src.slice(start,end),context);
const {extractVerifiedH2H,mergeVerifiedH2H}=context;
const fixture={id:"761863",date:"2026-10-14T23:30:00Z",home:{id:"193",name:"D.C. United"},away:{id:"190",name:"Red Bull New York"}};
const event=(id,date,h,a,score1,score2,status)=>({id,date,status,competitions:[{competitors:[
 {id:h==="D.C. United"?"193":"190",homeAway:"home",team:{displayName:h},score:score1==null?null:{value:score1}},
 {id:a==="D.C. United"?"193":"190",homeAway:"away",team:{displayName:a},score:score2==null?null:{value:score2}}
]}]});
test("schedule results with no event.status are recognized when both official scores exist",()=>{
 const feed={events:[event("727010","2025-05-24T23:30:00Z","D.C. United","Red Bull New York",0,2)]};
 const rows=extractVerifiedH2H(fixture,[feed]);
 assert.equal(rows.length,1);
 assert.equal(rows[0].awayScore,2);
});
test("retrieves last five H2Hs across seasons, newest first, without duplicates",()=>{
 const fixture2026={events:[event("761561","2026-04-22T23:30:00Z","Red Bull New York","D.C. United",4,4)]};
 const fixture2025={events:[
 event("727010","2025-05-24T23:30:00Z","D.C. United","Red Bull New York",0,2),
 event("726924","2025-04-19T23:30:00Z","Red Bull New York","D.C. United",1,2)
 ]};
 const fixture2024={events:[
 event("692889","2024-06-29T23:30:00Z","Red Bull New York","D.C. United",2,2),
 event("692775","2024-05-15T23:30:00Z","D.C. United","Red Bull New York",1,4)
 ]};
 const rows=extractVerifiedH2H(fixture,[fixture2026,fixture2025,fixture2024]);
 assert.equal(rows.length,5);
 assert.deepEqual(Array.from(rows,x=>x.id),["761561","727010","726924","692889","692775"]);
});
test("does not invent results when scheduled matches have no scores",()=>{
 const upcoming=event("pending","2026-10-10T20:00:00Z","D.C. United","Red Bull New York",null,null);
 assert.equal(extractVerifiedH2H(fixture,[{events:[upcoming]}]).length,0);
});
test("a single valid previous meeting stays one, even if the heading says last five available",()=>{
 const saved=[{date:"2025-01-21",home:"Slovan Bratislava",away:"VfB Stuttgart",homeScore:1,awayScore:3}];
 const newer=[{date:"2025-01-21T20:00:00Z",home:"Slovan Bratislava",away:"VfB Stuttgart",homeScore:1,awayScore:3}];
 assert.equal(mergeVerifiedH2H(saved,newer).length,1);
});
test("archived and next-day match details load real H2H without touching frozen picks",()=>{
 const part1=fs.readFileSync("ui/part1.html","utf8");
 assert.match(part1,/g\.matchDetailsRequested=false/);
 assert.doesNotMatch(src,/g\.matchH2H\.length===5\|\|S\.date!==etDate\(\)/);
 assert.match(src,/data\/h2h\//);
 assert.match(src,/Checking previous meetings/);
});

test("tomorrow's sourced H2H overlay is attached after draft and archive restore",()=>{
 assert.match(src,/attachSavedH2H\(S\.games\)/);
 assert.match(src,/data\/h2h\//);
 assert.match(src,/No verified previous meetings in the/);
 assert.match(src,/mergeVerifiedH2H\(game\.matchH2H\|\|game\.h2h\|\|\[\],before\)/);
});
