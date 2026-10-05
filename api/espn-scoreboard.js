export default async function handler(req,res){
  try{
    const dates=String(req.query.dates||"");
    const limit=String(req.query.limit||"1000");
    if(!/^\d{8}$/.test(dates)) return res.status(400).json({error:"Invalid date"});
    const url="https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates="+encodeURIComponent(dates)+"&limit="+encodeURIComponent(limit);
    const r=await fetch(url,{headers:{"accept":"application/json","user-agent":"FootyEdge/1.0"}});
    const text=await r.text();
    res.setHeader("Content-Type","application/json; charset=utf-8");
    res.setHeader("Cache-Control","public, s-maxage=60, stale-while-revalidate=120");
    return res.status(r.status).send(text);
  }catch(error){
    return res.status(502).json({error:String(error)});
  }
}