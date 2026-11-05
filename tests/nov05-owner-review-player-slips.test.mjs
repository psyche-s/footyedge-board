import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const day="2026-11-05";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const owner=read("data/owner-reviews/"+day+".json");
const goals=read("data/player-goal-slips/"+day+".json");
test("All 38 non-Championship fixtures have 3 original dated editorial picks",()=>{
 assert.equal(owner.date,day);assert.equal(owner.editorialRankingApproved,true);
 assert.equal(owner.matches.length,38);
 assert.ok(owner.matches.every(x=>x.picks.length===3&&x.picks.map(p=>p.rank).join(",")==="1,2,3"&&x.league!=="eng.2"));
 assert.ok(owner.matches.every(x=>x.picks.every(p=>p.reason.length>=60&&p.sourceBackedReason&&p.verifiedPrice===false&&p.probabilityCalibrated===false)));
 assert.ok(owner.totals.primaryML>owner.totals.primaryDC);
});
test("Moneyline first for decisive opponents while balanced fixtures retain draw protection",()=>{
 const row=id=>owner.matches.find(x=>x.gameId===id).picks[0].label;
 assert.equal(row("401915525"),"Benfica ML");
 assert.equal(row("401915528"),"AFC Bournemouth ML");
 assert.equal(row("401900870"),"Al Qadsiah ML");
 assert.equal(row("401915534"),"Ferencvaros or Draw");
});
test("Player scoring and goal-contribution slips have source-specific predicted XI safeguards, not invented prices",()=>{
 assert.equal(goals.slips.length,2);
 for(const slip of goals.slips){assert.equal(slip.status,"hold");assert.ok(slip.legs.length>=3);assert.ok(slip.legs.every(x=>x.lineupSource.startsWith("https://")&&x.playerEvidenceSource.startsWith("https://")&&x.projectedStartingXI&&x.officiallyConfirmedStartingXI===false&&x.odds===null&&x.gradeNotHitProbability));}
 const page=fs.readFileSync("top-picks.html","utf8");
 assert.match(page,/id="atgsResearchSlip"/);assert.match(page,/id="scoreAssistResearchSlip"/);
});
