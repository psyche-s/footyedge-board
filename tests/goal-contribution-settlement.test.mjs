import test from "node:test";import assert from "node:assert/strict";
import {parseGoalContributionMarket,playerResearchTicketsOf,summaryLegOutcome,scoreLeg,settleTicket,ticketsOf} from "../scripts/track-slip-performance.mjs";
const fixture={id:"401915525",home:"Benfica",away:"Lech Poznan",hs:3,as:1,completed:true};
const summary=(goals,assists,starter=true,appearance=1)=>({header:{competitions:[{id:"401915525",status:{type:{completed:true}}}]},
 rosters:[{roster:[{athlete:{id:"77",displayName:"Vangelis Pavlidis",fullName:"Vangelis Pavlidis"},starter,stats:[{name:"appearances",value:appearance},{name:"totalGoals",value:goals},{name:"goalAssists",value:assists}]}]}]});
test("goal and score-assist markets must not use final score as player stat",()=>{
 assert.equal(parseGoalContributionMarket("Vangelis Pavlidis Anytime Goal").kind,"atgs");
 assert.equal(parseGoalContributionMarket("Mohamed Salah To Score or Assist").kind,"soa");
 assert.equal(scoreLeg({label:"Vangelis Pavlidis Anytime Goal"},fixture),"pending");
});
test("only exact verified roster goal and assist results settle research props",()=>{
 const g={gameId:"401915525",label:"Vangelis Pavlidis Anytime Goal",researchParticipationPolicy:"must_start"};
 const s={...g,label:"Vangelis Pavlidis Score or Assist"};
 assert.equal(summaryLegOutcome(g,summary(1,0)).result,"hit");
 assert.equal(summaryLegOutcome(g,summary(0,1)).result,"miss");
 assert.equal(summaryLegOutcome(s,summary(0,1)).result,"hit");
 assert.equal(summaryLegOutcome(s,summary(0,0)).result,"miss");
 assert.equal(summaryLegOutcome(s,summary(null,0)),null);
 assert.equal(summaryLegOutcome(g,summary(null,0)),null);
});
test("verified did not start is a void for explicit research starter-only policy",()=>{
 const g={gameId:"401915525",label:"Vangelis Pavlidis Anytime Goal",researchParticipationPolicy:"must_start"};
 assert.equal(summaryLegOutcome(g,summary(1,0,false)).voidReason,"did_not_start");
 assert.equal(summaryLegOutcome(g,summary(1,0,undefined)),null);
 assert.equal(summaryLegOutcome(g,summary(1,0,true,0)),null);
});
test("research goal slips have separate category IDs and do not count as priced wager returns",()=>{
 const d={schema:"footyedge-player-goal-slips-v1",slips:[{key:"atgs",status:"hold",legs:[{gameId:"401",player:"A",fixture:"A vs B",league:"uefa.europa",kickoff:"2026-11-05T20:00Z",label:"A Anytime Goal"}]},{key:"scoreOrAssist",status:"hold",legs:[{gameId:"402",player:"B",fixture:"C vs D",league:"uefa.europa",kickoff:"2026-11-05T20:00Z",label:"B Score or Assist"}]}]};
 const a=playerResearchTicketsOf(d);assert.deepEqual(a.map(x=>x.id),["research:atgs","research:scoreOrAssist"]);assert.ok(a.every(x=>x.trackable===false&&x.legs.every(l=>l.researchParticipationPolicy==="must_start")));
 assert.equal(settleTicket([{result:"hit"},{result:"push"}]),"hit");
});
