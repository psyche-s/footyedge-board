const API_BASE="https://api.the-odds-api.com/v4";
const CACHE_SECONDS=60;
const BUILD_TAG="v33";

const LEAGUE_HINTS={
  "uefa.nations":{keys:["soccer_uefa_nations_league"],aliases:["uefa nations league","nations league"]},
  "fifa.friendly":{keys:["soccer_international_friendlies","soccer_fifa_friendlies"],aliases:["international friendlies","international friendly","fifa friendlies","friendly games"]},
  "concacaf.nations.league":{keys:["soccer_concacaf_nations_league"],aliases:["concacaf nations league","concacaf nations"]},
  "uefa.champions":{keys:["soccer_uefa_champs_league"],aliases:["uefa champions league","champions league"]},
  "uefa.europa":{keys:["soccer_uefa_europa_league"],aliases:["uefa europa league","europa league"]},
  "uefa.europa.conf":{keys:["soccer_uefa_europa_conference_league"],aliases:["uefa europa conference league","conference league"]},
  "eng.1":{keys:["soccer_epl"],aliases:["english premier league","premier league","epl"]},
  "esp.1":{keys:["soccer_spain_la_liga"],aliases:["la liga","spain la liga"]},
  "ger.1":{keys:["soccer_germany_bundesliga"],aliases:["germany bundesliga","bundesliga"]},
  "ita.1":{keys:["soccer_italy_serie_a"],aliases:["italy serie a","serie a"]},
  "fra.1":{keys:["soccer_france_ligue_one"],aliases:["france ligue 1","ligue 1"]},
  "ned.1":{keys:["soccer_netherlands_eredivisie"],aliases:["netherlands eredivisie","eredivisie"]},
  "por.1":{keys:["soccer_portugal_primeira_liga"],aliases:["portugal primeira liga","primeira liga"]},
  "usa.1":{keys:["soccer_usa_mls"],aliases:["major league soccer","mls"]},
  "mex.1":{keys:["soccer_mexico_ligamx"],aliases:["mexico liga mx","liga mx"]},
  "fifa.world":{keys:["soccer_fifa_world_cup"],aliases:["fifa world cup","world cup"]},
  "fifa.worldq.uefa":{keys:["soccer_fifa_world_cup_qualifiers_europe"],aliases:["world cup qualifiers europe","world cup qualification uefa","fifa world cup qualifiers"]},
  "uefa.euro":{keys:["soccer_uefa_european_championship"],aliases:["uefa european championship","european championship","euro"]},
  "uefa.euroq":{keys:["soccer_uefa_euro_qualification"],aliases:["euro qualification","european championship qualification"]},
  "arg.1":{keys:["soccer_argentina_primera_division"],aliases:["argentina primera division","argentina primera"]},
  "uru.1":{keys:["soccer_uruguay_primera_division"],aliases:["uruguay primera division","uruguay primera"]},
  "col.1":{keys:["soccer_colombia_primera_a"],aliases:["colombia primera a","categoria primera a"]},
  "par.1":{keys:["soccer_paraguay_primera_division"],aliases:["paraguay primera division","paraguay primera"]}
};

