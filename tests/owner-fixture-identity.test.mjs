import test from "node:test";
import assert from "node:assert/strict";
import {canonicalFixtureKey,canonicalTeamName} from "../scripts/owner-fixture-identity.mjs";
const key=(league,home,away)=>canonicalFixtureKey({league,home,away,date:"2026-10-28T19:45:00Z"});
test("official and ESPN names refer to exactly one fixture",()=>{
 const pairs=[
  ["eng.league_cup","Bournemouth","Aston Villa","AFC Bournemouth","Aston Villa"],
  ["ita.1","Venezia","Inter Milan","Venezia","Internazionale"],
  ["ger.dfb_pokal","SC Paderborn","VfB Stuttgart","SC Paderborn 07","VfB Stuttgart"],
  ["ger.dfb_pokal","Hannover 96","1. FC Kaiserslautern","Hannover 96","Kaiserslautern"],
  ["ger.dfb_pokal","SSV Jeddeloh II","Hertha BSC","SSV Jeddeloh II","Hertha Berlin"],
  ["sco.1","Hearts","Rangers","Heart of Midlothian","Rangers"],
  ["usa.1","Toronto FC","DC United","Toronto FC","D.C. United"],
  ["usa.1","New England Revolution","New York Red Bulls","New England Revolution","Red Bull New York"],
  ["usa.1","Inter Miami","FC Cincinnati","Inter Miami CF","FC Cincinnati"],
  ["usa.1","New York City FC","Atlanta United","New York City FC","Atlanta United FC"]
 ];
 for(const [l,h,a,h2,a2] of pairs)assert.equal(key(l,h,a),key(l,h2,a2),h+" "+a);
});
test("distinct clubs and competitions never alias into the same fixture",()=>{
 assert.notEqual(canonicalTeamName("Inter Miami"),canonicalTeamName("Inter Milan"));
 assert.notEqual(key("ita.1","Venezia","Inter Milan"),key("eng.league_cup","Venezia","Inter Milan"));
 assert.notEqual(key("usa.1","Toronto FC","D.C. United"),key("usa.1","Toronto FC","Orlando City SC"));
});
