import fs from 'node:fs/promises';
import path from 'node:path';
import {validateBoard} from './validate-published-boards.mjs';

// Audited last-resort delivery of evidence-only research after an upstream
// sportsbook quota outage. No sportsbook odds, EV, or forward win probability
// is estimated here. Historical trend percentages are not forecast probabilities.
const timeParts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
const DATE=timeParts.year+'-'+timeParts.month+'-'+timeParts.day;
const OUT=path.join('data','board-drafts',DATE+'.json');
const LOCK=path.join('data','boards',DATE+'.json');
const R=path.join('data','research-base-'+DATE+'.json');
const ODDS=path.join('data','daily-odds-'+DATE+'.json');
const read=async f=>JSON.parse(await fs.readFile(f,'utf8'));
const exists=async f=>fs.access(f).then(()=>true).catch(()=>false);
const LEAGUES={'eng.1':'Premier League','eng.2':'EFL Championship','tur.1':'Turkish Süper Lig','ksa.1':'Saudi Pro League','cze.1':'Czech First League','esp.1':'LaLiga','ita.1':'Serie A','ger.1':'Bundesliga','fra.1':'Ligue 1','ned.1':'Eredivisie','por.1':'Liga Portugal','usa.1':'MLS','fifa.friendly':'International Friendly','uefa.nations':'UEFA Nations League'};
const rates=hist=>{
  const n=hist.length;
  const rate=fn=>n?hist.filter(fn).length/n:null;
  return {n,form:hist.slice(0,5).map(x=>x.result).join(' '),gf:n?hist.reduce((a,x)=>a+x.gf,0)/n:0,ga:n?hist.reduce((a,x)=>a+x.ga,0)/n:0,
    o15:rate(x=>x.gf+x.ga>=2),o25:rate(x=>x.gf+x.ga>=3),u25:rate(x=>x.gf+x.ga<=2),u35:rate(x=>x.gf+x.ga<=3),u45:rate(x=>x.gf+x.ga<=4),
    btts:rate(x=>x.gf>0&&x.ga>0),scored:rate(x=>x.gf>0),conceded:rate(x=>x.ga>0),win:rate(x=>x.result==='W'),
    nonLoss:rate(x=>x.result!=='L'),nonWin:rate(x=>x.result!=='W')};
};
const star=s=>s>=92?'★★★★★':s>=88?'★★★★½':s>=83?'★★★★':s>=78?'★★★½':'★★★';
function generate(g){
  const H=(g.last10?.home||[]).filter(x=>Number.isFinite(x.gf)&&Number.isFinite(x.ga)&&Date.parse(x.date)<Date.parse(g.date)).slice(0,10);
  const A=(g.last10?.away||[]).filter(x=>Number.isFinite(x.gf)&&Number.isFinite(x.ga)&&Date.parse(x.date)<Date.parse(g.date)).slice(0,10);
  if(H.length<5||A.length<5)throw new Error('Fewer than five verified historical games for '+g.home.name+' vs '+g.away.name);
  const team=(t)=>({id:String(t.id),name:t.name,logo:/^\d+$/.test(String(t.id))?'https://a.espncdn.com/i/teamlogos/soccer/500/'+t.id+'.png':null,score:null});
  const home=team(g.home),away=team(g.away);
  const candidates=[];
  function angle(label,category,fH,fA,family){
    const h=H.filter(fH).length,a=A.filter(fA).length,n=H.length+A.length,observed=Math.round(100*(h+a)/n);
    if(Math.min(h/H.length,a/A.length)<0.60||observed<70)return;
    const facts=[g.home.name+': '+h+'/'+H.length+' recent games matched this trend.',g.away.name+': '+a+'/'+A.length+' recent games matched the corresponding trend.'];
    // Write like a football preview, based on the exact relevant match sample.
    let description='';
    if(category==='Goals'){
      const verb=label.startsWith('Over')?'finished with '+label.slice(5).toLowerCase():'stayed '+label.toLowerCase();
      description=g.home.name+' have '+verb+' in '+h+' of their last '+H.length+' matches, while '+g.away.name+' have done so in '+a+' of '+A.length+'.';
    }else if(category==='Team Goals'){
      const first=label.startsWith(g.home.name);
      const selected=first?g.home.name:g.away.name,opponent=first?g.away.name:g.home.name;
      description=selected+' have scored in '+(first?h:a)+' of their last '+(first?H.length:A.length)+' matches, and '+opponent+' have conceded in '+(first?a:h)+' of '+(first?A.length:H.length)+'.';
    }else if(category==='BTTS'){
      description=label.includes('No')?'Both sides have failed to produce goals at both ends regularly: '+h+' of '+H.length+' for '+g.home.name+' and '+a+' of '+A.length+' for '+g.away.name+'.':
        'Both teams scored in '+h+' of '+g.home.name+'\'s last '+H.length+' matches and '+a+' of '+g.away.name+'\'s last '+A.length+'.';
    }else if(category==='Double Chance'){
      description=g.home.name+' and '+g.away.name+' have matched this result protection in '+h+' of '+H.length+' and '+a+' of '+A.length+' recent matches respectively.';
    }else{
      description=label+' fits '+h+' of '+H.length+' recent games for '+g.home.name+' and '+a+' of '+A.length+' for '+g.away.name+'.';
    }
    const reason=description+' These figures describe recent results, not a guaranteed outcome. No verified sportsbook line is available.';
    candidates.push({label,category,family,score:observed,modelScore:null,baseScore:null,modelProb:null,marketProb:null,ev:null,
      odds:null,displayOdds:null,provider:null,bookKey:null,bookExact:false,verifiedPrice:false,priceEligible:false,
      confidenceType:'historical_trend_hit_rate',researchOnly:true,archivedCommentary:reason,
      archivedSupportFacts:facts,reason,stars:star(observed),historicalHits:h+a,historicalSample:n,homeHits:h,homeSample:H.length,awayHits:a,awaySample:A.length,crossSources:0});
  }
  angle('Over 1.5 Goals','Goals',x=>x.gf+x.ga>=2,x=>x.gf+x.ga>=2,'total-over');
  angle('Over 2.5 Goals','Goals',x=>x.gf+x.ga>=3,x=>x.gf+x.ga>=3,'total-over');
  angle('Under 3.5 Goals','Goals',x=>x.gf+x.ga<=3,x=>x.gf+x.ga<=3,'total-under');
  angle('Under 4.5 Goals','Goals',x=>x.gf+x.ga<=4,x=>x.gf+x.ga<=4,'total-under');
  angle('BTTS — Yes','BTTS',x=>x.gf>0&&x.ga>0,x=>x.gf>0&&x.ga>0,'btts');
  angle('BTTS — No','BTTS',x=>!(x.gf>0&&x.ga>0),x=>!(x.gf>0&&x.ga>0),'btts');
  angle(home.name+' 1+ Goal','Team Goals',x=>x.gf>0,x=>x.ga>0,'home-goals');
  angle(away.name+' 1+ Goal','Team Goals',x=>x.ga>0,x=>x.gf>0,'away-goals');
  angle(home.name+' or Draw','Double Chance',x=>x.result!=='L',x=>x.result!=='W','home-result');
  angle(away.name+' or Draw','Double Chance',x=>x.result!=='W',x=>x.result!=='L','away-result');
  angle(home.name+' ML','Match Result',x=>x.result==='W',x=>x.result==='L','home-result');
  angle(away.name+' ML','Match Result',x=>x.result==='L',x=>x.result==='W','away-result');
  candidates.sort((a,b)=>b.score-a.score||Math.min(b.homeHits/b.homeSample,b.awayHits/b.awaySample)-Math.min(a.homeHits/a.homeSample,a.awayHits/a.awaySample));
  const used=new Set(),top3=[];
  for(const p of candidates){if(used.has(p.family))continue;used.add(p.family);top3.push(p);if(top3.length===3)break;}
  for(const p of candidates)delete p.family;
  const recentHome=rates(H),recentAway=rates(A);
  const model={top:top3[0]||null,top3,candidates,rankedCandidates:[],researchCandidates:[],
    home:recentHome,away:recentAway,displayHome:recentHome,displayAway:recentAway,
    expectedGoals:{home:null,away:null,total:null},sample:{home:H.length,away:A.length,h2:0},
    trendFacts:Array.isArray(g.facts)?g.facts.slice(0,12):[],
    mode:'observed-history-only',note:'Percentages are observed historical rates, not statistically calibrated match probabilities.'};
  return{id:String(g.id),date:g.date,year:g.season||Number(DATE.slice(0,4)),league:g.league,leagueName:LEAGUES[g.league]||g.league,
    leagueLogo:null,home:home.name,away:away.name,teams:{home,away},
    teamNews:[],top:top3[0]||null,top3,model,
    h2h:[],staticDetails:true,recoveryStatus:'research-only-no-verified-native-odds'};
}
function topRefs(rows){
  return rows.map((g,i)=>({rank:i+1,gameId:g.id,home:g.home,away:g.away,pick:g.top}));
}
async function main(){
  const existing=await read(LOCK).catch(()=>null);
  if(existing?.date===DATE&&existing.top5?.length){console.log('Preserve published Top picks');return;}
  const odds=await read(ODDS).catch(()=>null);
  if(odds?.events?.length && odds.status!=='blocked' && process.env.FORCE_FALLBACK!=='1'){
    console.log('Native prices exist: defer to full original browser publication.');return;
  }
  const research=await read(R);
  if(research.date!==DATE||!Array.isArray(research.fixtures)||research.fixtures.length<1)throw new Error('Invalid matching-date research');
  if(research.fixtures.some(g=>(g.last10?.home||[]).length<5||(g.last10?.away||[]).length<5)){console.log('Incomplete team histories; skip unsupported recovery');return;}
  const games=research.fixtures.map(generate);
  // A history trend is not an exact-priced betting recommendation. When the
  // native sportsbook capture is blocked, retain the researched fixtures and
  // form context but publish explicit PASS rows instead of Top 3/Top 5 picks.
  if(!odds?.events?.length){
    for(const game of games){
      game.top=null;game.top3=[];
      game.model={...game.model,top:null,top3:[],candidates:[],rankedCandidates:[],researchCandidates:[]};
      game.recoveryStatus='pass-no-verified-native-odds';
    }
  }
  const unique=new Set(games.map(g=>g.id));
  if(unique.size!==games.length)throw new Error('Duplicate research fixture IDs; publication blocked');
  const ranked=arr=>arr.filter(g=>g.top&&g.top.score>=85&&Date.parse(g.date)>Date.now())
    .sort((a,b)=>b.top.score-a.top.score||Math.min(b.top.homeHits/b.top.homeSample,b.top.awayHits/b.top.awaySample)-Math.min(a.top.homeHits/a.top.homeSample,a.top.awayHits/a.awaySample))
    .slice(0,5);
  const leagueTop5={};
  for(const l of new Set(games.map(g=>g.league)))leagueTop5[l]=topRefs(ranked(games.filter(g=>g.league===l)));
  const board={schema:3,date:DATE,generatedAt:new Date().toISOString(),frozenAt:null,immutable:false,state:'preview',
    mutableUntil:DATE+' 00:30 America/Toronto',coverage:'full-board',source:'Audited research-only recovery from dated pre-match historical stats',
    top5:topRefs(ranked(games)),leagueTop5,games,
    scope:'mens-only-tracked-competitions',
    publicationNotes:'Exact native sportsbook prices were unavailable. Every fixture is an explicit PASS; no odds, confidence, EV, Top 3 or Top 5 recommendation was published.',
    dataSources:{researchBase:R,odds:'unavailable: provider usage quota exhausted'}};
  // Validate the exact same top-to-Top3 and reference invariants enforced for
  // official boards, without mutating any existing lock.
  const locked={...board,immutable:true,state:'locked',frozenAt:new Date().toISOString()};
  validateBoard(locked,{requireFull:true});
  await fs.mkdir(path.dirname(OUT),{recursive:true});
  await fs.writeFile(OUT,JSON.stringify(board,null,2)+'\n');
  console.log('Verified evidence-only recovery:',{date:DATE,games:games.length,top5:board.top5.length,priced:0,top3:games.filter(g=>g.top3.length===3).length});
}
main().catch(error=>{console.error(error);process.exitCode=1});
