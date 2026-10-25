#!/usr/bin/env node
/**
 * Dated multi-site Top 3 display overlay (not historical settlement).
 * Inputs: fixture-matched explicitly recommended markets + independent winner
 * opinions + already verified recent match history. Never invent an editorial
 * opinion or reinterpret a preview statistic as a published tip.
 * Safe even after the original daily archive has frozen.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
const allowed={
 football_whispers:"footballwhispers.com",
 forebet:"forebet.com",
 the_analyst:"theanalyst.com",
 windrawwin:"windrawwin.com",
 sports_mole:"sportsmole.co.uk"
};
const norm=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const read=async f=>fs.readFile(f,"utf8").then(JSON.parse).catch(e=>{if(e.code==="ENOENT")return null;throw e;});
const hostOk=(url,source)=>{try{const u=new URL(url),host=u.hostname.toLowerCase(),domain=allowed[source];return u.protocol==="https:"&&!!domain&&(host===domain||host.endsWith("."+domain))}catch{return false}};
const definitions={
 home_win:["result","Match Result"],away_win:["result","Match Result"],draw:["result","Match Result"],
 home_or_draw:["result","Double Chance"],away_or_draw:["result","Double Chance"],
 over_1_5:["total","Goals"],over_2_5:["total","Goals"],over_3_5:["total","Goals"],over_4_5:["total","Goals"],
 under_2_5:["total","Goals"],under_3_5:["total","Goals"],
 btts_yes:["btts","BTTS"],btts_no:["btts","BTTS"],
 ht_draw:["halftime","Half-Time Result"],ht_away_loses:["halftime","Half-Time Result"],
 ht_away_or_draw:["halftime","Half-Time Double Chance"],
 home_first_half_goal:["firsthalf","First-Half Goals"],
 home_first_goal:["firstgoal","First Team to Score"],away_first_goal:["firstgoal","First Team to Score"],
 brighton_first_goal:["firstgoal","First Team to Score"],
 liverpool_over_2_5:["teamtotal","Team Goals"],
 over_4_5_cards:["cards","Cards"],
 over_10_5_corners:["corners","Corners"],
 under_8_5_corners:["corners","Corners"],
 under_10_5_corners:["corners","Corners"],
 under_10_corners:["corners","Corners"],
 away_win_btts_yes:["combo","Match Builder"]
};
const skipped=key=>key.startsWith("player_")||key.startsWith("exact_score_");
const label=(key,f)=>{
 const h=f.home.name,a=f.away.name;
 if(key==="home_win")return h+" ML";
 if(key==="away_win")return a+" ML";
 if(key==="draw")return "Draw";
 if(key==="home_or_draw")return h+" or Draw";
 if(key==="away_or_draw")return a+" or Draw";
 if(key==="btts_yes")return "BTTS Yes";
 if(key==="btts_no")return "BTTS No";
 if(key==="ht_draw")return "Half-Time Draw";
 if(key==="ht_away_loses")return a+" to Trail at Half-Time";
 if(key==="ht_away_or_draw")return a+" or Draw at Half-Time";
 if(key==="home_first_half_goal")return h+" 1+ First-Half Goal";
 if(key==="home_first_goal")return h+" to Score First";
 if(key==="away_first_goal")return a+" to Score First";
 if(key==="brighton_first_goal")return a+" to Score First";
 if(key==="liverpool_over_2_5")return h+" Over 2.5 Team Goals";
 if(key==="away_win_btts_yes")return a+" Win & BTTS Yes";
 let z=key.match(/^(over|under)_(\d+)_(\d+)$/);
 if(z)return z[1].replace(/^./,s=>s.toUpperCase())+" "+z[2]+"."+z[3]+
   (["cards","corners"].some(x=>key.endsWith("_"+x))?"":" Goals");
 z=key.match(/^(over|under)_(\d+)_(\d+)_(cards|corners)$/);
 if(z)return z[1].replace(/^./,s=>s.toUpperCase())+" "+z[2]+"."+z[3]+" "+z[4][0].toUpperCase()+z[4].slice(1);
 if(key==="under_10_corners")return "Under 10 Corners";
 return null;
};
function trend(key,f){
 const cutoff=Date.parse(f.date),h=(f.last10?.home||[]).filter(x=>Number.isFinite(x.gf)&&Number.isFinite(x.ga)&&Date.parse(x.date)<cutoff).slice(0,10);
 const a=(f.last10?.away||[]).filter(x=>Number.isFinite(x.gf)&&Number.isFinite(x.ga)&&Date.parse(x.date)<cutoff).slice(0,10);
 if(h.length<5||a.length<5)return null;
 let tests=null;
 if(key==="home_win")tests=[x=>x.gf>x.ga,x=>x.gf<x.ga];
 else if(key==="away_win")tests=[x=>x.gf<x.ga,x=>x.gf>x.ga];
 else if(key==="draw")tests=[x=>x.gf===x.ga,x=>x.gf===x.ga];
 else if(key==="btts_yes")tests=[x=>x.gf>0&&x.ga>0,x=>x.gf>0&&x.ga>0];
 else if(key==="btts_no")tests=[x=>x.gf===0||x.ga===0,x=>x.gf===0||x.ga===0];
 else if(key==="home_or_draw")tests=[x=>x.gf>=x.ga,x=>x.gf<=x.ga];
 else if(key==="away_or_draw")tests=[x=>x.gf<=x.ga,x=>x.gf>=x.ga];
 else if(key==="liverpool_over_2_5")tests=[x=>x.gf>=3,x=>x.ga>=3];
 else {
  const t=key.match(/^(under|over)_(\d+)_(\d+)$/);
  if(t){const v=Number(t[2]+"."+t[3]);if(t[1]==="over")tests=[x=>x.gf+x.ga>v,x=>x.gf+x.ga>v];else tests=[x=>x.gf+x.ga<v,x=>x.gf+x.ga<v];}
 }
 if(!tests)return null;
 const hc=h.filter(tests[0]).length,ac=a.filter(tests[1]).length;
 return {homeHits:hc,awayHits:ac,homeGames:h.length,awayGames:a.length,combined:(hc/h.length+ac/a.length)/2};
}
function compatible(a,b){
 if(a.family===b.family)return false;
 const x=a.key,y=b.key;
 if((x==="over_1_5"&&y==="btts_yes")||(y==="over_1_5"&&x==="btts_yes"))return false;
 if((a.family==="combo"&&["result","btts"].includes(b.family))||(b.family==="combo"&&["result","btts"].includes(a.family)))return false;
 if((a.family==="firstgoal"&&b.family==="firsthalf")||(b.family==="firstgoal"&&a.family==="firsthalf"))return false;
 if((x==="away_win"&&y==="away_win_btts_yes")||(x==="away_win_btts_yes"&&y==="away_win"))return false;
 return true;
}
function generate({date,research,curated,opinions}){
 if(research?.date!==date||curated?.date!==date||opinions?.date!==date)throw Error("Exact-date matched research and source captures required");
 const fixtures=research.fixtures||[],byId=new Map(fixtures.map(f=>[String(f.id),f]));
 const votes=new Map(),rejected=[];
 function add(id,key,source,url,mode){
  const f=byId.get(String(id)),spec=definitions[key];
  if(!f||!spec||!hostOk(url,source)){rejected.push({id,key,source,reason:"unknown fixture, market, or source"});return}
  const k=String(id)+"|"+key;
  const v=votes.get(k)||{key,fixtureId:String(id),support:new Map(),mode:new Set()};
  if(v.support.has(source))return;
  v.support.set(source,url);v.mode.add(mode);votes.set(k,v);
 }
 for(const item of curated.fixtures||[]){
  const f=byId.get(String(item.fixtureId));
  if(!f||norm(item.home)!==norm(f.home.name)||norm(item.away)!==norm(f.away.name)||
    item.publicationDate!==date||!hostOk(item.url,item.source)){rejected.push({id:item.fixtureId,reason:"unverified match or date"});continue}
  for(const p of item.marketPicks||[]){
   if(!p.explicitPreMatchTip)continue;
   if(skipped(p.market)){rejected.push({id:item.fixtureId,key:p.market,reason:"unverified player/event precision or exact score"});continue}
   add(item.fixtureId,p.market,item.source,item.url,"direct_markets");
  }
 }
 const translated={home:"home_win",away:"away_win",draw:"draw",yes:"btts_yes",no:"btts_no",home_or_draw:"home_or_draw",away_or_draw:"away_or_draw"};
 for(const o of opinions.opinions||[]){
  if(o.fixtureDate!==date||o.kind!=="explicit_pre_match_prediction"||!["match_winner","btts","double_chance"].includes(o.market))continue;
  const key=translated[o.prediction];
  if(!key||!((o.market==="match_winner"&&["home_win","away_win","draw"].includes(key))||
    (o.market==="btts"&&["btts_yes","btts_no"].includes(key))||
    (o.market==="double_chance"&&["home_or_draw","away_or_draw"].includes(key))))continue;
  add(o.fixtureId,key,o.source,o.url,"winner_or_btts");
 }
 const output=[];
 for(const f of fixtures){
  const candidates=[...votes.values()].filter(v=>v.fixtureId===String(f.id));
  const direction=candidates.filter(x=>["home_win","away_win","draw","home_or_draw","away_or_draw"].includes(x.key));
  const directResult=direction.filter(x=>["home_win","away_win","draw"].includes(x.key));
  const resultOpposition=(key)=>directResult.filter(x=>x.key!==key).reduce((n,x)=>n+x.support.size,0);
  const picks=candidates.map(v=>{
   const spec=definitions[v.key],name=label(v.key,f);
   if(!name)return null;
   const nums=trend(v.key,f),count=v.support.size,opposed=spec[0]==="result"?resultOpposition(v.key):0;
   const event=["corners","cards","firstgoal","firsthalf","halftime","combo","teamtotal"].includes(spec[0]);
   const grade=Math.max(50,Math.min(80,Math.round(55+8*(count-1)+(nums?Math.max(-5,Math.min(9,(nums.combined-.5)*21)):0)-(event?3:0)-Math.min(14,opposed*5))));
   const basis=count>=2?count+" independently recorded pre-match predictions support this market.":"A dated match-specific preview explicitly recommends this market.";
   const numbers=nums?" Recent verified results match the selection in "+nums.homeHits+"/"+nums.homeGames+" "+f.home.name+" games and "+nums.awayHits+"/"+nums.awayGames+" "+f.away.name+" games.":"";
   const disagreement=opposed?" "+opposed+" independent opposing outcome forecast"+(opposed===1?" was":"s were")+" also recorded; there is no unanimous result consensus.":"";
   const caveat=event?" The selection is editorially sourced; matching event-level hit rates or confirmed player roles were not available for independent verification.":"";
   return {key:v.key,label:name,category:spec[1],family:spec[0],confidenceRating:grade,
    researchStrength:grade,sourceBackedReason:true,probabilityCalibrated:false,
    confidenceType:"editorial_research_grade_not_outcome_probability",
    score:null,odds:null,ev:null,verifiedPrice:false,researchOnly:true,
    editorialSupport:count,editorialOpposition:opposed,
    marketEvidence:{explicitEditorialTip:true,verifiedPublisherCount:count,verified:event===false&&!!nums,sourceCheckedAt:date},
    sourceProvenance:[...v.support].map(([source,url])=>({source,url,fixtureDate:date})),
    reason:basis+numbers+disagreement+caveat
   };
  }).filter(Boolean).sort((a,b)=>b.editorialSupport-a.editorialSupport||b.confidenceRating-a.confidenceRating);
  // A competing winner forecast is an important signal, not a second independent leg.
  // Pick one strongest outcome thesis, then genuinely different supported markets.
  let best=[];
  const choose=(selected,start)=>{
   const score=xs=>xs.reduce((n,x)=>n+x.editorialSupport*10+x.confidenceRating+(x.editorialOpposition? -8:0),0);
   if(selected.length>best.length||(selected.length===best.length&&score(selected)>score(best)))best=[...selected];
   if(selected.length===3)return;
   for(let i=start;i<picks.length;i++)if(selected.every(x=>compatible(x,picks[i])))choose([...selected,picks[i]],i+1);
  };
  choose([],0);
  best.sort((a,b)=>b.editorialSupport-a.editorialSupport||b.confidenceRating-a.confidenceRating);
  for(let i=0;i<best.length;i++)best[i].rank=i+1;
  output.push({gameId:String(f.id),league:f.league,home:f.home.name,away:f.away.name,
   kickoff:f.date,reviewed:best.length>0,reviewStatus:best.length===3?"three_distinct_sourced_market_tips":best.length?"partial_sourced_market_tips":"pass_no_independent_market_tip",
   editorialSourceCount:new Set(best.flatMap(x=>x.sourceProvenance.map(y=>y.source))).size,
   qualifyingInputs:{sourcedMarketPicks:best.length,standingsAndLineupsNotImputed:true},
   picks:best
  });
 }
 const ranked=output.flatMap(m=>m.picks.map(p=>({gameId:m.gameId,home:m.home,away:m.away,league:m.league,kickoff:m.kickoff,pick:p})))
  .sort((a,b)=>b.pick.editorialSupport-a.pick.editorialSupport||
    a.pick.editorialOpposition-b.pick.editorialOpposition||b.pick.confidenceRating-a.pick.confidenceRating);
 const top5=[],seen=new Set();
 for(const x of ranked)if(!seen.has(x.gameId)){seen.add(x.gameId);top5.push({...x,rank:top5.length+1});if(top5.length===5)break}
 return {schema:"footyedge-dated-researched-top3-v1",mode:"independent_publisher_market_tips",
  date,generatedAt:new Date().toISOString(),archiveUnmodified:true,sourceNamesOnUi:false,sourceLedDisplayOnly:true,
  researchGradeNotProbability:true,method:"Verified match-specific publisher tips first; exact market votes and dissent retained, distinct market screening; verified last-ten form used as a cross-check, not as a source prediction.",
  calibration:"Confidence figures are research-quality grades, NOT calibrated probabilities and must not be treated as actual win rates.",
  totals:{fixtures:output.length,three:output.filter(x=>x.picks.length===3).length,two:output.filter(x=>x.picks.length===2).length,one:output.filter(x=>x.picks.length===1).length,zero:output.filter(x=>x.picks.length===0).length,
    sourceMarketTips:(curated.fixtures||[]).reduce((n,x)=>n+(x.marketPicks||[]).length,0),
    sourceOpinionRecords:(opinions.opinions||[]).length,
    rejectedUnverifiedMarkets:rejected.length},
  top5,matches:output,rejectedInternal:rejected};
}
export {generate};
async function main(){
 const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 const date=process.env.REVIEW_DATE||p.year+"-"+p.month+"-"+p.day;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Invalid date");
 const [research,curated,opinions]=await Promise.all([
  read(path.join("data","research-base-"+date+".json")),
  read(path.join("data","source-market-picks",date+".json")),
  read(path.join("data","source-opinions",date+".json"))]);
 if(!research||!curated||!opinions){console.log("Source-led review has no complete independent research inputs; PASS.");return}
 const doc=generate({date,research,curated,opinions});
 const target=path.join("data","source-led",date+".json");
 await fs.mkdir(path.dirname(target),{recursive:true});
 await fs.writeFile(target,JSON.stringify(doc,null,2)+"\n");
 console.log("Sourced Top 3 review:",JSON.stringify(doc.totals),"Top 5:",doc.top5.map(x=>x.pick.label));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
 main().catch(e=>{console.error(e);process.exitCode=1});
