// Probability adapter for the original multi-factor FootyEdge candidate model.
// Preserve pre-match team-strength, home/away, match-news and head-to-head
// information already incorporated by the original model, rather than
// substituting one generic total-goals estimate for every market.
// Uncalibrated outputs remain research estimates, never guaranteed hit rates.
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const avg=(a,k)=>a.reduce((s,x)=>s+Number(x[k]),0)/a.length;
function poissonCDF(k,lambda){
  if(k<0)return 0;
  let term=Math.exp(-lambda),sum=term;
  for(let i=1;i<=k;i++){term*=lambda/i;sum+=term}
  return clamp(sum,0,1);
}
function buildRates(home,away){
 const h=clamp(.8*(.55*avg(home,"gf")+.45*avg(away,"ga"))*1.06+.2*1.3,.3,3.8);
 const a=clamp(.8*(.55*avg(away,"gf")+.45*avg(home,"ga"))*.96+.2*1.3,.3,3.8);
 let homeWin=0,awayWin=0,draw=0;
 const pmf=(k,l)=>Math.exp(-l)*Math.pow(l,k)/[...Array(k)].reduce((prod,_,i)=>prod*(i+1),1);
 for(let i=0;i<=14;i++)for(let j=0;j<=14;j++){
  const z=pmf(i,h)*pmf(j,a);
  if(i>j)homeWin+=z;else if(i<j)awayWin+=z;else draw+=z;
 }
 return {homeWin,awayWin,draw,h,a,total:h+a};
}
function side(label,game){
 const s=String(label||"").toLowerCase(),h=String(game.home||"").toLowerCase(),a=String(game.away||"").toLowerCase();
 if(s.includes(h)&&h)return "home";
 if(s.includes(a)&&a)return "away";
 return null;
}
function goalsProbability(label,lambda){
 const match=String(label).match(/\b(over|under)\s+(\d+(?:\.\d+)?)\b/i);
 if(!match)return null;
 const threshold=Number(match[2]);
 if(!Number.isFinite(threshold)||threshold<0.5||threshold>8.5)return null;
 const lower=poissonCDF(Math.floor(threshold),lambda);
 return match[1].toLowerCase()==="over"?1-lower:lower;
}
function teamGoalsProbability(label,lambda){
 const match=String(label).match(/\b(\d+)\+\s+goals?\b/i);
 if(match)return 1-poissonCDF(Number(match[1])-1,lambda);
 return goalsProbability(label,lambda);
}
export function estimateMarketOutcome({pick,game,homeHistory,awayHistory}){
 const prior=Number(pick?.modelProb);
 const isEstimatedFromPrior=Number.isFinite(prior)&&prior>0&&prior<1&&
   !["historical_trend_hit_rate","footyedge_loss_adjusted_rating","footyedge_conviction_index_not_win_probability"].includes(pick?.confidenceType);
 if(isEstimatedFromPrior)return {success:prior,source:"original_multifactor_prematch_model",drawLoss:null};
 if(!Array.isArray(homeHistory)||homeHistory.length<5||!Array.isArray(awayHistory)||awayHistory.length<5)return {success:null,source:"insufficient_verified_history",drawLoss:null};
 const m=buildRates(homeHistory,awayHistory);
 const name=String(pick?.label||"").toLowerCase(),cat=String(pick?.category||""),teamSide=side(name,game);
 let p=null,drawLoss=null;
 if(cat==="Match Result"){
  p=teamSide==="home"?m.homeWin:teamSide==="away"?m.awayWin:name.includes("draw")?m.draw:null;
  if(p!=null&&teamSide)drawLoss=m.draw;
 }else if(cat==="Double Chance"){
  if(name.includes("1x")||teamSide==="home"&&name.includes("draw"))p=1-m.awayWin;
  else if(name.includes("x2")||teamSide==="away"&&name.includes("draw"))p=1-m.homeWin;
  else if(name.includes("12")||name.includes("home or away"))p=1-m.draw;
 }else if(cat==="Goals")p=goalsProbability(name,m.total);
 else if(cat==="Team Goals"){
  if(teamSide)p=teamGoalsProbability(name,teamSide==="home"?m.h:m.a);
 }else if(cat==="BTTS"){
  const both=(1-Math.exp(-m.h))*(1-Math.exp(-m.a));
  p=name.includes("no")?1-both:both;
 }
 if(!Number.isFinite(p))return {success:null,source:"unsupported_market_no_independent_probability",drawLoss:null};
 return {success:clamp(p,.01,.99),source:"shrunken_goal_history_fallback",drawLoss};
}
