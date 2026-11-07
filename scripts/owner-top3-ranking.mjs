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
 const [total,other]=x==="total"?[a,b]:y¶»§q«^