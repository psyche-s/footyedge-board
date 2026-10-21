const VALID_LEAGUES=new Set(["eng.1","eng.2","esp.1","ita.1","ger.1","fra.1","ned.1","por.1","tur.1","ksa.1","cze.1","jpn.1","kor.1","usa.1","uefa.champions","uefa.europa","uefa.europa.conf"]);
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
    const ranks={},table=[];
    const getStat=(e,names,abbr)=>{
      const row=(e.stats||[]).find(x=>names.includes(String(x?.name))||abbr.includes(String(x?.abbreviation)));
      const n=Number(row?.value??row?.displayValue);
      return Number.isFinite(n)?n:null;
    };
    for(const e of entriesFrom(body)){
      const id=String(e?.team?.id||"");
      const rank=standingRank(e);
      if(id&&rank!==null){
        ranks[id]=rank;
        const played=getStat(e,["gamesPlayed","games","played"],["GP","P"]);
        const points=getStat(e,["points"],["PTS","Pts"]);
        const won=getStat(e,["wins","win"],["W"]);
        const drawn=getStat(e,["ties","draws"],["D"]);
        const lost=getStat(e,["losses","loss"],["L"]);
        const gf=getStat(e,["pointsFor","goalsFor","goalsScored"],["GF","F"]);
        const ga=getStat(e,["pointsAgainst","goalsAgainst","goalsConceded"],["GA","A"]);
        table.push({id,name:String(e.team?.displayName||e.team?.name||""),abbreviation:String(e.team?.abbreviation||""),
          logo:String(e.team?.logos?.[0]?.href||e.team?.logo||""),rank,played,won,drawn,lost,gf,ga,
          gd:gf!=null&&ga!=null?gf-ga:getStat(e,["pointDifferential","goalDifference"],["GD"]),
          points});
      }
    }
    res.setHeader("Cache-Control","public, s-maxage=900, stale-while-revalidate=900");
    return res.status(200).json({season,league,ranks,table:table.sort((a,b)=>a.rank-b.rank),status:table.length?"verified":"table-unavailable",source:"ESPN season standings",fetchedAt:new Date().toISOString()});
  }catch(e){
    return res.status(502).json({error:"Verified standings temporarily unavailable"});
  }
}
