import '../assets/board-availability.js';
const LEAGUE_NAMES = {
  "uefa.nations":"UEFA Nations League",
  "uefa.champions":"UEFA Champions League",
  "uefa.europa":"UEFA Europa League",
  "uefa.europa.conf":"UEFA Conference League",
  "eng.1":"Premier League","esp.1":"La Liga","ger.1":"Bundesliga","ita.1":"Serie A","fra.1":"Ligue 1",
  "ned.1":"Eredivisie","por.1":"Primeira Liga","usa.1":"MLS","mex.1":"Liga MX",
  "fifa.world":"FIFA World Cup","fifa.worldq.uefa":"World Cup Qualifying",
  "uefa.euro":"UEFA European Championship","uefa.euroq":"Euro Qualifying",
  "arg.1":"Argentina Primera","uru.1":"Uruguay Primera","col.1":"Colombia Primera A","par.1":"Paraguay Primera"
};



function americanToDecimal(v){
  if(v===null||v===undefined||v==="") return null;
  const n=Number(String(v).replace("+",""));
  if(!Number.isFinite(n)||n===0) return null;
  return Number((n>0?1+n/100:1+100/Math.abs(n)).toFixed(3));
}
function leagueCode(event){return globalThis.FootyEdgeAvailability.leagueOf(event)}
function numericLeagueId(event){
  const m=String(event?.uid||"").match(/~l:(\d+)/);
  return m ? Number(m[1]) : 0;
}
function scoreValue(v){
  const raw=(v&&typeof v==="object")?(v.value??v.displayValue):v;
  const n=Number(raw); return Number.isFinite(n)?n:null;
}
function statusShape(event){
  const t=event?.status?.type||{};
  const name=String(t.name||"");
  const detail=String(t.detail||"");
  const completed=Boolean(t.completed)||name.includes("FINAL");
  const lower=(name+" "+detail).toLowerCase();
  let short="NS";
  if(completed) short="FT";
  else if(lower.includes("half")) short="HT";
  else if(lower.includes("postpon")) short="PST";
  else if(lower.includes("cancel")) short="CANC";
  else if(lower.includes("progress")||lower.includes("1st")||lower.includes("2nd")) short=lower.includes("2nd")?"2H":"1H";
  return {short,long:detail||name,elapsed:event?.status?.displayClock||null};
}
function teamShape(c){
  return {
    id:Number(c?.id??c?.team?.id??0),
    name:c?.team?.displayName||c?.team?.name||"",
    logo:c?.team?.logo||c?.team?.logos?.[0]?.href||null,
    winner:Boolean(c?.winner)
  };
}
async function espnBoard(date){
  const key=String(date||"").replace(/-/g,"");
  const r=await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates="+encodeURIComponent(key)+"&limit=1000",{
    headers:{"accept":"application/json","user-agent":"FootyEdge/1.0"}
  });
  if(!r.ok) throw new Error("ESPN fallback "+r.status);
  return r.json();
}
function apiFootballFixtures(board){
  return (board?.events||[]).map(event=>{
    const comp=event?.competitions?.[0]||{};
    const list=comp?.competitors||[];
    const home=list.find(x=>x.homeAway==="home")||list[0]||{};
    const away=list.find(x=>x.homeAway==="away")||list[1]||{};
    const code=leagueCode(event);
    return {
      fixture:{
        id:Number(event.id),
        date:event.date,
        timestamp:event.date?Math.floor(new Date(event.date).getTime()/1000):null,
        timezone:"UTC",
        status:statusShape(event)
      },
      league:{id:numericLeagueId(event),name:LEAGUE_NAMES[code]||code||"Soccer",country:null,logo:null,flag:null,season:Number(event?.season?.year||0),round:event?.season?.slug||null},
      teams:{home:teamShape(home),away:teamShape(away)},
      goals:{home:scoreValue(home?.score),away:scoreValue(away?.score)},
      score:{halftime:{home:null,away:null},fulltime:{home:scoreValue(home?.score),away:scoreValue(away?.score)},extratime:{home:null,away:null},penalty:{home:null,away:null}}
    };
  });
}
function apiFootballOdds(board){
  const out=[];
  for(const event of board?.events||[]){
    const comp=event?.competitions?.[0]||{};
    const o=comp?.odds?.[0];
    if(!o) continue;
    const bets=[];
    const ml=o?.moneyline||{};
    const mlValues=[];
    if(ml?.home?.close?.odds!=null) mlValues.push({value:"Home",odd:String(americanToDecimal(ml.home.close.odds))});
    if(ml?.draw?.close?.odds!=null) mlValues.push({value:"Draw",odd:String(americanToDecimal(ml.draw.close.odds))});
    if(ml?.away?.close?.odds!=null) mlValues.push({value:"Away",odd:String(americanToDecimal(ml.away.close.odds))});
    if(mlValues.length) bets.push({id:1,name:"Match Winner",values:mlValues});

    const total=o?.total||{};
    const totalValues=[];
    if(total?.over?.close?.odds!=null) totalValues.push({value:String(total.over.close.line||"Over 2.5").replace(/^o/i,"Over "),odd:String(americanToDecimal(total.over.close.odds))});
    if(total?.under?.close?.odds!=null) totalValues.push({value:String(total.under.close.line||"Under 2.5").replace(/^u/i,"Under "),odd:String(americanToDecimal(total.under.close.odds))});
    if(totalValues.length) bets.push({id:5,name:"Goals Over/Under",values:totalValues});

    if(!bets.length) continue;
    const code=leagueCode(event);
    out.push({
      league:{id:numericLeagueId(event),name:LEAGUE_NAMES[code]||code||"Soccer"},
      fixture:{id:Number(event.id),timezone:"UTC",date:event.date,timestamp:event.date?Math.floor(new Date(event.date).getTime()/1000):null},
      update:new Date().toISOString(),
      bookmakers:[{id:100,name:o?.provider?.displayName||o?.provider?.name||"DraftKings",bets}]
    });
  }
  return out;
}
async function fallback(endpoint,query){
  if(endpoint==="fixtures"||endpoint==="odds"){
    const board=await espnBoard(query.date);
    const response=endpoint==="fixtures"?apiFootballFixtures(board):apiFootballOdds(board);
    return {get:endpoint,parameters:query,errors:{},results:response.length,paging:{current:1,total:1},response,_footyedgeFallback:"ESPN"};
  }
  return {get:endpoint,parameters:query,errors:{},results:0,paging:{current:1,total:1},response:[],_footyedgeFallback:"ESPN"};
}

