export default async function handler(req,res){
  try{
    const league=String(req.query.league||"");
    const team=String(req.query.team||"");
    const season=String(req.query.season||"");
    if(!league||!team) return res.status(400).json({error:"Missing league or team"});

    const qs=season?"?season="+encodeURIComponent(season):"";
    const leagueUrl="https://site.api.espn.com/apis/site/v2/sports/soccer/"+encodeURIComponent(league)+"/teams/"+encodeURIComponent(team)+"/schedule"+qs;
    const allUrl="https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/"+encodeURIComponent(team)+"/schedule"+qs;

    async function pull(url){
      const r=await fetch(url,{headers:{"accept":"application/json","user-agent":"FootyEdge/1.0"}});
      const text=await r.text();
      let json=null;
      try{json=JSON.parse(text)}catch{}
      return {r,text,json,usable:r.ok&&Array.isArray(json?.events)&&json.events.length>0};
    }

    // Competition-specific history first so the model does not mix league,
    // friendly and cup form unless ESPN has no usable competition history.
    let result=await pull(leagueUrl);
    if(!result.usable) result=await pull(allUrl);

    res.setHeader("Content-Type","application/json; charset=utf-8");
    res.setHeader("Cache-Control","public, s-maxage=300, stale-while-revalidate=300");
    return res.status(result.r.status).send(result.text);
  }catch(error){
    return res.status(502).json({error:String(error)});
  }
}
