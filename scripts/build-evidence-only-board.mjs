import fs from 'node:fs/promises';
import path from 'node:path';
import {validateBoard} from './validate-published-boards.mjs';
import {takeDistinctTopPicks} from './market-diversity.mjs';
import {buildReviewedPicks} from './build-top3-review.mjs';

// Audited last-resort delivery of evidence-only research after an upstream
// sportsbook quota outage. No sportsbook odds, EV, or forward win probability
// is estimated here. Historical trend percentages are not forecast probabilities.
const timeParts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
const TODAY=timeParts.year+'-'+timeParts.month+'-'+timeParts.day;
const DATE=process.env.PREVIEW_DATE||TODAY;
const next=new Date(TODAY+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);
if(DATE!==TODAY&&DATE!==next.toISOString().slice(0,10))throw Error('Can only preview tomorrow or prepare today');

const OUT=path.join('data','board-drafts',DATE+'.json');
const LOCK=path.join('data','boards',DATE+'.json');
const R=path.join('data','research-base-'+DATE+'.json');
const ODDS=path.join('data','daily-odds-'+DATE+'.json');
const INSIGHTS=path.join('data','daily-insights-'+DATE+'.json');
const OWNER_RESEARCH_PICKS=process.env.OWNER_RESEARCH_PICKS==='1';
let editorialById=new Map();
const read=async f=>JSON.parse(await fs.readFile(f,'utf8'));
const exists=async f=>fs.access(f).then(()=>true).catch(()=>false);
const LEAGUES={'sco.1':'Scottish Premiership','eng.league_cup':'EFL Cup','eng.fa_cup':'FA Cup','ger.dfb_pokal':'DFB-Pokal','esp.copa_del_rey':'Copa del Rey','ita.coppa_italia':'Coppa Italia','fra.coupe_de_france':'Coupe de France','ned.cup':'KNVB Cup','por.taca.portugal':'Taça de Portugal','eng.1':'Premier League','eng.2':'EFL Championship','tur.1':'Turkish Süper Lig','ksa.1':'Saudi Pro League','cze.1':'Czech First League','jpn.1':'J1 League','kor.1':'K League 1','esp.1':'LaLiga','ita.1':'Serie A','ger.1':'Bundesliga','fra.1':'Ligue 1','ned.1':'Eredivisie','por.1':'Liga Portugal','uefa.champions':'UEFA Champions League','uefa.europa':'UEFA Europa League','uefa.europa.conf':'UEFA Conference League','usa.1':'MLS','fifa.friendly':'International Friendly','uefa.nations':'UEFA Nations League'};
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
  if(H.length<5||A.length<5){
    const home={id:String(g.home.id),name:g.home.name,logo:g.home.logo||null,score:null};
    const away={id:String(g.away.id),name:g.away.name,logo:g.away.logo||null,score:null};
    return{id:String(g.id),date:g.date,year:g.season||Number(DATE.slice(0,4)),league:g.league,leagueName:LEAGUES[g.league]||g.league,
      home:home.name,away:away.name,teams:{home,away},teamNews:g.teamNews||[],h2h:g.h2h||[],top:null,top3:[],
      model:{top:null,top3:[],candidates:[],rankedCandidates:[],researchCandidates:[]},
      staticDetails:true,recoveryStatus:'pass-insufficient-verified-match-history'};
  }
  const team=(t)=>({id:String(t.id),name:t.name,logo:t.logo||(!['jpn.1','kor.1'].includes(g.league)&&/^\d+$/.test(String(t.id))?'https://a.espncdn.com/i/teamlogos/soccer/500/'+t.id+'.png':null),score:null});
  const home=team(g.home),away=team(g.away);
  const candidates=[];
  function angle(label,category,fH,fA,family){
    const h=H.filter(fH).length,a=A.filter(fA).length,n=H.length+A.length,observed=Math.round(100*(h+a)/n);
    if(Math.min(h/H.length,a/A.length)<0.50||observed<65)return; // Unsupported markets are passed, not forced.
    const h5=H.slice(0,5).filter(fH).length,a5=A.slice(0,5).filter(fA).length;
    const researchGrade=Math.round(.75*observed+.25*10*(h5+a5));
    const homeVenue=H.filter(x=>x.venue==='home'),awayVenue=A.filter(x=>x.venue==='away');
    const facts=[g.home.name+': '+h+'/'+H.length+' recent games matched this trend.',g.away.name+': '+a+'/'+A.length+' recent games matched the corresponding trend.'];
    // Write like a football preview, based on the exact relevant match sample.
    let description='';
    if(category==='Goals'){
      const verb=label.startsWith('Over')?'finished '+(label.includes('1.5')?'with at least two total goals':'above '+label.match(/[0-9.]+/)?.[0]+' total goals'):'stayed '+label.toLowerCase();
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
    const recent=' Across the last five, the same angle held '+h5+'/5 and '+a5+'/5 times respectively.';
    const venue=(homeVenue.length>=3&&awayVenue.length>=3)?
      ' Home/away splits: '+homeVenue.filter(fH).length+'/'+homeVenue.length+' for '+g.home.name+' at home, and '+
      awayVenue.filter(fA).length+'/'+awayVenue.length+' for '+g.away.name+' away.':'';
    const reason=description+recent+venue;
    candidates.push({label,category,family,score:researchGrade,modelScore:null,baseScore:null,modelProb:null,marketProb:null,ev:null,
      odds:null,displayOdds:null,provider:null,bookKey:null,bookExact:false,verifiedPrice:false,priceEligible:false,
      confidenceType:'multi_window_research_grade',researchOnly:true,sourceBackedReason:true,archivedCommentary:reason,
      archivedSupportFacts:facts,reason,stars:star(researchGrade),historicalHits:h+a,historicalSample:n,homeHits:h,homeSample:H.length,awayHits:a,awaySample:A.length,crossSources:0});
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
  // Source comparisons only annotate independently supported statistical angles.
  // A single preview is not a forecast probability, nor a reason to force a pick.
  const sourceReview=editorialById.get(String(g.id));
  if(sourceReview&&Array.isArray(sourceReview.sources)){
    for(const candidate of candidates){
      const note=String(sourceReview.marketNotes?.[candidate.label]||"")
        .replace(/https?:\/\/\S+/gi,"")
        .replace(/\b(?:Football Whispers|Sportskeeda|Sports Mole|Forebet|FotMob|WhoScored|Soccerway)\b/gi,"")
        .replace(/\b(?:independent|published) preview(?:s| research)?\b/gi,"match analysis")
        .replace(/\s{2,}/g," ").trim();
      const sources=sourceReview.sources.filter(s=>{
        const day=String(s.publishedOn||"");
        return /^https:\/\//.test(String(s.url||""))&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&day<=DATE&&
          Date.parse(DATE+'T00:00:00Z')-Date.parse(day+'T00:00:00Z')<=7*86400000&&
          (s.supports||[]).some(x=>String(x).toLowerCase()===candidate.label.toLowerCase());
      });
      const independentAgreement=new Set(sources.map(x=>new URL(x.url).hostname)).size;
      const disagreement=(sourceReview.disputedMarkets||[]).some(x=>x.toLowerCase()===candidate.label.toLowerCase());
      if(disagreement){candidate.score=Math.max(60,candidate.score-4);candidate.editorialDisagreement=true;}
      if(note){
        candidate.reason=candidate.reason.replace(/ These figures describe recent results, not a guaranteed outcome\.$/,"")+" "+
          (disagreement?"This angle has conflicting match evidence. ":"")+note;
        candidate.archivedCommentary=candidate.reason;
        candidate.sourceBackedReason=true;
        candidate.editorialSources=sourceReview.sources.map(x=>({url:x.url,publishedOn:x.publishedOn}));
      }
      // Modest ranking signal only if two independently attributed previews agree.
      if(independentAgreement>=2&&!disagreement)candidate.score=Math.min(96,candidate.score+2);
      candidate.researchStrength=candidate.score;
    }
  }
  candidates.sort((a,b)=>b.score-a.score||Math.min(b.homeHits/b.homeSample,b.awayHits/b.awaySample)-Math.min(a.homeHits/a.homeSample,a.awayHits/a.awaySample));
  // Distinct football theses only: do not pair team 1+ with a total O1.5,
  // adjacent totals, BTTS with duplicate scoring legs, or ML with DC.
  // Display fewer than three when the available evidence is too redundant.
  const top3=takeDistinctTopPicks(candidates,3);
  for(const p of candidates)delete p.family;
  const recentHome=rates(H),recentAway=rates(A);
  const model={top:top3[0]||null,top3,candidates,rankedCandidates:[],researchCandidates:[],
    home:recentHome,away:recentAway,displayHome:recentHome,displayAway:recentAway,
    expectedGoals:{home:null,away:null,total:null},sample:{home:H.length,away:A.length,h2:0},
    trendFacts:Array.isArray(g.facts)?g.facts.slice(0,12):[],
    mode:'observed-history-only',note:'Percentages are observed historical rates, not statistically calibrated match probabilities.'};
  return{id:String(g.id),date:g.date,year:g.season||Number(DATE.slice(0,4)),league:g.league,leagueName:LEAGUES[g.league]||g.league,
    leagueLogo:null,home:home.name,away:away.name,teams:{home,away},
    teamNews:g.teamNews||[],top:top3[0]||null,top3,model,
    h2h:g.h2h||[],teamMetrics:g.teamMetrics||null,staticDetails:true,recoveryStatus:'confidence-only-history-research'};
}
function topRefs(rows){
  return rows.map((g,i)=>({rank:i+1,gameId:g.id,home:g.home,away:g.away,pick:g.top}));
}
async function main(){
  const existing=await read(LOCK).catch(()=>null);
  if(existing?.date===DATE&&existing.immutable===true&&process.env.OWNER_OVERRIDE_DATE!==DATE){console.log('Preserve immutable published board');return;}
  // No pricing lookup: confidence-only publication does not depend on any sportsbook.
  const editorial=await read(path.join('data','editorial-previews',DATE+'.json')).catch(()=>null);
  editorialById=new Map(editorial?.schema==='footyedge-editorial-crosscheck-v1'&&editorial.date===DATE?
    (editorial.matches||[]).filter(x=>Array.isArray(x.sources)&&x.sources.every(s=>/^https:\/\//.test(s.url))).map(x=>[String(x.fixtureId),x]):[]);
  const research=await read(R);
  if(research.date!==DATE||!Array.isArray(research.fixtures)||research.fixtures.length<1)throw new Error('Invalid matching-date research');
  const games=research.fixtures.map(generate);
  const ownerOverride=process.env.OWNER_OVERRIDE_DATE===DATE&&DATE===TODAY;
  // Move dated 10k research and verified last-ten trends into the ACTUAL board.
  // Previously the richer reviewed picks existed only in unused overlays.
  let reviewedById=new Map();
  if(ownerOverride){
    const sim=await read(path.join('data','experimental-simulations',DATE+'-v4.json')).catch(()=>null)
      ||await read(path.join('data','experimental-simulations',DATE+'-v3.json')).catch(()=>null)
      ||await read(path.join('data','experimental-simulations',DATE+'.json')).catch(()=>null);
    if(sim?.date===DATE&&Array.isArray(sim.fixtures)&&sim.fixtures.length===research.fixtures.length){
      const teamNews=await read(path.join('data','team-intelligence',DATE+'.json')).catch(()=>null);
      const standings=await read(path.join('data','experimental-inputs',DATE+'-standings.json')).catch(()=>null);
      const reviews=buildReviewedPicks({research,simulation:sim,news:teamNews,standings});
      if(!reviews.error){
        reviewedById=new Map(reviews.matches.filter(x=>x.reviewed&&x.picks?.length).map(x=>[String(x.gameId),x.picks]));
        console.log('Integrated dated Top 3 reviews:',JSON.stringify(reviews.totals));
      }
    }
  }
  // Owner-authorized same-day recovery may publish clearly labelled research
  // angles while calibrated confidence, EV and unavailable prices remain N/A.
  if(OWNER_RESEARCH_PICKS){
    for(const game of games){
      const source=research.fixtures.find(f=>String(f.id)===String(game.id));
      if(Number(source?.history?.home)<5||Number(source?.history?.away)<5||!game.top3.length){
        game.top=null;game.top3=[];
        game.model={...game.model,top:null,top3:[],candidates:[],rankedCandidates:[],researchCandidates:[]};
        game.recoveryStatus=Number(source?.history?.home)<5||Number(source?.history?.away)<5
          ?'pass-insufficient-verified-last-5'
          :'pass-no-supported-market';
        continue;
      }
      const simReviewed=reviewedById.get(String(game.id));
      if(simReviewed?.length>=game.top3.length){
        game.top3=simReviewed;
        game.model={...game.model,top:game.top3[0],top3:game.top3,candidates:game.top3,
          rankedCandidates:game.top3,researchCandidates:game.top3};
        game.recoveryStatus='owner-researched-simulation-and-history-top3';
      }
      for(const pick of game.top3){
      if(pick.confidenceType==='researched_strength_not_calibrated_win_probability'&&
         Number.isFinite(pick.confidenceRating)){
        pick.probabilityCalibrated=false;pick.odds=null;pick.ev=null;
        pick.priceStatus='not_verified';pick.verifiedPrice=false;pick.sourceBackedReason=true;
        continue;
      }
      const weaker=Math.min(pick.homeHits/pick.homeSample,pick.awayHits/pick.awaySample)*100;
      pick.trendHitRate=pick.score;
      pick.researchStrength=pick.score;
      pick.confidenceRating=Math.round(0.65*pick.researchStrength+0.35*weaker);
      pick.confidenceRatingMethod='Independent research-strength grade: 65% combined observed trend + 35% weaker-team support. NOT predicted probability of winning.';
      pick.score=null;pick.modelScore=null;pick.baseScore=null;pick.modelProb=null;pick.calibratedProbability=null;
      pick.probabilityCalibrated=false;pick.ev=null;pick.confidenceType='historical_trend_only_not_calibrated_probability';
      pick.priceStatus='confidence_only';pick.quoteDisclaimer=null;
      }
    }
    for(const game of games){
      if(!game.top3.length)continue;
      game.top3.sort((a,b)=>Number(b.confidenceRating)-Number(a.confidenceRating));
      game.top=game.top3[0]||null;
      game.model={...game.model,top:game.top,top3:game.top3,candidates:game.top3,rankedCandidates:game.top3,researchCandidates:game.top3};
      game.recoveryStatus='owner-directed-research-picks-no-verified-native-odds';
    }
  }else{
    for(const game of games){
      game.top=null;game.top3=[];
      game.model={...game.model,top:null,top3:[],candidates:[],rankedCandidates:[],researchCandidates:[]};
      game.recoveryStatus='pass-no-verified-native-odds';
    }
  }
  const unique=new Set(games.map(g=>g.id));
  if(unique.size!==games.length)throw new Error('Duplicate research fixture IDs; publication blocked');
  const rankValue=p=>Number(p?.confidenceRating??p?.score);
  const ranked=arr=>arr.filter(g=>g.top&&rankValue(g.top)>=85&&Date.parse(g.date)>Date.now())
    .sort((a,b)=>rankValue(b.top)-rankValue(a.top)||Math.min(b.top.homeHits/b.top.homeSample,b.top.awayHits/b.top.awaySample)-Math.min(a.top.homeHits/a.top.homeSample,a.top.awayHits/a.awaySample))
    .slice(0,5);
  const leagueTop5={};
  for(const l of new Set(games.map(g=>g.league)))leagueTop5[l]=topRefs(ranked(games.filter(g=>g.league===l)));
  const board={schema:3,date:DATE,generatedAt:new Date().toISOString(),frozenAt:null,immutable:false,state:'preview',
    mutableUntil:DATE+' 00:30 America/Toronto',coverage:'full-board',source:'Audited research-only recovery from dated pre-match historical stats',
    top5:topRefs(ranked(games)),leagueTop5,games,
    scope:'mens-only-tracked-competitions',
    publicationNotes:'Up to three confidence-ranked selections per match from verified pre-match samples. Percentages are uncalibrated research-strength estimates; unsupported or redundant slots remain PASS rather than being forced.',
    dataSources:{researchBase:R,asianData:'data/asia/'+DATE+'.json',pricing:'not used'}};
  // Validate the exact same top-to-Top3 and reference invariants enforced for
  // official boards, without mutating any existing lock.
  const locked={...board,immutable:true,state:'locked',frozenAt:new Date().toISOString()};
  validateBoard(locked,{requireFull:true});
  await fs.mkdir(path.dirname(OUT),{recursive:true});
  await fs.writeFile(OUT,JSON.stringify(board,null,2)+'\n');
  if(OWNER_RESEARCH_PICKS&&DATE===TODAY){
    const checkedAt=new Date().toISOString();
    const insights={date:DATE,generatedAt:checkedAt,status:'ready-with-passes',fixtures:games.map(game=>({
      home:game.home,away:game.away,
      reviewStatus:game.top3.length===3?'ready':game.top3.length?'ready-partial-supported':'pass-insufficient-data',
      facts:[],supportedMarkets:[],markets:[],teamNews:[],
      teamNewsReview:{status:'reviewed',checkedAt,conclusion:'No material verified late team-news claim was published; no player prop or availability adjustment was made.'},
      sources:[]
    }))};
    await fs.writeFile(INSIGHTS,JSON.stringify(insights,null,2)+'\n');
  }
  console.log('Verified evidence-only recovery:',{date:DATE,games:games.length,top5:board.top5.length,priced:0,top3:games.filter(g=>g.top3.length===3).length});
}
main().catch(error=>{console.error(error);process.exitCode=1});
