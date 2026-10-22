import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const src=fs.readFileSync("ui/part2.html","utf8");
const data=JSON.parse(fs.readFileSync("data/team-intelligence/2026-10-22.json","utf8"));
const board=JSON.parse(fs.readFileSync("data/boards/2026-10-22.json","utf8"));
const match=src.match(/function feVerifiedLineupRows\(payload,date\)\{[\s\S]*?\n    \}/);
assert.ok(match,"Lineup adapter must exist");
const accept=new Function(match[0]+"\nreturn feVerifiedLineupRows;")();

test("all dated October 22 predicted XIs connect by fixture ID despite omitted child date",()=>{
 const rows=accept(data,"2026-10-22");
 assert.equal(rows.length,39);
 const index=new Map(rows.map(x=>[String(x.fixtureId),x]));
 for(const fixture of board.games){
   const item=index.get(String(fixture.id));
   assert.ok(item,fixture.home+" vs "+fixture.away);
   assert.equal(item.home.predictedXI.length,11);
   assert.equal(item.away.predictedXI.length,11);
 }
});
test("stale or partial lineup data is rejected instead of claiming confirmed starters",()=>{
 assert.deepEqual(accept(data,"2026-10-23"),[]);
 assert.equal(accept({...data,fixtures:[{...data.fixtures[0],date:"2026-10-21"}]},data.date).length,0);
 assert.equal(accept({...data,fixtures:[{...data.fixtures[0],source:{url:"javascript:wrong"}}]},data.date).length,0);
 assert.equal(accept({...data,fixtures:[{...data.fixtures[0],home:{...data.fixtures[0].home,predictedXI:["One"]}}]},data.date).length,0);
});
test("fixture pitch reads attached XIs and still accepts supported one-to-three picks",()=>{
 assert.match(src,/game\.teamIntel=verifiedXI&&normName\(verifiedXI\.home\?\.name\)/);
 assert.match(src,/const raw=g\.liveIntel\|\|g\.teamIntel/);
 assert.match(src,/function feTeamPitchRows\(x,t,g,position\)/);
 assert.match(src,/x\.picks\.length>=1&&x\.picks\.length<=3/);
 assert.match(src,/PREVIOUS XI · NOT CONFIRMED/);
 assert.match(fs.readFileSync("picks.html","utf8"),/ui\/part2\.html\?v=135/);
});
