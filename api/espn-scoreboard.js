import {loadCzechSeason,eventsForCzechDate} from "../assets/czech-first-league.mjs";

export default async function handler(req,res){
  try{
    const dates=String(req.query.dates||"");
    const limit=String(req.query.limit||"1000");
    if(!/^\d{8}$/.test(dates))return res.status(400).json({error:"Invalid date"});
    const day=dates.slice(0,4)+"-"+dates.slice(4,6)+"-"+dates.slice(6,8);
    const url="https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates="+encodeURIComponent(dates)+"&limit="+encodeURIComponent(limit);
    // ESPN's all-league scoreboard omits the men's Czech top flight.
    // Supplement using a published public-domain fixture/results feed.
    // If that source fails, preserve all ESPN matches and report a partial source.
    const [espn,czech]=await Promise.allSettled([
      fetch(url,{headers:{"accept":"application/json","user-agent":"FootyEdge/1.0"}}),
      loadCzechSeason(day),
    ]);
    if(espn.status!=="fulfilled"||!espn.value.ok){
      const status=espn.status==="fulfilled"?espn.value.status:502;
      return res.status(status).json({error:"Scoreboard unavailable"});
    }
    const payload=await espn.value.json();
    if(!Array.isArray(payload.events))return res.status(502).json({error:"Invalid scoreboard shape"});
    let supplemented=0;
    if(czech.status==="fulfilled"){
      const known=new Set(payload.events.map(e=>String(e.id)));
      for(const e of eventsForCzechDate(czech.value.matches,day)){
        if(known.has(String(e.id)))continue;
        payload.events.push(e);known.add(String(e.id));supplemented++;
      }
    }
    payload.footyedgeSources={
      ...payload.footyedgeSources,czechFirstLeague:{
        available:czech.status==="fulfilled",
        addedFixtures:supplemented,
        source:czech.status==="fulfilled"?czech.value.url:null,
        note:"Delayed public-domain schedule/results, not a live Czech scoreboard",
      }
    };
    res.setHeader("Content-Type","application/json; charset=utf-8");
    res.setHeader("Cache-Control","public, s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json(payload);
  }catch(error){return res.status(502).json({error:"Match schedule unavailable"});}
}
