import test from "node:test";
import assert from "node:assert/strict";
import {naturalFootballReason} from "../scripts/football-voice.mjs";
const base={home:"Leeds United",away:"Tottenham Hotspur",homeHits:7,homeSample:10,awayHits:8,awaySample:10,variationKey:"401878758"};
test("double chance reads like a short football explanation, not model output",()=>{
 const reason=naturalFootballReason({...base,label:"Tottenham Hotspur or Draw",raw:"The independent 10,000-draw model produced 65%."});
 assert.match(reason,/Tottenham Hotspur/);
 assert.match(reason,/Leeds United/);
 assert.match(reason,/draw/i);
 assert.doesNotMatch(reason,/simulat|model|scenario|research strength|10,000|confidence|provider|source/i);
 assert.ok(reason.length<300);
});
test("total-goals copy uses real fixture-matched samples",()=>{
 const reason=naturalFootballReason({label:"Over 2.5 Goals",home:"AS Roma",away:"Sassuolo",homeHits:7,homeSample:10,awayHits:7,awaySample:10,variationKey:"401874803"});
 assert.match(reason,/7\/10|7 of 10/);
 assert.match(reason,/Roma/);
 assert.match(reason,/Sassuolo/);
 assert.doesNotMatch(reason,/probability|simulat|model|guarantee/i);
});
test("weak recent history is not presented as strong for under or team goals",()=>{
 const under=naturalFootballReason({label:"Under 3.5 Goals",home:"Nottingham Forest",away:"Manchester City",homeHits:8,homeSample:10,awayHits:3,awaySample:10,variationKey:"401878757"});
 assert.match(under,/less comfortable/i);
 const team=naturalFootballReason({label:"Nottingham Forest 1+ Goal",home:"Nottingham Forest",away:"Manchester City",homeHits:4,homeSample:10,awayHits:8,awaySample:10,variationKey:"401878757"});
 assert.match(team,/patchy/i);
 assert.match(team,/Manchester City/);
});
test("model and source-free, short BTTS copy; missing figures retain original editorial copy",()=>{
 const btts=naturalFootballReason({label:"BTTS Yes",home:"AS Roma",away:"Sassuolo",homeHits:6,homeSample:10,awayHits:9,awaySample:10,variationKey:"401874803"});
 assert.match(btts,/Roma/);assert.match(btts,/Sassuolo/);assert.ok(btts.length<300);
 const source="Team news: starting striker suspended in an independently dated preview.";
 assert.equal(naturalFootballReason({label:"Player fouls won",home:"AS Roma",away:"Sassuolo",homeHits:6,homeSample:10,awayHits:9,awaySample:10,raw:source}),source);
 assert.equal(naturalFootballReason({label:"Under 3.5 Goals",home:"AS Roma",away:"Sassuolo",homeHits:6,homeSample:0,awayHits:9,awaySample:10,raw:source}),source);
});
