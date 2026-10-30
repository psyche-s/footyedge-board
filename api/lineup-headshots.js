/* FootyEdge Original: roster-verified image references for the XI currently in view.
 * No third-party facepack copying, image mirroring, fuzzy global-name search,
 * or assertion that a publicly reachable CDN image is licensed for rehosting.
 */
const LEAGUES=new Set(["eng.1","eng.2","esp.1","ita.1","ger.1","fra.1","ned.1",
 "por.1","tur.1","ksa.1","usa.1","jpn.1","kor.1","cze.1",
 "uefa.champions","uefa.europa","uefa.europa.conf","uefa.nations"]);
const norm=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const validImage=x=>/^https:\/\/(?:a\.espncdn\.com|a\.espn\.com)\/[a-z0-9._~!$&'()*+,;=:@/%?-]+$/i.test(String(x||""))
 ?String(x):"";
function athletes(data){
 const groups=Array.isArray(data?.athletes)?data.athletes:[];
 return groups.flatMap(g=>Array.isArray(g.items)?g.items:Array.isArray(g.athletes)?g.athletes:
   (g.id||g.displayName)?[g]:[])
  .map(a=>a.athlete||a).filter(a=>a&&/^\d{1,12}$/.test(String(a.id||""))&&
  (a.displayName||a.fullName||a.name));
}
function uniqueMatch(rows,q){
 const asked=norm(q.name),want=String(q.id||"");
 if(asked.length<2)return null;
 const candidates=rows.filter(row=>{
  const full=norm(row.displayName||row.fullName||row.name);
  const exact=asked===full;
  const suffix=asked.length>=4&&full.endsWith(" "+asked);
  const initials=asked.match(/^([a-z]) ([a-z][a-z0-9 ]{3,})$/);
  const initialSurname=initials&&full.startsWith(initials[1])&&full.endsWith(" "+initials[2]);
  return exact||suffix||initialSurname;
 });
 if(candidates.length!==1)return null;
 const matched=candidates[0];
 // A fixture provider may have a different numeric ID namespace. Resolve
 // that case by unambiguous within-team name, never by cross-team ID alone.
 if(want&&String(matched.id)!==want&&norm(matched.displayName||matched.fullName||matched.name)!==asked)
  return null;
 return matched;
}
async function loadRoster(league,teamId){
 const url="https://site.api.espn.com/apis/site/v2/sports/soccer/"+
   league+"/teams/"+teamId+"/roster";
 const resp=await fetch(url,{headers:{accept:"application/json"},
  signal:AbortSignal.timeout(3300)});
 if(!resp.ok)throw Error("Roster unavailable");
 const payload=await resp.json();
 if(payload?.team?.id&&String(payload.team.id)!==teamId)throw Error("Team identity mismatch");
 return athletes(payload);
}
async function verifiedCdnPhoto(id){
 const url="https://a.espncdn.com/i/headshots/soccer/players/full/"+id+".png";
 try{
  const response=await fetch(url,{method:"HEAD",signal:AbortSignal.timeout(1400)});
  return response.ok&&String(response.headers.get("content-type")||"").startsWith("image/")?url:"";
 }catch{return ""}
}
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"GET only"});
 const league=String(req.query.league||"");
 const teamId=String(req.query.teamId||"");
 const fallback=String(req.query.fallbackLeague||"");
 const raw=String(req.query.names||"");
 if(!LEAGUES.has(league)||! /^\d{1,10}$/.test(teamId)||
    (fallback&&!LEAGUES.has(fallback))||raw.length>1900)
  return res.status(400).json({error:"Invalid request"});
 let requested;
 try{requested=JSON.parse(raw)}catch{return res.status(400).json({error:"Invalid players"})}
 if(!Array.isArray(requested)||requested.length<1||requested.length>11||
   !requested.every(p=>p&&typeof p.name==="string"&&p.name.length>=2&&
    p.name.length<=85&&(!p.id||/^\d{1,12}$/.test(String(p.id)))))
  return res.status(400).json({error:"Invalid player list"});
 res.setHeader("Cache-Control","public, s-maxage=3600, stale-while-revalidate=7200");
 res.setHeader("X-Content-Type-Options","nosniff");
 let rows=[],usedLeague="";
 for(const candidate of [...new Set([league,fallback].filter(Boolean))]){
  try{
   const batch=await loadRoster(candidate,teamId);
   if(batch.length){rows=batch;usedLeague=candidate;break}
  }catch{}
 }
 if(!rows.length)return res.status(200).json({schema:"footyedge-lineup-headshots-v1",
  status:"unavailable",league,teamId,players:[],photoCount:0});
 const matches=requested.map(p=>({query:p,roster:uniqueMatch(rows,p)}));
 const resolved=await Promise.all(matches.map(async ({query,roster})=>{
  if(!roster)return {name:query.name,id:null,photoUrl:null};
  let image=validImage(roster.headshot?.href||roster.headshot?.url||roster.headshot||
   roster.image?.href||"");
  if(!image)image=await verifiedCdnPhoto(String(roster.id));
  return {name:query.name,id:String(roster.id),photoUrl:image||null};
 }));
 return res.status(200).json({schema:"footyedge-lineup-headshots-v1",
  status:"verified_roster",league:usedLeague,teamId,players:resolved,
  matchedCount:resolved.filter(x=>x.id).length,
  photoCount:resolved.filter(x=>x.photoUrl).length});
}
