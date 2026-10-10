import fs from "node:fs";
import path from "node:path";

const DATE="2026-10-10";
const BOARD_PATH=`data/boards/${DATE}.json`;
const FIXTURES_PATH=`data/${DATE}/fixtures.json`;
const ODDS_PATH=`data/${DATE}/odds.json`;
const REV_DIR=`data/board-revisions/${DATE}`;

const oldBoard=JSON.parse(fs.readFileSync(BOARD_PATH,"utf8"));
const fixtures=JSON.parse(fs.readFileSync(FIXTURES_PATH,"utf8")).response||[];
const odds=JSON.parse(fs.readFileSync(ODDS_PATH,"utf8")).response||[];
const fixtureById=new Map(fixtures.map(x=>[String(x.fixture?.id),x]));
const oddsById=new Map(odds.map(x=>[String(x.fixture?.id),x]));
const oldById=new Map((oldBoard.games||[]).map(g=>[String(g.id),g]));
const before=fs.readFileSync(BOARD_PATH,"utf8");

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const pct=x=>Math.round(clamp(x)*100);
const decimalToAmerican=d=>d>=2?Math.round((d-1)*100):Math.round(-100/(d-1));
const americanText=d=>{const a=decimalToAmerican(d);return a>0?"+"+a:String(a)};
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const noVig=arr=>{const p=arr.map(x=>1/x),s=p.reduce((a,b)=>a+b,0);return p.map(x=>x/s)};
const pickStars=s=>s>=92?"★★★★★":s>=88?"★★★★½":s>=83?"★★★★":s>=78?"★★★½":"★★★";
const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

async function fetchJson(url){
  for(let attempt=0;attempt<3;attempt++){
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
    try{
      const r=await fetch(url,{signal:ctrl.signal,headers:{
        "User-Agent":"Mozilla/5.0 (FootyEdge static research; GitHub Actions)",
        "Accept":"application/json,text/plain,*/*",
        "Referer":"https://www.espn.com/"
      }});
      clearTimeout(timer);
      if(r.ok)return await r.json();
      if(r.status!==429&&r.status<500)throw new Error(`HTTP ${r.status}`);
    }catch(e){clearTimeout(timer);if(attempt===2)throw e}
    await sleep(500*(attempt+1));
  }
}
const scheduleCache=new Map();
async function schedule(league,teamId,season){
  const key=`${league}:${teamId}:${season}`;if(scheduleCache.has(key))return scheduleCache.get(key);
  const leagueUrl=`https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(league)}/teams/${encodeURIComponent(teamId)}/schedule?season=${season}`;
  const allUrl=`https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${encodeURIComponent(teamId)}/schedule?season=${season}`;
  const p=(async()=>{
    const leaguePayload=await fetchJson(leagueUrl).catch(()=>null);
    if(Array.isArray(leaguePayload?.events)&&leaguePayload.events.length)return leaguePayload;
    return await fetchJson(allUrl).catch(()=>({events:[]}));
  })();
  scheduleCache.set(key,p);return p
}

