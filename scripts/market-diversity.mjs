// Research-only pick variety constraints.
// A Top 3 is a shortlist of DISTINCT football theses, not adjacent thresholds.
export function marketConcept(p){
 const category=String(p?.category||"").toLowerCase();
 const label=String(p?.label||"").trim().toLowerCase();
 if(category==="goals"||/^(over|under)\s+\d+(?:\.\d+)?\s+goals/.test(label))return"total";
 if(category==="team goals"||/\b\d+\+\s+goals?\b/.test(label))return"team-goal";
 if(category==="btts"||label.includes("both teams to score"))return"btts";
 if(category==="double chance"||label.includes(" or draw"))return"result";
 if(category==="match result"||/\bml$/.test(label))return"result";
 if(category==="corners")return"corners";
 if(category==="cards")return"cards";
 if(category==="shots"||category==="shots on target")return"shots";
 if(category==="player"||category==="assists")return"player";
 return"other";
}
export function independentSelection(a,b){
 if(String(a?.label||"").trim().toLowerCase()===String(b?.label||"").trim().toLowerCase())return false;
 const A=marketConcept(a),B=marketConcept(b);
 if(A==="other"||B==="other")return false;
 // Team 1+ / total O1.5, neighboring totals, both 1+ and BTTS,
 // and result/double-chance restatements are not distinct picks.
 if(["total","team-goal","btts"].includes(A)&&["total","team-goal","btts"].includes(B))return false;
 if(A==="result"&&B==="result")return false;
 if(A==="player"&&B==="player")return false;
 // A ML implies that team scored 1+. Don't pretend these are independent.
 if((A==="result"&&B==="team-goal")||(A==="team-goal"&&B==="result")){
   const result=A==="result"?a:b,goal=A==="team-goal"?a:b;
   const resultTeam=String(result.label||"").replace(/(?: or Draw| ML)$/i,"").trim().toLowerCase();
   const goalTeam=String(goal.label||"").replace(/\s+\d+\+\s+goals?$/i,"").trim().toLowerCase();
   if(resultTeam&&goalTeam&&resultTeam===goalTeam)return false;
 }
 return true;
}
export function takeDistinctTopPicks(ordered,limit=3){
 const out=[];
 for(const pick of ordered||[]){
  if(out.every(existing=>independentSelection(existing,pick)))out.push(pick);
  if(out.length>=limit)break;
 }
 return out;
}
