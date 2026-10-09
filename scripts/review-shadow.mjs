#!/usr/bin/env node
/**
 * Compare archived pre-kickoff model snapshots with completed ESPN scores and
 * ORIGINAL immutable FootyEdge selections. Never revises the original board.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

function norm(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}
function outcome(h, a) {
  return { home_win: h>a, draw: h===a, away_win: a>h,
    home_or_draw: h>=a, away_or_draw: a>=h,
    over_1_5: h+a>=2, under_2_5: h+a<3, over_2_5: h+a>=3,
    under_3_5: h+a<=3, btts_yes: h>0 && a>0, btts_no: h===0 || a===0 };
}
const top1x2 = p => ["home_win","draw","away_win"].reduce((x,y)=>Number(p[y])>Number(p[x])?y:x,"home_win");
export function scoreForecast(fixture, homeScore, awayScore) {
  const p=fixture?.probabilities;
  const actual=outcome(homeScore,awayScore);
  if (!p || ["home_win","draw","away_win"].some(k=>!Number.isFinite(p[k]))) return null;
  const which=homeScore>awayScore?"home_win":awayScore>homeScore?"away_win":"draw";
  const eps=1e-8;
  const markets={};
  for(const [market,hit] of Object.entries(actual)){
    const v=p[market];
    if(Number.isFinite(v) && v>=0 && v<=1)
      markets[market]={predictedProbability:v,actual:hit,hitPrediction:v>=0.5===hit,
        brier:Math.round((v-Number(hit))**2*1e6)/1e6};
  }
  return {
    modelPicked1x2:top1x2(p),
    actual1x2:which,
    mostLikelyResultCorrect:top1x2(p)===which,
    actualScore:[homeScore,awayScore],
    actualOutcome:actual,
    multiclassBrier:Math.round(["home_win","draw","away_win"]
      .reduce((sum,k)=>sum+(p[k]-Number(actual[k]))**2,0)*1e6)/1e6,
    multiclassLogLoss:Math.round((-Math.log(Math.max(eps,p[which])))*1e6)/1e6,
    markets,
  };
}
export function gradeOriginal(pick, fixture, h, a) {
  const text=String(pick?.label||"");
  const lower=text.toLowerCase();
  const head=norm(fixture.home),away=norm(fixture.away);
  if(/\sml$/i.test(text)){
    const n=norm(text.replace(/\sml$/i,""));
    if(n===head)return h>a?"hit":"miss";
    if(n===away)return a>h?"hit":"miss";
  }
  const total=text.match(/(under|over)\s+(\d+(?:\.\d+)?)\s+goals/i);
  if(total) {
    const line=Number(total[2]),goals=h+a;
    if(goals===line)return "push";
    return total[1].toLowerCase()==="under"?(goals<line?"hit":"miss"):(goals>line?"hit":"miss");
  }
  const dc=text.match(/(.+?)\s+or\s+draw/i);
  if(dc){
    const n=norm(dc[1]);
    if(n===head)return h>=a?"hit":"miss";
    if(n===away)return a>=h?"hit":"miss";
  }
  if(/btts/i.test(text))return (h>0&&a>0)===/yes/i.test(text)?"hit":"miss";
  const spread=text.match(/(.+?)\s+([+-]\d+(?:\.\d+)?)$/);
  if(spread){
    const n=norm(spread[1]),line=Number(spread[2]);
    const margin=n===head?h-a:n===away?a-h:null;
    if(margin!=null)return margin+line===0?"push":margin+line>0?"hit":"miss";
  }
  return "not_scored_unknown_market";
}
export function buildReview({date, snapshots, board, scoreboard}) {
  const source=new Map((scoreboard?.events||[]).map(e=>[String(e.id),e]));
  const originals=new Map((board?.games||[]).map(g=>[String(g.id),g]));
  const datasets=Object.entries(snapshots||{}).filter(([,s])=>s?.date===date &&
    s?.mode==="shadow_only" && s?.promotedToPicks===false);
  const review={date,mode:"research_only_not_published_picks",
    modelPolicy:"Retrospective comparison of archived original pre-match forecasts; no hindsight fitting or automatic coefficient changes",
    reviewedModels:datasets.map(([name,p])=>({name,modelVersion:p.modelVersion,asOf:p.asOf,
      researchInputSha256:p.researchInputSha256||null,coverage:p.coverage})),
    fixtures:[],originalsWithoutSupportedModel:[],metrics:{},fullySettled:false,
  };
  let allDone=true;
  for(const [name,data] of datasets){
    const records=[],pending=[];
    for(const f of data.fixtures||[]){
      if(f.status!=="shadow_prediction")continue;
      const event=source.get(String(f.fixtureId));
      const competitors=event?.competitions?.[0]?.competitors||[];
      const home=competitors.find(c=>c.homeAway==="home"),away=competitors.find(c=>c.homeAway==="away");
      const complete=event?.status?.type?.completed===true && Number.isFinite(Number(home?.score)) &&
        Number.isFinite(Number(away?.score));
      if(!complete){pending.push(String(f.fixtureId));allDone=false;continue;}
      const kick=Date.parse(f.kickoff),asof=Date.parse(data.asOf);
      if(!Number.isFinite(kick)||!Number.isFinite(asof)||asof>=kick){pending.push(String(f.fixtureId));allDone=false;continue;}
      const h=Number(home.score),a=Number(away.score),score=scoreForecast(f,h,a);
      if(!score){pending.push(String(f.fixtureId));allDone=false;continue;}
      const original=originals.get(String(f.fixtureId));
      const existing=(original?.top3||[]).map(p=>({
        originalLabel:p.label,originalConfidence:p.score??null,originalOdds:p.odds??null,
        originalOutcome:gradeOriginal(p,f,h,a),originalMarketModelProbability:p.modelProb??null,
      }));
      const row={model:name,modelVersion:data.modelVersion,fixtureId:f.fixtureId,
        league:f.league,home:f.home,away:f.away,...score,
        originalFootyEdgeSelections:existing,processQuality:"unreviewed",
        processNote:"Correct/incorrect result alone is not evidence of a good/bad read; lineup/VAR/red-card context requires separate verified sources",
      };
      records.push(row);review.fixtures.push(row);
    }
    review.metrics[name]={graded:records.length,pending:pending.length,pendingFixtureIds:pending,
      mostLikely1x2HitRate:records.length?Number((records.filter(x=>x.mostLikelyResultCorrect).length/records.length).toFixed(4)):null,
      multiclassBrier:records.length?Number((records.reduce((s,x)=>s+x.multiclassBrier,0)/records.length).toFixed(6)):null,
      multiclassLogLoss:records.length?Number((records.reduce((s,x)=>s+x.multiclassLogLoss,0)/records.length).toFixed(6)):null,
    };
  }
  const modeled=new Set(review.fixtures.map(f=>String(f.fixtureId)));
  for(const g of board?.games||[]){
    if((g.top3||[]).length && !modeled.has(String(g.id)))
      review.originalsWithoutSupportedModel.push({fixtureId:String(g.id),home:g.home,away:g.away,
        reason:"No comparable originally archived Dixon-Coles pre-match prediction; no result can be attributed to it"});
  }
  review.fullySettled=allDone&&datasets.length>0;
  return review;
}
const startDay=d=>new Date(d+"T12:00:00Z");
const dateBefore=(d,n=1)=>new Date(startDay(d).getTime()-n*86400000).toISOString().slice(0,10);
async function readJSON(file) {try{return JSON.parse(await fs.readFile(file,"utf8"))}catch(e){if(e.code==="ENOENT")return null;throw e}}
async function main(){
  const args=process.argv.slice(2),flag=args.indexOf("--date");
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",
    year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date())
    .map(x=>[x.type,x.value]));
  const today=parts.year+"-"+parts.month+"-"+parts.day;
  const date=flag<0?dateBefore(today):args[flag+1];
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Bad review date");
  if(date>=today)throw Error("Review only past Toronto days after final scores");
  const base="data",output=path.join(base,"model-reviews",date+".json");
  if(await readJSON(output)){console.log("Immutable model review exists, preserving",output);return;}
  const [original,candidate,board,scoreboard]=await Promise.all([
    readJSON(path.join(base,"model-shadow",date+".json")),
    readJSON(path.join(base,"model-candidates",date+".json")),
    readJSON(path.join(base,"boards",date+".json")),
    readJSON(path.join(base,date,"scoreboard.json"))
  ]);
  const snapshots={};if(original)snapshots.original=original;if(candidate)snapshots.candidate=candidate;
  if(!board||!scoreboard||!Object.keys(snapshots).length){
    console.log("Awaiting original board, model archive or full-time score source",date);return;
  }
  // A cached dated scoreboard may have been captured before full-time.
  // Recheck the SAME event IDs using the existing scoreboard service, if available.
  let finalScores=scoreboard;
  const targetIds=new Set(Object.values(snapshots).flatMap(x=>
    (x.fixtures||[]).filter(f=>f.status==="shadow_prediction").map(f=>String(f.fixtureId))));
  const completed=new Set((scoreboard.events||[]).filter(x=>x.status?.type?.completed)
    .map(x=>String(x.id)));
  if([...targetIds].some(id=>!completed.has(id))){
    try {
      const host=(process.env.FOOTYEDGE_URL||"https://footyedge-board.vercel.app").replace(/\/$/,"");
      const response=await fetch(host+"/api/espn-scoreboard?dates="+date.replaceAll("-","")+"&limit=1000",{signal:AbortSignal.timeout(20000)});
      if(response.ok){
        const fresh=await response.json();
        const map=new Map((scoreboard.events||[]).map(e=>[String(e.id),e]));
        for(const e of fresh.events||[])map.set(String(e.id),e);
        finalScores={events:[...map.values()]};
        console.log("Rechecked previously missing full-time scores via FootyEdge scoreboard");
      }
    }catch(e){console.warn("Live scoreboard verification unavailable",String(e).slice(0,140))}
  }
  const result=buildReview({date,snapshots,board,scoreboard:finalScores});
  console.log("Model review",date,"settled=",result.fullySettled,"metrics=",JSON.stringify(result.metrics));
  if(!result.fullySettled){
    console.log("Review remains pending; preserve future retrials without writing partial results");return;
  }
  await fs.mkdir(path.dirname(output),{recursive:true});
  await fs.writeFile(output,JSON.stringify({...result,reviewedAt:new Date().toISOString()},null,2)+"\n",{flag:"wx"});
  console.log("Archived",output);
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(e=>{console.error(e);process.exitCode=1;});