const summaryCache=new Map();
async function matchSummary(league,eventId){
  const key=league+":"+eventId;if(summaryCache.has(key))return summaryCache.get(key);
  const p=fetchJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(league)}/summary?event=${encodeURIComponent(eventId)}`).catch(()=>null);
  summaryCache.set(key,p);return p
}
function summaryH2H(s){
  const series=(s?.seasonseries||[]).find(x=>x?.type==="head-to-head");
  return(series?.events||[]).filter(e=>e?.statusType?.completed).slice(0,5).map(e=>{
    const h=(e.competitors||[]).find(x=>x.homeAway==="home"),a=(e.competitors||[]).find(x=>x.homeAway==="away");
    const hs=Number(h?.score),as=Number(a?.score);
    return h&&a&&Number.isFinite(hs)&&Number.isFinite(as)?{id:String(e.id),date:e.date,home:h.team?.displayName||"Home",away:a.team?.displayName||"Away",homeScore:hs,awayScore:as}:null
  }).filter(Boolean)
}
function summaryGames(s,teamId){
  const item=(s?.lastFiveGames||[]).find(x=>String(x?.team?.id)===String(teamId)),out=[];
  for(const e of item?.events||[]){
    const home=String(e.homeTeamId)===String(teamId),gf=Number(home?e.homeTeamScore:e.awayTeamScore),ga=Number(home?e.awayTeamScore:e.homeTeamScore);
    if(Number.isFinite(gf)&&Number.isFinite(ga))out.push({id:String(e.id),date:e.gameDate,gf,ga,result:gf>ga?"W":gf<ga?"L":"D"})
  }
  return out
}
function summaryRanks(s,homeId,awayId){
  const found={};const walk=x=>{if(!x||typeof x!=="object")return;if(Array.isArray(x)){x.forEach(walk);return}
    if(x.id!=null&&Array.isArray(x.stats)){const r=x.stats.find(q=>q?.name==="rank"||q?.type==="rank");if(r)found[String(x.id)]=Number(r.value??r.displayValue)}
    Object.values(x).forEach(walk)
  };walk(s?.standings);
  return{home:Number.isInteger(found[String(homeId)])?found[String(homeId)]:null,away:Number.isInteger(found[String(awayId)])?found[String(awayId)]:null}
}
function americanToDecimal(a){a=Number(a);return !Number.isFinite(a)||a===0?null:a>0?1+a/100:1+100/Math.abs(a)}
function summaryOdds(s){
  const p=(s?.pickcenter||[]).find(x=>/draftkings/i.test(x?.provider?.name||""))||(s?.pickcenter||[])[0];if(!p)return null;
  const bets=[],hm=Number(p.homeTeamOdds?.moneyLine),dm=Number(p.drawOdds?.moneyLine),am=Number(p.awayTeamOdds?.moneyLine);
  if([hm,dm,am].every(Number.isFinite))bets.push({name:"Match Winner",values:[{value:"Home",odd:americanToDecimal(hm)},{value:"Draw",odd:americanToDecimal(dm)},{value:"Away",odd:americanToDecimal(am)}]});
  const line=Number(p.overUnder),oo=Number(p.overOdds),uo=Number(p.underOdds);
  if(Number.isFinite(line)&&Number.isFinite(oo)&&Number.isFinite(uo))bets.push({name:"Goals Over/Under",values:[{value:`Over ${line}`,odd:americanToDecimal(oo)},{value:`Under ${line}`,odd:americanToDecimal(uo)}]});
  return bets.length?{bookmakers:[{name:"DraftKings",bets}]}:null
}

function scoreVal(s){
  if(s==null)return null;
  const v=typeof s==="object"?(s.value??s.displayValue):s;
  const n=Number(v);return Number.isFinite(n)?n:null
}
function extractTeamGames(payload,teamId,before){
  const out=[];
  for(const e of payload?.events||[]){
    if(!e?.date||Date.parse(e.date)>=Date.parse(before)||!e?.status?.type?.completed)continue;
    const cs=e?.competitions?.[0]?.competitors||[];
    const me=cs.find(c=>String(c?.id??c?.team?.id)===String(teamId));
    const op=cs.find(c=>String(c?.id??c?.team?.id)!==String(teamId));
    if(!me||!op)continue;
    const gf=scoreVal(me.score),ga=scoreVal(op.score);if(gf==null||ga==null)continue;
    out.push({id:String(e.id),date:e.date,gf,ga,result:gf>ga?"W":gf<ga?"L":"D",homeAway:me.homeAway||null,team:me?.team?.displayName||me?.team?.name||"Team",oppId:String(op?.id??op?.team?.id??""),opp:op?.team?.displayName||op?.team?.name||"Opponent"});
  }
  return out
}
function stats(games){
  const g=games.slice(0,10),n=g.length||1;
  const count=fn=>g.filter(fn).length;
  return{
    n:g.length,form:g.slice(0,5).map(x=>x.result).join(" "),
    wins:count(x=>x.result==="W"),draws:count(x=>x.result==="D"),losses:count(x=>x.result==="L"),
    win:count(x=>x.result==="W")/n,draw:count(x=>x.result==="D")/n,loss:count(x=>x.result==="L")/n,
    scored:count(x=>x.gf>0)/n,conceded:count(x=>x.ga>0)/n,
    gf:mean(g.map(x=>x.gf)),ga:mean(g.map(x=>x.ga)),
    over15:count(x=>x.gf+x.ga>=2)/n,over25:count(x=>x.gf+x.ga>=3)/n,over35:count(x=>x.gf+x.ga>=4)/n,over45:count(x=>x.gf+x.ga>=5)/n,
    under15:count(x=>x.gf+x.ga<=1)/n,under25:count(x=>x.gf+x.ga<=2)/n,under35:count(x=>x.gf+x.ga<=3)/n,under45:count(x=>x.gf+x.ga<=4)/n,
    btts:count(x=>x.gf>0&&x.ga>0)/n
  }
}
function h2hFrom(events,homeId,awayId,before){
  const seen=new Set(),out=[];
  for(const e of events){
    const id=String(e?.id||"");if(!id||seen.has(id)||Date.parse(e?.date||"")>=Date.parse(before)||!e?.status?.type?.completed)continue;
    const cs=e?.competitions?.[0]?.competitors||[];
    if(!cs.some(c=>String(c?.id??c?.team?.id)===String(homeId))||!cs.some(c=>String(c?.id??c?.team?.id)===String(awayId)))continue;
    const h=cs.find(c=>c.homeAway==="home"),a=cs.find(c=>c.homeAway==="away");if(!h||!a)continue;
    const hs=scoreVal(h.score),as=scoreVal(a.score);if(hs==null||as==null)continue;
    seen.add(id);out.push({id,date:e.date,home:h.team?.displayName||h.team?.name||"Home",away:a.team?.displayName||a.team?.name||"Away",homeScore:hs,awayScore:as});
  }
  return out.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,5)
}
function makePick({label,category,decimal,marketProb,trendProb,h2hProb=null,evidence=[]}){
  const hWeight=h2hProb==null?0:.12,baseWeight=1-hWeight;
  const modelProb=clamp((.30*marketProb+.70*trendProb)*baseWeight+(h2hProb??0)*hWeight);
  const score=pct(modelProb),odds=decimalToAmerican(decimal),ev=(modelProb*decimal-1)*100;
  return{
    label,category,score,stars:pickStars(score),odds,displayOdds:odds>0?"+"+odds:String(odds),
    priceDecimal:decimal,verifiedPrice:true,bookExact:true,provider:"DraftKings",bookKey:"draftkings",priceStatus:"verified",
    marketProb,modelProb,ev:Number(ev.toFixed(1)),probabilityBasis:"30% no-vig market / 70% recent form; 12% H2H weight where available; uncalibrated",reason:evidence[0]||"Verified market and recent form align.",
    archivedCommentary:evidence.slice(0,3).join(" "),archivedSupportFacts:evidence.slice(0,3)
  }
}
function candidateSet(game,fx,od,hs,as,h2h){
  const book=(od?.bookmakers||[]).find(b=>/draftkings/i.test(b.name||""))||(od?.bookmakers||[])[0];
  if(!book)return[];
  const winner=(book.bets||[]).find(b=>/match winner/i.test(b.name||""));
  const total=(book.bets||[]).find(b=>/goals over\/under|over\/under/i.test(b.name||""));
  const home=fx.teams.home.name,away=fx.teams.away.name;
  const out=[];
  if(winner){
    const vals=Object.fromEntries((winner.values||[]).map(v=>[norm(v.value),Number(v.odd)]));
    const ds=[vals.home,vals.draw,vals.away];
    if(ds.every(x=>Number.isFinite(x)&&x>1)){
      const [hp,dp,ap]=noVig(ds);
      const h2hHome=h2h.length?mean(h2h.map(m=>m.home===home?(m.homeScore>m.awayScore?1:m.homeScore===m.awayScore?.5:0):(m.away===home?(m.awayScore>m.homeScore?1:m.awayScore===m.homeScore?.5:0):.5))):null;
      const h2hAway=h2hHome==null?null:1-h2hHome;
      // Directional matchup model: attacking form, opponent resistance and draw exposure.
      // The two sides are evaluated symmetrically; H2H contributes separately in makePick.
      const homeTrend=clamp(.58*hs.win+.42*as.loss-.20*mean([hs.draw,as.draw]));
      const awayTrend=clamp(.58*as.win+.42*hs.loss-.20*mean([hs.draw,as.draw]));
      const drawTrend=mean([hs.draw,as.draw]);
      out.push(makePick({label:home+" ML",category:"Match Result",decimal:ds[0],marketProb:hp,trendProb:clamp(homeTrend),h2hProb:h2hHome,evidence:[
        `${home} won ${hs.wins} of its last ${hs.n||0}; ${away} lost ${as.losses} of its last ${as.n||0}.`,
        `DraftKings posted ${home} ML at ${americanText(ds[0])}.`,
        h2h.length?`The verified H2H sample covers ${h2h.length} recent meeting${h2h.length===1?"":"s"}.`:"No usable recent H2H was added to this rating."
      ]}));
      out.push(makePick({label:"Draw",category:"Match Result",decimal:ds[1],marketProb:dp,trendProb:drawTrend,evidence:[
        `${home} drew ${hs.draws} of its last ${hs.n||0}; ${away} drew ${as.draws} of its last ${as.n||0}.`,
        `DraftKings posted the draw at ${americanText(ds[1])}.`
      ]}));
      out.push(makePick({label:away+" ML",category:"Match Result",decimal:ds[2],marketProb:ap,trendProb:clamp(awayTrend),h2hProb:h2hAway,evidence:[
        `${away} won ${as.wins} of its last ${as.n||0}; ${home} lost ${hs.losses} of its last ${hs.n||0}.`,
        `DraftKings posted ${away} ML at ${americanText(ds[2])}.`,
        h2h.length?`The verified H2H sample covers ${h2h.length} recent meeting${h2h.length===1?"":"s"}.`:"No usable recent H2H was added to this rating."
      ]}));
    }
  }
  if(total){
    const vals=(total.values||[]).map(v=>({label:String(v.value),decimal:Number(v.odd)})).filter(x=>Number.isFinite(x.decimal)&&x.decimal>1);
    const over=vals.find(x=>/^over/i.test(x.label)),under=vals.find(x=>/^under/i.test(x.label));
    if(over&&under){
      const m=over.label.match(/([0-9]+(?:\.[0-9]+)?)/),line=m?Number(m[1]):null;
      if(line!=null){
        const [op,up]=noVig([over.decimal,under.decimal]);
        const keyOver=line===1.5?"over15":line===2.5?"over25":line===3.5?"over35":line===4.5?"over45":null;
        const keyUnder=line===1.5?"under15":line===2.5?"under25":line===3.5?"under35":line===4.5?"under45":null;
        if(keyOver&&keyUnder){
          out.push(makePick({label:`Over ${line} Goals`,category:"Goals",decimal:over.decimal,marketProb:op,trendProb:mean([hs[keyOver],as[keyOver]]),evidence:[
            `${home} went over ${line} in ${Math.round(hs[keyOver]*(hs.n||0))}/${hs.n||0}; ${away} did so in ${Math.round(as[keyOver]*(as.n||0))}/${as.n||0}.`,
            `DraftKings posted Over ${line} at ${americanText(over.decimal)}.`
          ]}));
          out.push(makePick({label:`Under ${line} Goals`,category:"Goals",decimal:under.decimal,marketProb:up,trendProb:mean([hs[keyUnder],as[keyUnder]]),evidence:[
            `${home} stayed under ${line} in ${Math.round(hs[keyUnder]*(hs.n||0))}/${hs.n||0}; ${away} did so in ${Math.round(as[keyUnder]*(as.n||0))}/${as.n||0}.`,
            `DraftKings posted Under ${line} at ${americanText(under.decimal)}.`
          ]}));
        }
      }
    }
  }
  return out.filter(p=>p.priceDecimal>=1.20).sort((a,b)=>b.score-a.score||b.modelProb-a.modelProb);
}

async function mapLimit(items,limit,fn){
  const out=new Array(items.length);let next=0;
  const workers=Array.from({length:Math.min(limit,items.length)},async()=>{for(;;){const i=next++;if(i>=items.length)return;out[i]=await fn(items[i],i)}});
  await Promise.all(workers);return out
}

const years=[2026,2025,2024,2023,2022];
const formSourceDiagnostics=[];
const corrected=JSON.parse(JSON.stringify(oldBoard));
corrected.games=await mapLimit(oldBoard.games||[],10,async old=>{
  const fx=fixtureById.get(String(old.id));if(!fx)return old;
  const homeId=fx.teams.home.id,awayId=fx.teams.away.id,before=fx.fixture.date;
  const [homePayloads,awayPayloads,summary]=await Promise.all([
    Promise.all(years.map(y=>schedule(old.league,homeId,y))),
    Promise.all(years.map(y=>schedule(old.league,awayId,y))),
    matchSummary(old.league,old.id)
  ]);
  const homeGames=homePayloads.flatMap(p=>extractTeamGames(p,homeId,before)).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
  const awayGames=awayPayloads.flatMap(p=>extractTeamGames(p,awayId,before)).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
  let hs=stats([...new Map(homeGames.map(x=>[x.id,x])).values()].slice(0,10));
  let as=stats([...new Map(awayGames.map(x=>[x.id,x])).values()].slice(0,10));
  const sh=stats(summaryGames(summary,homeId)),sa=stats(summaryGames(summary,awayId));
  if(formSourceDiagnostics.length<5){
    formSourceDiagnostics.push({fixture:fx.teams.home.name+" vs "+fx.teams.away.name,id:String(old.id),league:old.league,
      homeId:String(homeId),awayId:String(awayId),scheduleHome:hs.n,scheduleAway:as.n,summaryHome:sh.n,summaryAway:sa.n,
      lastFiveShape:(summary?.lastFiveGames||[]).slice(0,3).map(x=>({keys:Object.keys(x||{}),teamId:x?.team?.id,team:x?.team?.displayName,eventCount:x?.events?.length,firstEvent:x?.events?.[0]||null})),
      seasonSeries:(summary?.seasonseries||[]).slice(0,2).map(x=>({type:x?.type,events:x?.events?.length})),
      summaryAvailable:Boolean(summary)});
  }
  if(hs.n<5&&sh.n>hs.n)hs=sh;if(as.n<5&&sa.n>as.n)as=sa;
  const directH2H=homeGames.filter(x=>String(x.oppId)===String(awayId)||norm(x.opp)===norm(fx.teams.away.name)).slice(0,5).map(x=>{
    const homeSide=x.homeAway==="home";
    return{
      id:x.id,date:x.date,
      home:homeSide?fx.teams.home.name:fx.teams.away.name,
      away:homeSide?fx.teams.away.name:fx.teams.home.name,
      homeScore:homeSide?x.gf:x.ga,
      awayScore:homeSide?x.ga:x.gf
    };
  });
  const summaryH=summaryH2H(summary);
  const h2h=summaryH.length?summaryH:(directH2H.length?directH2H:h2hFrom([...homePayloads.flatMap(p=>p.events||[]),...awayPayloads.flatMap(p=>p.events||[])],homeId,awayId,before));
  const allCandidates=candidateSet(old,fx,oddsById.get(String(old.id))||summaryOdds(summary),hs,as,h2h);
  const pickSide=p=>/^over\s/i.test(p.label||"")?"over":/^under\s/i.test(p.label||"")?"under":null;
  const coherent=(p,chosen)=>!chosen.some(q=>{
    const a=pickSide(p),b=pickSide(q);
    if(a&&b&&a!==b)return true;
    if(a&&b&&a===b)return true;
    if(/^BTTS /i.test(p.label||'')&&/^BTTS /i.test(q.label||''))return true;
    const result=x=>/\sML$/i.test(x.label||"")||/^Draw$/i.test(x.label||"");
    return result(p)&&result(q);
  });
  const candidates=allCandidates.filter(p=>{
    const f=p.category==="Goals"?(/over/i.test(p.label)?mean([hs.over25,as.over25]):mean([hs.under25,as.under25])):null;
    return f===null||f>=0.35;
  });
  const home=fx.teams.home.name,away=fx.teams.away.name;
  const research=[
    ["Over 1.5 Goals","Goals",(hs.over15+as.over15)/2,`${home} over 1.5: ${Math.round(hs.over15*hs.n)}/${hs.n}; ${away}: ${Math.round(as.over15*as.n)}/${as.n}.`],
    ["Under 3.5 Goals","Goals",(hs.under35+as.under35)/2,`${home} under 3.5: ${Math.round(hs.under35*hs.n)}/${hs.n}; ${away}: ${Math.round(as.under35*as.n)}/${as.n}.`],
    ["BTTS Yes","BTTS",(hs.btts+as.btts)/2,`BTTS: ${home} ${Math.round(hs.btts*hs.n)}/${hs.n}; ${away} ${Math.round(as.btts*as.n)}/${as.n}.`],
    ["BTTS No","BTTS",1-(hs.btts+as.btts)/2,`No BTTS: ${home} ${Math.round((1-hs.btts)*hs.n)}/${hs.n}; ${away} ${Math.round((1-as.btts)*as.n)}/${as.n}.`],
    ["Over 2.5 Goals","Goals",(hs.over25+as.over25)/2,`${home} over 2.5: ${Math.round(hs.over25*hs.n)}/${hs.n}; ${away}: ${Math.round(as.over25*as.n)}/${as.n}.`],
    ["Under 2.5 Goals","Goals",(hs.under25+as.under25)/2,`${home} under 2.5: ${Math.round(hs.under25*hs.n)}/${hs.n}; ${away}: ${Math.round(as.under25*as.n)}/${as.n}.`]
  ].filter(x=>hs.n>=5&&as.n>=5&&x[2]>=0.55).sort((a,b)=>b[2]-a[2]).map(([label,category,prob,reason])=>({
    label,category,score:Math.round(prob*100),stars:pickStars(Math.round(prob*100)),
    odds:null,displayOdds:"Not verified",verifiedPrice:false,bookExact:false,priceStatus:"unavailable",
    modelProb:prob,marketProb:null,ev:null,reason,archivedCommentary:reason,archivedSupportFacts:[reason],
    researchOnly:true
  }));
  const preserved=old.top?JSON.parse(JSON.stringify(old.top)):null;
  // A historical saved rating is not a fresh model probability. Re-evaluate priced picks.
  const repriced=preserved&&allCandidates.find(p=>norm(p.label)===norm(preserved.label));
  if(repriced){Object.assign(preserved,repriced,{reason:repriced.reason,archivedCommentary:repriced.archivedCommentary,archivedSupportFacts:repriced.archivedSupportFacts});}
  const selected=[];
  if(preserved)selected.push(preserved);
  for(const p of [...candidates,...research].filter(p=>p.score>=55)){
    if(selected.length===3)break;
    if(selected.some(q=>norm(q.label)===norm(p.label)))continue;
    if(!coherent(p,selected))continue;
    selected.push(p);
  }
  const top3=selected;
  const top=top3[0]||null;
  return{
    ...old,date:fx.fixture.date,year:fx.league.season,
    teams:{home:{id:String(homeId),name:fx.teams.home.name,logo:fx.teams.home.logo},away:{id:String(awayId),name:fx.teams.away.name,logo:fx.teams.away.logo}},
    h2h,verifiedRanks:summaryRanks(summary,homeId,awayId),staticDetails:true,
    top,top3,
    model:{...(old.model||{}),top,top3,candidates:top3,rankedCandidates:top3,researchCandidates:top3,home:hs,away:as,displayHome:hs,displayAway:as}
  }
});

// Confidence measures agreement of evidence with a pick, NOT its probability of winning.
// Recompute on every scheduled static build so old archived scores cannot return.
for(const g of corrected.games){
  const h=g.model?.home,a=g.model?.away;
  if(!h?.n||!a?.n)continue;
  for(const p of g.top3||[]){
    const l=String(p.label||"").toLowerCase();
    const ml=l.endsWith(" ml")?(l.startsWith(g.home.toLowerCase())?0:l.startsWith(g.away.toLowerCase())?1:-1):-1;
    let evidence=null;
    if(ml>=0){
      const f=ml===0?h:a,o=ml===0?a:h;
      const form=.45*(f.wins/f.n)+.30*(o.losses/o.n)+.15*clamp((f.gf-o.ga+1.5)/3)+.10*(1-(f.draws/f.n+o.draws/o.n)/2);
      const team=ml===0?g.home:g.away;
      const hh=g.h2h?.length?g.h2h.reduce((sum,m)=>{const home=m.home===team,go=home?m.homeScore:m.awayScore,against=home?m.awayScore:m.homeScore;return sum+(go>against?1:go===against?.5:0)},0)/g.h2h.length:null;
      evidence=hh==null?form:.82*form+.18*hh;
    }else if(l==="draw")evidence=(h.draws/h.n+a.draws/a.n)/2;
    else if(l.startsWith("btts")){evidence=(h.btts+a.btts)/2;if(l.includes("no"))evidence=1-evidence;}
    else{const m=l.match(/(over|under)\\s*(1\\.5|2\\.5|3\\.5|4\\.5)/);if(m){const k=m[1]+m[2].replace(".","");if(Number.isFinite(h[k])&&Number.isFinite(a[k]))evidence=(h[k]+a[k])/2;}}
    if(evidence==null)continue;
    const damp=.55+.45*Math.min(1,Math.min(h.n,a.n)/10);
    const base=Math.round(Math.max(20,Math.min(94,50+92*(evidence-.5)*damp)));
    const score=Math.round(Math.max(20,Math.min(94,50+(base-50)*1.9)));
    p.score=score;p.modelScore=score;p.stars=pickStars(score);
    p.confidenceType="evidence_based_pick_conviction";
    p.confidenceBasis="Model evidence conviction from form, opponent trends and verified H2H where available; not win probability.";
  }
  g.top=g.top3?.[0]||g.top;
  if(g.model){g.model.top=g.top;g.model.top3=g.top3;}
}
const confidenceRanked=corrected.games.filter(g=>g.top).sort((a,b)=>b.top.score-a.top.score);
corrected.top5=confidenceRanked.slice(0,5).map((g,i)=>({rank:i+1,gameId:g.id,home:g.home,away:g.away,pick:g.top}));
corrected.confidenceFramework="Evidence-based pick conviction, not win probability";

const gameById=new Map(corrected.games.map(g=>[String(g.id),g]));
const existingTop=(oldBoard.top5||[]).map(x=>gameById.get(String(x.gameId))).filter(Boolean);
const seen=new Set(existingTop.map(g=>String(g.id)));
const pool=corrected.games.filter(g=>g.top&&!seen.has(String(g.id))).sort((a,b)=>(b.top?.score||0)-(a.top?.score||0));
const topGames=[...existingTop,...pool].slice(0,5);
corrected.top5=topGames.map((g,i)=>({rank:i+1,gameId:g.id,home:g.home,away:g.away,pick:g.top}));
const leagues=[...new Set(corrected.games.map(g=>g.league).filter(Boolean))];
corrected.leagueTop5=Object.fromEntries(leagues.map(l=>[l,corrected.games.filter(g=>g.league===l&&g.top).sort((a,b)=>b.top.score-a.top.score).slice(0,5).map((g,i)=>({rank:i+1,gameId:g.id,home:g.home,away:g.away,pick:g.top}))]));
corrected.correctedAt=new Date().toISOString();
corrected.source="FootyEdge static GitHub board · audited owner correction";
corrected.correctionReason="Owner-authorized completion of the Oct 10 board directly in GitHub after upstream deployment/capture failures. Original frozen top selections are preserved; missing per-game Top 3, global Top 5 and static H2H were rebuilt from committed fixture/odds snapshots plus verified ESPN schedules.";
corrected.coverage="full-board-static";

fs.mkdirSync(REV_DIR,{recursive:true});
const backup=path.join(REV_DIR,"before-github-static-repair.json");
if(!fs.existsSync(backup))fs.writeFileSync(backup,before);
fs.writeFileSync(BOARD_PATH,JSON.stringify(corrected,null,2)+"\n");

const report={
  date:DATE,games:corrected.games.length,withTop3:corrected.games.filter(g=>(g.top3||[]).length===3).length,
  withAnyPicks:corrected.games.filter(g=>(g.top3||[]).length).length,withH2H:corrected.games.filter(g=>(g.h2h||[]).length).length,withRanks:corrected.games.filter(g=>g.verifiedRanks&&(g.verifiedRanks.home||g.verifiedRanks.away)).length,
  top5:corrected.top5.map(x=>({fixture:x.home+" vs "+x.away,pick:x.pick?.label,odds:x.pick?.odds,score:x.pick?.score}))
};
report.formSourceDiagnostics=formSourceDiagnostics;
report.formCoverage=corrected.games.reduce((a,g)=>{const h=g.model?.home?.n||0,w=g.model?.away?.n||0;if(h>=5&&w>=5)a.bothFive++;if(h>0)a.homeAny++;if(w>0)a.awayAny++;return a},{bothFive:0,homeAny:0,awayAny:0});
fs.writeFileSync(path.join(REV_DIR,"github-static-repair-report.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
