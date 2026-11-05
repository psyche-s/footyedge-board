import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const c=vm.createContext({Intl,Date,Map,Set});
vm.runInContext(fs.readFileSync("assets/board-availability.js","utf8"),c);
const h=c.FootyEdgeAvailability;
const event=id=>({id:"fixture"+id,uid:"s:600~l:"+id+"~e:fixture"+id,date:"2026-11-05T18:45:00Z",status:{type:{name:"STATUS_SCHEDULED"}}});
test("EFL Championship excluded, all three UEFA club competitions remain",()=>{
  assert.equal(h.eventsForDay({events:[event(3914)]},"2026-11-05").length,0);
  for(const code of [775,776,20296])assert.equal(h.eventsForDay({events:[event(code)]},"2026-11-05").length,1);
});
test("Daily research, picks, and SGP filter enforce the new competition scope",()=>{
  const research=fs.readFileSync("scripts/build-research-base.mjs","utf8");
  const board=fs.readFileSync("scripts/build-evidence-only-board.mjs","utf8");
  const slips=fs.readFileSync("scripts/build-daily-slips.mjs","utf8");
  const picks=fs.readFileSync("top-picks.html","utf8");
  assert.ok(!research.includes('"eng.1","eng.2"'));
  assert.ok(board.includes('research.fixtures.filter(f=>f.league!=="eng.2")'));
  assert.ok(!slips.includes('"eng.1","eng.2"'));
  const line=picks.split("\n").find(s=>s.includes("const FE_SGP_LEAGUES="));
  assert.ok(line.includes('"uefa.champions"')&&line.includes('"uefa.europa"')&&line.includes('"uefa.europa.conf"'));
  assert.ok(!line.includes('"eng.2"'));
});
