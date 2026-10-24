// Shared taxonomy for genuinely different match-level pick hypotheses.
// All goals / BTTS / team goal / assist outcomes share core scoring risk.
// Player and team events are only independent when source-backed opponent allowance exists.
const key=x=>String(x||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
export function marketThesis(p){
 const l=String(p?.label||"").toLowerCase(),cat=String(p?.category||"").toLowerCase(),family=String(p?.family||"").toLowerCase();
 if(/foul/.test(l+" "+cat+" "+family))return "fouls";
 if(/corner/.test(l+" "+cat+" "+family))return "corners";
 if(/tackle/.test(l+" "+cat+" "+family))return "tackles";
 if(/yellow|red card|booking|\bcards?\b/.test(l+" "+cat+" "+family))return "cards";
 if(/shot|sot/.test(l+" "+cat+" "+family))return "shots";
 if(/pass/.test(l+" "+cat+" "+family))return "passes";
 if(/\b(ml|moneyline)\b|\bor draw\b|double chance|match result|handicap/.test(l+" "+cat+" "+family))return "result";
 if(/assist|goal|btts|scor/.test(l+" "+cat+" "+family))return "scoring";
 return "other";
}
export function selectionEvidence(p){
 const t=marketThesis(p),e=p?.marketEvidence||{};
 if(["fouls","corners","tackles","cards","shots","passes"].includes(t))
  return e.verified===true&&Number(e.teamSample||e.playerSample||0)>=5
   &&Number(e.opponentAllowanceSample||0)>=5&&(e.playerMarket!==true||e.playerAvailable===true);
 return p?.sourceBackedReason===true && typeof p?.reason==="string" && p.reason.length>=30;
}
export function distinctPickSet(picks,max=3){
 const sorted=[...(picks||[])].filter(p=>p?.label&&selectionEvidence(p))
  .sort((a,b)=>(Number(b.confidenceRating??b.rating)||0)-(Number(a.confidenceRating??a.rating)||0));
 const selected=[],theses=new Set(),labels=new Set();
 for(const p of sorted){
  const thesis=marketThesis(p),label=key(p.label);
  if(thesis==="other"||theses.has(thesis)||labels.has(label))continue;
  // A team goal and result bet on that exact same side do not become independent hypotheses.
  const sameSideGoal=String(p.label||"").match(/^(.+?) 1\+ Goal$/i)?.[1];
  const sameSideResult=String(p.label||"").match(/^(.+?) (?:ML|or Draw)$/i)?.[1];
  if(selected.some(q=>{
   const gl=String(q.label||"").match(/^(.+?) 1\+ Goal$/i)?.[1],
      re=String(q.label||"").match(/^(.+?) (?:ML|or Draw)$/i)?.[1];
   return sameSideGoal&&re&&key(sameSideGoal)===key(re)||sameSideResult&&gl&&key(sameSideResult)===key(gl);
  }))continue;
  selected.push({...p,rank:selected.length+1});
  theses.add(thesis);labels.add(label);
  if(selected.length===max)break;
 }
 return selected;
}
