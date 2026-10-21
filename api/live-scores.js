// Lightweight live scoreboard. Reads a live upstream feed per request; it does
// not redeploy, reprice, republish or mutate immutable betting selections.
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const ns=v=>String(v??'').trim();
const num=v=>{
  if(v==null||v==='')return null;
  const raw=typeof v==='object'?(v.value??v.displayValue):v;
  if(raw==null||raw==='')return null;
  const n=Number(raw);return Number.isFinite(n)&&n>=0?n:null;
};
function torontoDay(date){
  const out=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(date)).map(x=>[x.type,x.value]));
  return out.year+'-'+out.month+'-'+out.day;
}
export function normalizeEvent(e){
  if(!e?.id||!e?.date)return null;
  const c=e.competitions?.[0];
  const home=c?.competitors?.find(x=>x.homeAway==='home');
  const away=c?.competitors?.find(x=>x.homeAway==='away');
  if(!home||!away)return null;
  const type=e.status?.type||{};
  const state=ns(type.state).toLowerCase(),name=ns(type.name).toUpperCase();
  const live=state==='in'||name==='STATUS_IN_PROGRESS'||name==='STATUS_HALFTIME';
  const done=type.completed===true||state==='post'||name==='STATUS_FINAL';
  const hasScore=live||done;
  const homeScore=hasScore?num(home.score):null,awayScore=hasScore?num(away.score):null;
  return {id:String(e.id),home:ns(home.team?.displayName||home.team?.name),
    away:ns(away.team?.displayName||away.team?.name),date:e.date,
    live,done,status:live?'LIVE':done?'FT':'NS',
    clock:live?ns(e.status?.displayClock||type.shortDetail||type.detail).slice(0,20):null,
    homeScore,awayScore};
}
export default async function handler(req,res){
  const day=String(req.query?.date||'');
  if(!DAY.test(day)||!Number.isFinite(Date.parse(day+'T12:00:00Z')))return res.status(400).json({error:'Invalid date'});
  const now=Date.now();
  const age=Math.abs(Date.parse(day+'T12:00:00Z')-now);
  if(age>8*86400000)return res.status(400).json({error:'Outside live scoreboard window'});
  try{
    const url=ESPN+'?dates='+day.replaceAll('-','')+'&limit=1000';
    const r=await fetch(url,{signal:AbortSignal.timeout(9500),headers:{accept:'application/json','user-agent':'FootyEdge Live Score/1.0'}});
    if(!r.ok)throw new Error('Score provider unavailable');
    const data=await r.json();
    if(!Array.isArray(data.events))throw new Error('Incomplete score response');
    const events=data.events.filter(e=>torontoDay(e.date)===day).map(normalizeEvent).filter(Boolean);
    // ESPN's aggregate feed can omit J1 and K League 1. Supplement with
    // verified league events rather than mirroring static fixture scores.
    const seen=new Set(events.map(e=>e.id)),supplemented=[];
    const leagueResults=await Promise.allSettled(["jpn.1","kor.1"].map(async league=>{
      const endpoint="https://site.api.espn.com/apis/site/v2/sports/soccer/"+league+
        "/scoreboard?dates="+day.replaceAll("-","")+"&limit=100";
      const source=await fetch(endpoint,{signal:AbortSignal.timeout(4000),headers:{accept:"application/json"}});
      if(!source.ok)throw Error("No confirmed league scoreboard");
      const body=await source.json();
      return{league,items:(body.events||[]).filter(e=>torontoDay(e.date)===day).map(normalizeEvent).filter(Boolean)};
    }));
    for(const checked of leagueResults){
      if(checked.status!=="fulfilled")continue;
      for(const item of checked.value.items){
        if(!seen.has(item.id)){events.push(item);seen.add(item.id);supplemented.push(checked.value.league);}
        else if(item.live||item.done){const index=events.findIndex(x=>x.id===item.id);if(index>=0)events[index]=item;}
      }
    }
    res.setHeader('Cache-Control','public, s-maxage=25, stale-while-revalidate=20');
    return res.status(200).json({date:day,fetchedAt:new Date().toISOString(),liveSource:true,events,
      supplementedLeagues:[...new Set(supplemented)],
      coverage:'Source-verified ESPN aggregate plus J1/K League feeds when accessible; unsupported leagues never receive invented scores'});
  }catch{
    res.setHeader('Cache-Control','no-store');
    return res.status(503).json({date:day,liveSource:false,events:[],error:'Live score feed unavailable'});
  }
}