export default async function handler(req, res) {
  try {
    const key = process.env.FOOTBALL;
    const endpoint = req.query.endpoint;
    const allowed = ["fixtures","odds","fixtures/lineups","injuries","predictions","teams","players","standings"];

    if (!allowed.includes(endpoint)) {
      return res.status(400).json({ok:false,error:"Unsupported endpoint"});
    }

    const query={};
    const params=new URLSearchParams();
    for(const [keyName,value] of Object.entries(req.query)){
      if(keyName==="endpoint"||keyName==="_vercel_share") continue;
      if(Array.isArray(value)){
        query[keyName]=value;
        value.forEach(v=>params.append(keyName,v));
      }else if(value!==undefined){
        query[keyName]=value;
        params.set(keyName,value);
      }
    }

    let data=null;
    let status=200;

    if(key){
      try{
        const url="https://v3.football.api-sports.io/"+endpoint+(params.toString()?"?"+params:"");
        const response=await fetch(url,{headers:{"x-apisports-key":key}});
        status=response.status;
        data=await response.json();
      }catch(error){
        data=null;
      }
    }

    const quotaHit=Boolean(data?.errors?.requests)||status===429;
    const providerError=Object.values(data?.errors||{}).some(Boolean);
    const unusable=!data||quotaHit||providerError||status>=400||(!key);

    if(unusable){
      data=await fallback(endpoint,query);
      status=200;
    }else if(data&&typeof data==="object"){
      data._footyedgeSource="API-SPORTS";
    }

    const ttl=endpoint==="odds"?600:120; res.setHeader("Cache-Control",`public, s-maxage=${ttl}, stale-while-revalidate=${ttl}`);
    return res.status(status).json(data);
  } catch (error) {
    try{
      const endpoint=req.query.endpoint;
      const query=Object.fromEntries(Object.entries(req.query).filter(([k])=>k!=="endpoint"&&k!=="_vercel_share"));
      const data=await fallback(endpoint,query);
      return res.status(200).json(data);
    }catch{
      return res.status(500).json({ok:false,error:String(error)});
    }
  }
}
