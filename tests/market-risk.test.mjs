import test from "node:test";
import assert from "node:assert/strict";
import {estimateMarketOutcome} from "../scripts/market-risk.mjs";
const game={home:"D.C. United",away:"Red Bull New York"};
const H=Array.from({length:10},(_,i)=>({gf:1+(i%3),ga:i%2,result:i%3===0?"D":"W"}));
const A=Array.from({length:10},(_,i)=>({gf:1+(i%2),ga:1+i%3,result:i%3===0?"L":"W"}));
const estimate=(label,category,attrs={})=>estimateMarketOutcome({
 pick:{label,category,...attrs},game,homeHistory:H,awayHistory:A});
test("preserves original multifactor pre-match probability rather than overwriting with goals-only Poisson",()=>{
 const a=estimate("Over 1.5 Goals","Goals",{modelProb:0.81});
 assert.equal(a.success,0.81);
 assert.equal(a.source,"original_multifactor_prematch_model");
});
test("past trend-hit rates do not become claimed 90% probabilities",()=>{
 const a=estimate("Over 1.5 Goals","Goals",{modelProb:0.93,confidenceType:"historical_trend_hit_rate"});
 assert.notEqual(a.success,0.93);
 assert.equal(a.source,"shrunken_goal_history_fallback");
});
test("over/under totals across exact half-goal lines work, not just 1.5 and 3.5",()=>{
 const o15=estimate("Over 1.5 Goals","Goals").success;
 const o25=estimate("Over 2.5 Goals","Goals").success;
 const o35=estimate("Over 3.5 Goals","Goals").success;
 const u45=estimate("Under 4.5 Goals","Goals").success;
 assert.ok(o15>o25&&o25>o35);
 assert.ok(u45>o35);
});
test("team 1+ goals and over 0.5 team goals refer to the same event",()=>{
 const a=estimate("D.C. United 1+ Goal","Team Goals").success;
 const b=estimate("D.C. United Over 0.5 Team Goals","Team Goals").success;
 assert.ok(Math.abs(a-b)<.00001);
});
test("ML outcomes correctly include draw as a loss and Double Chance protects the draw",()=>{
 const home=estimate("D.C. United ML","Match Result").success;
 const away=estimate("Red Bull New York ML","Match Result").success;
 const draw=estimate("Draw","Match Result").success;
 const double=estimate("D.C. United or Draw","Double Chance").success;
 assert.ok(Math.abs(home+away+draw-1)<.001);
 assert.ok(Math.abs(double-(home+draw))<.001);
 assert.ok(double>home);
});
test("BTTS yes/no complement one another",()=>{
 const y=estimate("BTTS — Yes","BTTS").success;
 const n=estimate("BTTS — No","BTTS").success;
 assert.ok(Math.abs(y+n-1)<.001);
});
test("unsupported player markets remain unrated rather than using team goal trends",()=>{
 const a=estimate("Random midfielder 2+ fouls","Player");
 assert.equal(a.success,null);
});
