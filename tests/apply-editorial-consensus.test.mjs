import test from "node:test";
import assert from "node:assert/strict";
import {authorised,compareDraft,normalizeKey} from "../scripts/apply-editorial-consensus.mjs";

const game=()=>{
 const make=(label,category,rating)=>({label,category,confidenceRating:rating,
  score:null,modelProb:null,ev:null,verifiedPrice:false,probabilityCalibrated:false,
  researchOnly:true,odds:null,bookExact:false,priceDecimal:null,reason:"Earlier text"});
 const options=[make("Home 1+ Goal","Team Goals",87),
  make("Over 1.5 Goals","Goals",85),
  make("Home or Draw","Double Chance",83),
  make("Over 2.5 Goals","Goals",82)];
 return {id:"123",home:"Home",away:"Away",league:"men",date:"2026-10-21T20:00Z",
  top3:options.slice(0,3),top:options[0],model:{rankedCandidates:options,candidates:options}};
};
const makeFixture=()=>({id:"123",last10:{home:Array.from({length:10},(_,i)=>({result:i%3?"W":"D",gf:2,ga:1})),
 away:Array.from({length:10},(_,i)=>({result:i%2?"L":"W",gf:1,ga:2}))}});
const evidence=(source,market,stance)=>({fixture_date:"2026-10-21",match_id:"123",source,
 source_url:"https://"+({forebet:"forebet.com",sports_mole:"sportsmole.co.uk",
 football_whispers:"footballwhispers.com",sportskeeda:"sportskeeda.com",forza_football:"forzafootball.com"})[source]+"/sample",
 market_key:market,stance,captured_at:"2026-10-21T00:11:00Z",
 permission:"authorized",permission_reference:"signed-licence-123"});
test("rights, domains, and exact fixture are required",()=>{
 const known=new Set(["123"]),e=evidence("forebet","home_goal","support");
 assert.equal(authorised(e,"2026-10-21",known),true);
 assert.equal(authorised({...e,permission:"unknown"},"2026-10-21",known),false);
 assert.equal(authorised({...e,source_url:"https://fakeforebet.com"},"2026-10-21",known),false);
 assert.equal(authorised({...e,match_id:"99"},"2026-10-21",known),false);
 assert.equal(authorised(evidence("forza_football","over_1_5","support"),"2026-10-21",known),true);
});
test("match selection is diverse, ordered, statistical and not calibrated",()=>{
 const g=game(),board={date:"2026-10-21",games:[g],top5:[],leagueTop5:{}};
 const base={date:"2026-10-21",fixtures:[makeFixture()]};
 const e=[evidence("forebet","home_goal","support"),evidence("forebet","home_goal","support"),
  evidence("sports_mole","home_goal","oppose"),evidence("sportskeeda","over_1_5","support")];
 const out=compareDraft(board,base,e);
 assert.ok(out.games[0].top3.length>=1&&out.games[0].top3.length<=2);
 assert.equal(out.games[0].top3.filter(p=>["Goals","Team Goals","BTTS"].includes(p.category)).length<=1,true);
 assert.equal(out.games[0].top3.filter(p=>p.family==="totals").length,1);
 assert.equal(out.games[0].top3[0].label,out.games[0].top.label);
 assert.deepEqual(out.games[0].top3.map(p=>p.confidenceRating),out.games[0].top3.map(p=>p.confidenceRating).sort((a,b)=>b-a));
 assert.match(out.games[0].top3[0].reason,/last 10.*GF.*GA\/game/);
 assert.equal(out.games[0].top3[0].editorialSupport,1);
 assert.equal(out.games[0].top3[0].editorialOppose,1);
 assert.equal(out.games[0].top3[0].score,null);
 assert.equal(out.top5[0].pick,out.games[0].top);
 assert.equal(out.sourceQuality.editorialConsensus.matchesWithLicensedEditorial,1);
});
test("source checks are optional, not invented, and no article text appears",()=>{
 const out=compareDraft({date:"2026-10-21",games:[game()],top5:[]},
 {date:"2026-10-21",fixtures:[makeFixture()]},[]);
 assert.equal(out.sourceQuality.editorialConsensus.matchesWithLicensedEditorial,0);
 assert.equal(out.games[0].top3[0].editorialSupport,0);
 assert.doesNotMatch(out.games[0].top3[0].reason,/forebet|sportskeeda|sports mole/i);
 assert.equal(normalizeKey("Away ML",out.games[0]),"away_win");
});
