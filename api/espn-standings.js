const VALID_LEAGUES=new Set(["eng.1","eng.2","esp.1","ita.1","ger.1","fra.1","ned.1","por.1","tur.1","ksa.1","cze.1"]);
function entriesFrom(node,out=[]){
  if(!node||typeof node!=="object")return out;
  if(Array.isArray(node?.standings?.entries))out.push(...node.standings.entries);
  if(Array.isArray(node?.standings))for(const group of node.standings)entriesFrom({standings:group},out);
  if(Array.isArray(node?.children))for(const child of node.children)entriesFrom(child,out);
  return out;
}
function standingRank(entry){
  const n=entry?.stats?.find(s=>["rank","rankPosition","position"].includes(s?.name)||s?.abbreviation==="RK");
  const rank=Number(n?.value??n?.displayValue);
  return Number.isInteger(rank)&&rank>0&&rank<=40?rank:null;
}
export default async function handler(req,res){
  const league=String(req.query.league||"");
  const season=Number(req.query.season);
  if(!VALID_LEAGUES.has(league)||!Number.isInteger(season)||season<2020||season>2100)return res.status(400).json({error:"Invalid league or season"});
  try{
    const url="https://site.api.espn.com/apis/v2/sports/soccer/"+encodeURIComponent(league)+"/standings?season="+encodeURIComponent(season);
    const response=await fetch(url,{headers:{accept:"application/json","user-agent":"FootyEdge/1.0"}});
    if(!response.ok)throw new Error("Standings upstream "+response.status);
    const body=await response.json();
    // Never label a ranking as current-season if the upstream season is unverified.
    const returnedSeason=Number(body?.season?.year??body?.league?.season?.year??body?.seasons?.find(x=>x?.isCurrent)?.year);
    if(returnedSeason!==season)return res.status(200).json({season:null,ranks:{},status:"season-unverified"});
    const ranks={};
    for(const e of entriesFrom(body)){
      const id=String(e?.team?.id||"");
      const rank=standingRank(e);
      if(id&&rank!==null)ranks[id]=rank;
    }
    res.setHeader("Cache-Control","public, s-maxage=900, stale-while-revalidate=900");
    return res.status(200).json({season,ranks,status:Object.keys(ranks).length?"verified":"table-unavailable"});
  }catch(e){
    return res.status(502).json({error:"Verified standings temporarily unavailable"});
  }
}
