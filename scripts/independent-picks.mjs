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
 const ranked=[...(picks||[])].filter(p=>p?.label&&selectionEvidence(p))
  .sort((a,b)=>(Number(b.confidenceRating??b.rating)||0)-(Number(a.confidenceRating??a.rating)||0));
 const compatible=(a,b)=>{
  const left=marketThesis(a),right=marketThesis(b);
  if(left==="other"||right==="other"||left===right)return false;
  const goal=x=>String(x.label||"").match(/^(.+?) 1\\+ Goal$/i)?.[1],
        result=x=>String(x.label||"").match(/^(.+?) (?:ML|or Draw)$/i)?.[1];
  if((goal(a)&&result(b)&&key(goal(a))===key(result(b)))||
     (goal(b)&&result(a)&&key(goal(b))===key(result(a))))return false;
  return key(a.label)!==key(b.label);
 };
 // Prefer TWO truly different edges over one high-scored correlated goal line.
 // Then sort the chosen picks by confidence. No filler third event market.
 let best=[];
 const search=(chosen,next)=>{
  if(chosen.length>best.length||(chosen.length===best.length&&
   chosen.reduce((n,p)=>n+Number(p.confidenceRating??p.rating??0),0)>
   best.reduce((n,p)=>n+Number(p.confidenceRating??p.rating??0),0)))best=[...chosen];
  if(chosen.length>=max)return;
  for(let i=next;i<ranked.length;i++)
   if(chosen.every(p=>compatible(p,ranked[i])))search([...chosen,ranked[i]],i+1);
 };
 search([],0);
 return best.sort((a,b)=>(Number(b.confidenceRating??b.rating)||0)-(Number(a.confidenceRating??a.rating)||0))
   .map((p,i)=>({...p,rank:i+1}));
}
