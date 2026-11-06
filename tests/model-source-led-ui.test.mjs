import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page=fs.readFileSync("ui/part2.html","utf8");
test("Fixtures page accepts both independent-publisher and date-matched model-reviewed source-led overlays",()=>{
 assert.match(page,/independentMarketPicks\.mode==='independent_publisher_market_tips'/);
 assert.match(page,/independentMarketPicks\.mode==='model_research_with_independent_editorial_crosschecks'/);
 assert.match(page,/const ownerModelOverlay=S\.sourceLed/);
 assert.match(page,/S\.reviewedTop3=ownerModelOverlay/);
 assert.match(page,/const activeReview=S\.reviewedTop3/);
 assert.match(page,/game\.feEditorialPicks=currentReview/);
});
test("November 6 does not claim any model-only market is an independent publisher tip",()=>{
 const doc=JSON.parse(fs.readFileSync("data/source-led/2026-11-06.json","utf8"));
 assert.equal(doc.totals.fixtures,12);
 assert.equal(doc.totals.three,12);
 assert.equal(doc.totals.independentlyExactMarketSupportedSelections,0);
 assert.equal(doc.matches.filter(m=>m.picks.length===3).length,12);
 assert.ok(doc.matches.every(m=>m.picks.every(p=>p.verifiedPrice===false&&p.probabilityCalibrated===false)));
 assert.ok(doc.matches.every(m=>m.picks.every(p=>!/WinDrawWin|Sports Mole|the_analyst/i.test(p.reason))));
});
