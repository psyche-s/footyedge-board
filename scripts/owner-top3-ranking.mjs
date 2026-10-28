/**
 * Owner-authorized daily pick shortlist: distinguishes independent MARKET
 * OUTCOMES without pretending selections are statistically independent.
 * A result, a goal total and BTTS can coexist when neither logically implies
 * another; redundant safer thresholds and implied team-goal claims cannot.
 */
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
export function ownerThesis(p){
 const c=norm(p?.category),l=norm(p?.label),f=norm(p?.family);
 if(c==="match result"||c==="double chance"||f==="result"||/ (?:ml|or draw)$/.test(l))return "result";
 if(c==="goals"||f==="total"||/^(?:over|under) [0-9]+(?: [0-9]+)? goals$/.test(l))return "total";
 if(c==="btts"||f==="btts"||l.startsWith("btts "))return "btts";
 if(c==="team goals"||f==="team-goal"||f==="teamgoal"||/ [123] goal$/.test(l))return "team-goal";
 if(["shots","shots on target","fouls","cards","corners","tackles","passes"].includes(c))return c;
 return "other";
}
function teamFrom(p){
 const label=String(p?.label||"");
 if(ownerThesis(p)==="team-goal")return norm(label.replace(/\s+[123]\+\s+goals?$/i,""));
 if(ownerThesis(p)==="result")return norm(label.replace(/\s+(?:ML|or Draw)$/i,""));
 return "";
}
export function ownerPickCompatible(a,b){
 if(!a?.label||!b?.label||norm(a.label)===norm(b.label))return false;
 const x=ownerThesis(a),y=ownerThesis(b);
 if(x==="other"||y==="other"||x===y)return false;
 const [total,other]=x==="total"?[a,b]:y==="total"?[b,a]:[null,null];
 const [btts,goal]=x==="btts"?[a,b]:y==="btts"?[b,a]:[null,null];
 const [result,teamGoal]=x==="result"&&y==="team-goal"?[a,b]:y==="result"&&x==="team-goal"?[b,a]:[null,null];
 if(result&&teamGoal&&teamFrom(result)===teamFrom(teamGoal))return false;
 if(btts&&ownerThesis(goal)==="team-goal"&&/\byes\b/i.test(btts.label))return false;
 if(total){
  // BTTS Yes necessarily satisfies over 1.5; do not sell both as two edges.
  if(ownerThesis(other)==="btts"&&/over\s*1[.]5/i.test(total.label)&&/\byes\b/i.test(other.label))return false;
  if(ownerThesis(other)==="team-goal"&&/over\s*1[.]5/i.test(total.label))return false;
 }
 return true;
}
export function takeOwnerTop3(picks,limit=3){
 const candidates=[...(picks||[])].filter(p=>{
  if(!p?.label||p.sourceBackedReason!==true||!String(p.reason||"").trim())return false;
  const rating=Number(p.confidenceRating??p.score);
  if(!Number.isFinite(rating)||rating<58||rating>100)return false;
  const t=ownerThesis(p),e=p.marketEvidence||{};
  if(t==="other")return false;
  if(["shots","shots on target","fouls","cards","corners","tackles","passes"].includes(t))
   return e.verified===true&&Number(e.teamSample||e.playerSample||0)>=5&&Number(e.opponentAllowanceSample||0)>=5;
  return Number(p.homeSample||0)>=5&&Number(p.awaySample||0)>=5;
 }).sort((a,b)=>Number(b.confidenceRating??b.score)-Number(a.confidenceRating??a.score));
 let best=[],bestScore=-1;
 const seek=(chosen,start)=>{
  const sum=chosen.reduce((n,p)=>n+Number(p.confidenceRating??p.score),0);
  if(chosen.length>best.length||(chosen.length===best.length&&sum>bestScore)){best=[...chosen];bestScore=sum}
  if(chosen.length>=limit)return;
  for(let i=start;i<candidates.length;i++)
   if(chosen.every(p=>ownerPickCompatible(p,candidates[i])))seek([...chosen,candidates[i]],i+1);
 };
 seek([],0);
 return best.sort((a,b)=>Number(b.confidenceRating??b.score)-Number(a.confidenceRating??a.score))
  .map((p,i)=>({...p,rank:i+1}));
}
