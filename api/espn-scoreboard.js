import {loadCzechSeason,eventsForCzechDate} from "../assets/czech-first-league.mjs";


// A previously captured ESPN-derived fixture snapshot is a labelled FALLBACK,
// never a fresh/live scoreboard or proof of confirmed lineups, results or odds.
const VERIFIED_CLUB_LEAGUES=new Map([[700,"eng.1"],[3914,"eng.2"],[3946,"tur.1"],[21231,"ksa.1"],[740,"esp.1"],[730,"ita.1"],[720,"ger.1"],[710,"fra.1"],[725,"ned.1"],[715,"por.1"],[770,"usa.1"]]);
function cachedEvent(row){
  const fid=row?.fixture, league=row?.league, teams=row?.teams;
  if(!fid?.id||!fid.date||!teams?.home?.name||!teams?.away?.name)return null;
  const id=Number(league?.id),leagueCode=VERIFIED_CLUB_LEAGUES.get(id);
  const label=String(league?.name||"");
  if(!leagueCode||!label||label==="Soccer"||/women|female/i.test(label))return null;
  const state=String(fid.status?.short||"NS"),done=["FT","AET","PEN"].includes(state);
  const compTeam=(t,side)=>({
    id:String(t.id),homeAway:side,winner:done?Boolean(t.winner):false,
    ...(done&&row.goals?.[side]!=null?{score:{value:Number(row.goals[side]),displayValue:String(row.goals[side])}}:{}),
    team:{id:String(t.id),displayName:t.name,name:t.name,logo:t.logo||null}
  });
  return{
    id:String(fid.id),uid:"s:600~l:"+id+"~e:"+fid.id,date:fid.date,
    name:teams.home.name+" vs "+teams.away.name,
    season:{year:Number(league.season)||null,slug:league.round||""},
    league:{name:label},footyedgeLeague:leagueCode,
    status:{type:{completed:done,name:done?"STATUS_FINAL":state==="PST"?"STATUS_POSTPONED":"STATUS_SCHEDULED",state:done?"post":"pre",detail:fid.status?.long||state}},
    competitions:[{id:String(fid.id),competitors:[compTeam(teams.home,"home"),compTeam(teams.away,"away")],odds:[]}]
  };
}
async function savedFixtureFallback(day){
  // Raw, date-stamped GitHub snapshot is source-visible and strictly fallback.
  const url="https://raw.githubusercontent.com/psyche-s/footyedge-board/main/data/"+day+"/fixtures.json";
  const response=await fetch(url,{headers:{accept:"application/json","user-agent":"FootyEdge/1.0"}});
  if(!response.ok)throw new Error("Saved snapshot unavailable");
  const saved=await response.json();
  if(!Array.isArray(saved?.response))throw new Error("Saved snapshot invalid");
  const events=saved.response.map(cachedEvent).filter(Boolean);
  if(!events.length)throw new Error("No reliably identified men's league matches in snapshot");
  return {events,footyedgeSources:{scoreboard:{
    live:false,kind:"saved-espn-fixture-snapshot",date:day,
    note:"Live ESPN scoreboard unavailable. Matches from dated saved fixture snapshot; do not present odds or results as live."
  }}};
}

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
    let payload=null;
    if(espn.status==="fulfilled"&&espn.value.ok){
      try{const data=await espn.value.json();if(Array.isArray(data.events))payload=data}catch{}
    }
    if(!payload){
      try{payload=await savedFixtureFallback(day)}
      catch{ return res.status(502).json({error:"Live scoreboard and dated saved fixtures unavailable"}); }
    }
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
