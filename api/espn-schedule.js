export default async function handler(req,res){
  try{
    const league=String(req.query.league||"");
    const team=String(req.query.team||"");
    const season=String(req.query.season||"");
    if(!league||!team) return res.status(400).json({error:"Missing league or team"});
    const primary="https://site.api.espn.com/apis/site/v2/sports/soccer/"+encodeURIComponent(league)+"/teams/"+encodeURIComponent(team)+"/schedule"+(season?"?season="+encodeURIComponent(season):"");
    let r=await fetch(primary,{headers:{"accept":"application/json","user-agent":"FootyEdge/1.0"}});
    let text=await r.text();
    if(!r.ok){
      const fallback="https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/"+encodeURIComponent(team)+"/schedule"+(season?"?season="+encodeURIComponent(season):"");
      r=await fetch(fallback,{headers:{"accept":"application/json","user-agent":"FootyEdge/1.0"}});
      text=await r.text();
    }
    res.setHeader("Content-Type","application/json; charset=utf-8");
    res.setHeader("Cache-Control","public, s-maxage=300, stale-while-revalidate=300");
    return res.status(r.status).send(text);
  }catch(error){
    return res.status(502).json({error:String(error)});
  }
}