function norm(v=""){
  return String(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
}
function torontoDate(){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return p.year+"-"+p.month+"-"+p.day;
}
function median(nums){
  const a=nums.filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return null;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function decimalFromAmerican(v){
  const n=Number(v);
  if(!Number.isFinite(n)||n===0)return null;
  return n>0?1+n/100:1+100/Math.abs(n);
}
function americanFromDecimal(v){
  const d=Number(v);
  if(!Number.isFinite(d)||d<=1)return null;
  return d>=2?Math.round((d-1)*100):Math.round(-100/(d-1));
}
function medianAmerican(values){
  const dec=values.map(decimalFromAmerican).filter(Boolean);
  const med=median(dec);
  return med?americanFromDecimal(med):null;
}
function noVig(a){
  const v=a.map(x=>Number.isFinite(x)&&x>0?x:0),s=v.reduce((x,y)=>x+y,0);
  return s?v.map(x=>x/s):v.map(()=>null);
}
function impliedAmerican(v){
  const n=Number(v);if(!Number.isFinite(n)||n===0)return null;
  return n>0?100/(n+100):Math.abs(n)/(Math.abs(n)+100);
}
function resolveSport(sports,league){
  const hint=LEAGUE_HINTS[league];if(!hint)return null;
  for(const key of hint.keys||[]){const exact=sports.find(s=>s.key===key);if(exact)return exact}
  const aliases=(hint.aliases||[]).map(norm);
  const soccer=sports.filter(s=>norm(s.group)==="soccer"&&!s.has_outrights);
  let best=null,bestScore=0;
  for(const s of soccer){
    const hay=norm([s.title,s.description,s.key].filter(Boolean).join(" "));
    let score=0;
    for(const alias of aliases){
      if(hay===alias)score=Math.max(score,100);
      else if(hay.includes(alias))score=Math.max(score,80+alias.split(" ").length);
      else{
        const words=alias.split(" ").filter(w=>w.length>2);
        const hit=words.filter(w=>hay.includes(w)).length;
        if(words.length)score=Math.max(score,Math.round(60*hit/words.length));
      }
    }
    if(score>bestScore){best=s;bestScore=score}
  }
  return bestScore>=55?best:null;
}
async function getJson(url){
  const r=await fetch(url,{headers:{"accept":"application/json","user-agent":"FootyEdge/1.0"}});
  const text=await r.text();let data;
  try{data=JSON.parse(text)}catch{throw new Error("Invalid odds response")}
  if(!r.ok){
    const e=new Error(data?.message||data?.error_code||("Odds API "+r.status));
    e.status=r.status;throw e;
  }
  return {data,headers:r.headers};
}
const BOOK_PRIORITY=["draftkings","fanduel","espnbet"];
const BOOK_LABELS={draftkings:"DraftKings",fanduel:"FanDuel",espnbet:"ESPN BET"};
function selectBook(books,key){return (books||[]).find(b=>b.key===key)}
function h2hFromBook(book,home,away){
  const m=(book?.markets||[]).find(x=>x.key==="h2h");if(!m)return null;
  const get=n=>{const o=(m.outcomes||[]).find(x=>norm(x.name)===norm(n));return o&&Number.isFinite(Number(o.price))?Number(o.price):null};
  const homeML=get(home),drawML=get("draw"),awayML=get(away);
  return homeML!=null&&awayML!=null?{homeML,drawML,awayML}:null
}
function totalsFromBook(book){
  const m=(book?.markets||[]).find(x=>x.key==="totals");if(!m)return{};
  const by={};
  for(const o of m.outcomes||[]){
    const line=Number(o.point),price=Number(o.price),side=norm(o.name);
    if(!Number.isFinite(line)||!Number.isFinite(price)||(side!=="over"&&side!=="under"))continue;
    const k=String(line);by[k]=by[k]||{};by[k][side]=price;
  }
  return by
}
function summarizeEvent(event,league){
  const home=event.home_team,away=event.away_team,books=event.bookmakers||[];
  let ml=null,mlBook=null;
  for(const key of BOOK_PRIORITY){
    const book=selectBook(books,key),x=h2hFromBook(book,home,away);
    if(x){ml=x;mlBook={key,name:BOOK_LABELS[key]};break}
  }
  const lines=new Set();
  for(const key of BOOK_PRIORITY){
    const book=selectBook(books,key),t=totalsFromBook(book);
    Object.keys(t).forEach(line=>lines.add(line));
  }
  const totals={};
  for(const line of [...lines].sort((a,b)=>Number(a)-Number(b))){
    for(const key of BOOK_PRIORITY){
      const book=selectBook(books,key),t=totalsFromBook(book)[line];
      if(t?.over!=null&&t?.under!=null){
        const nv=noVig([impliedAmerican(t.over),impliedAmerican(t.under)]);
        totals[line]={over:t.over,under:t.under,book:{key,name:BOOK_LABELS[key]},probs:{over:nv[0],under:nv[1]}};
        break
      }
    }
  }
  const homeML=ml?.homeML??null,drawML=ml?.drawML??null,awayML=ml?.awayML??null;
  const mlp=noVig([impliedAmerican(homeML),impliedAmerican(drawML),impliedAmerican(awayML)]);
  const t25=totals["2.5"]||{};
  return {
    id:event.id,league,sportKey:event.sport_key,sportTitle:event.sport_title,
    commenceTime:event.commence_time,home,away,
    provider:mlBook?.name||null,bookPriority:BOOK_PRIORITY,mlBook,
    homeML,drawML,awayML,over25:t25.over??null,under25:t25.under??null,totals,
    probs:{home:mlp[0],draw:mlp[1],away:mlp[2],over25:t25.probs?.over??null,under25:t25.probs?.under??null}
  };
}

export default async function handler(req,res){
  try{
    if(process.env.VERCEL_ENV&&process.env.VERCEL_ENV!=="production"){
      return res.status(200).json({enabled:false,reason:"production_only",events:[]});
    }
    const key=process.env.THEODDSAPI;
    if(!key)return res.status(200).json({enabled:false,reason:"missing_key",events:[]});
    if(String(req.query.live||"")!=="1")return res.status(200).json({enabled:false,reason:"live_only",events:[]});

    const date=String(req.query.date||"");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return res.status(400).json({error:"Invalid date"});
    const today=torontoDate(),horizon=new Date(today+"T12:00:00Z");horizon.setUTCDate(horizon.getUTCDate()+4);const maxDate=horizon.toISOString().slice(0,10);
    if(date<today||date>maxDate)return res.status(200).json({enabled:false,reason:"outside_5_day_horizon",today,maxDate,events:[]});
    const leagues=[...new Set(String(req.query.leagues||"").split(",").map(x=>x.trim()).filter(Boolean))].slice(0,12);
    if(!leagues.length)return res.status(200).json({enabled:true,events:[],sports:[]});

    const sportsUrl=API_BASE+"/sports/?apiKey="+encodeURIComponent(key);
    const sportsResult=await getJson(sportsUrl);
    const sports=Array.isArray(sportsResult.data)?sportsResult.data:[];
    const resolved=[];
    for(const league of leagues){
      const sport=resolveSport(sports,league);
      if(sport&&!resolved.some(x=>x.sport.key===sport.key))resolved.push({league,sport});
    }

    const from=new Date(date+"T00:00:00Z");
    const to=new Date(from.getTime()+36*60*60*1000);
    const fromIso=from.toISOString().replace(/\.000Z$/,"Z"),toIso=to.toISOString().replace(/\.000Z$/,"Z");
    const events=[],attempts=[];
    let remaining=null,used=null,last=null;
    const publish=String(req.query.publish||"")==="1";

    for(const {league,sport} of resolved){
      let eventCount=null,skipped=false;
      if(!publish){
        // Normal browsing conserves credits by checking the free events endpoint first.
        const eventsUrl=API_BASE+"/sports/"+encodeURIComponent(sport.key)+"/events?apiKey="+encodeURIComponent(key)+"&dateFormat=iso&commenceTimeFrom="+encodeURIComponent(fromIso)+"&commenceTimeTo="+encodeURIComponent(toIso);
        try{
          const eventCheck=await getJson(eventsUrl);
          eventCount=Array.isArray(eventCheck.data)?eventCheck.data.length:0;
          if(!eventCount){skipped=true;attempts.push({league,sportKey:sport.key,paidRequest:false,eventCount:0,reason:"no_free_events"});continue}
        }catch(error){
          attempts.push({league,sportKey:sport.key,paidRequest:false,eventCount:null,reason:"event_check_failed"});
          continue
        }
      }

      const oddsUrl=API_BASE+"/sports/"+encodeURIComponent(sport.key)+"/odds?apiKey="+encodeURIComponent(key)+"&bookmakers=draftkings,fanduel,espnbet&markets=h2h,totals&oddsFormat=american&dateFormat=iso&commenceTimeFrom="+encodeURIComponent(fromIso)+"&commenceTimeTo="+encodeURIComponent(toIso);
      try{
        const result=await getJson(oddsUrl),data=Array.isArray(result.data)?result.data:[];
        remaining=result.headers.get("x-requests-remaining")??remaining;
        used=result.headers.get("x-requests-used")??used;
        last=result.headers.get("x-requests-last")??last;
        attempts.push({league,sportKey:sport.key,paidRequest:true,eventCount:data.length,requestsLast:result.headers.get("x-requests-last")||null});
        for(const event of data)events.push(summarizeEvent(event,league));
      }catch(error){
        attempts.push({league,sportKey:sport.key,paidRequest:true,eventCount:0,error:error instanceof Error?error.message:String(error)});
      }
    }

    res.setHeader("Cache-Control",publish?"no-store":`public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=30`);
    return res.status(200).json({
      enabled:true,publish,bookmakerPriority:["draftkings","fanduel","espnbet"],markets:["h2h","totals"],events,
      sports:resolved.map(x=>({league:x.league,key:x.sport.key,title:x.sport.title})),
      attempts,quota:{remaining,used,last},fetchedAt:new Date().toISOString()
    });
  }catch(error){
    return res.status(200).json({enabled:true,events:[],error:error instanceof Error?error.message:String(error)});
  }
}
