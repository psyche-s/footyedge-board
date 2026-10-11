// Odds observed on ESPN (not a direct book connection). Never synthesize.
const dateOK=/^\d{4}-\d{2}-\d{2}$/;
const books=[["draftkings",/\bdraft\s?kings\b/i],["fanduel",/\bfan\s?duel\b/i],["espnbet",/\bespn\s?bet\b/i]];
const names={draftkings:"DraftKings",fanduel:"FanDuel",espnbet:"ESPN BET"};
export function american(v){
  if(v==null||v==="")return null;
  const n=Number(String(v).replace("+",""));
  return Number.isInteger(n)&&Math.abs(n)>=100&&Math.abs(n)<=50000?n:null
}
const price=o=>american(o?.close?.odds??o?.odds);
const line=v=>String(v??"").match(/(?:^|[^0-9])(\d{1,2}\.5)(?:$|[^0-9])/)?.[1]||null;
export function parseEvent(e,observedAt){
  const c=e?.competitions?.[0],h=c?.competitors?.find(x=>x.homeAway==="home"),a=c?.competitors?.find(x=>x.homeAway==="away");
  const home=h?.team?.displayName||h?.team?.name,away=a?.team?.displayName||a?.team?.name;
  if(!e?.id||!e?.date||!home||!away||Date.parse(e.date)<=Date.parse(observedAt))return null;
  const state=String(e.status?.type?.state||"").toLowerCase();
  if(["in","post"].includes(state)||e.status?.type?.completed)return null;
  const markets=new Map();
  for(const o of c.odds||[]){
    const provider=o?.provider?.displayName||o?.provider?.name;
    const bk=books.find(x=>x[1].test(String(provider||"")));
    if(!bk)continue;
    function add(label,p){
      if(p==null)return;
      const previous=markets.get(label.toLowerCase());
      if(previous&&books.findIndex(x=>x[0]===previous.bookKey)<=books.findIndex(x=>x[0]===bk[0]))return;
      markets.set(label.toLowerCase(),{label,odds:p,bookKey:bk[0],book:names[bk[0]],source:"ESPN-reported",observedAt});
    }
    const ml=o.moneyline||{},hp=price(ml.home),dp=price(ml.draw),ap=price(ml.away);
    if(hp!=null&&dp!=null&&ap!=null){add(home+" ML",hp);add(away+" ML",ap);add("Draw",dp)}
    const t=o.total||{},op=price(t.over),up=price(t.under);
    const ol=line(t.over?.close?.line??t.over?.line),ul=line(t.under?.close?.line??t.under?.line);
    if(ol&&ol===ul&&op!=null&&up!=null){add("Over "+ol+" Goals",op);add("Under "+ol+" Goals",up)}
    // Additional ESPN pickcenter shape, still requiring an explicit provider.
    const pH=price(o.homeTeamOdds?.moneyLine),pD=price(o.drawOdds?.moneyLine),pA=price(o.awayTeamOdds?.moneyLine);
    if(pH!=null&&pD!=null&&pA!=null){add(home+" ML",pH);add(away+" ML",pA);add("Draw",pD)}
    const lt=line(o.overUnder),pO=price(o.overOdds),pU=price(o.underOdds);
    if(lt&&pO!=null&&pU!=null){add("Over "+lt+" Goals",pO);add("Under "+lt+" Goals",pU)}
  }
  return{id:String(e.id),date:e.date,home,away,prices:[...markets.values()]};
}
export default async function handler(req,res){
  const date=String(req.query?.date||"");
  if(!dateOK.test(date)||!Number.isFinite(Date.parse(date+"T12:00:00Z")))return res.status(400).json({error:"Invalid date",events:[]});
  const now=new Date(),parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now).map(x=>[x.type,x.value]));
  const today=parts.year+"-"+parts.month+"-"+parts.day;
  if(date!==today)return res.status(200).json({date,events:[],source:"none"});
  const observedAt=now.toISOString();
  try{
    const url="https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates="+date.replaceAll("-","")+"&limit=1000";
    const r=await fetch(url,{signal:AbortSignal.timeout(9500),headers:{accept:"application/json"}});
    if(!r.ok)throw new Error("ESPN unavailable");
    const data=await r.json();
    if(!Array.isArray(data.events))throw new Error("Invalid scoreboard");
    const events=data.events.map(x=>parseEvent(x,observedAt)).filter(x=>x?.prices.length);
    res.setHeader("Cache-Control","public, s-maxage=90, stale-while-revalidate=30");
    return res.status(200).json({date,observedAt,source:"ESPN-reported",events,
      quoteKind:"third-party observed, not direct sportsbook quote",
      note:"Only explicit bookmaker attribution, full soccer 1X2 and exact full-match totals are allowed. Verify prices with the sportsbook."});
  }catch{
    res.setHeader("Cache-Control","no-store");
    return res.status(503).json({date,source:"unavailable",events:[]});
  }
}
