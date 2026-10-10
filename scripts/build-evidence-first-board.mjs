/**
 * FootyEdge evidence-first candidate engine, v1.
 * Deterministic; never copies a third-party prediction or invents a sportsbook quote.
 * Until independently calibrated, score is an evidence-conviction index, not a win probability.
 */
import fs from "node:fs";
const date=process.env.FOOTYEDGE_DATE||"2026-10-10";
const file="data/boards/"+date+".json";
const board=JSON.parse(fs.readFileSync(file,"utf8"));
const rawOdds=JSON.parse(fs.readFileSync("data/"+date+"/odds.json","utf8"));
const oddsByFixture=new Map((rawOdds.response||[]).map(x=>[String(x.fixture?.id),x]));
function american(decimal){
  const d=Number(decimal);
  if(!Number.isFinite(d)||d<=1)return null;
  return d>=2?Math.round((d-1)*100):Math.round(-100/(d-1));
}
function fixtureQuotes(g){
  const x=oddsByFixture.get(String(g.id));
  const map=new Map();
  if(!x||!x.update||!Number.isFinite(Date.parse(x.update)))return map;
  const kickoff=Date.parse(x.fixture?.date);
  if(!Number.isFinite(kickoff)||Date.parse(x.update)>=kickoff)return map;
  for(const book of x.bookmakers||[]){
    if(!book.name)continue;
    for(const bet of book.bets||[]){
      for(const v of bet.values||[]){
        let label=null;
        if(bet.name==="Match Winner"){
          if(v.value==="Home")label=g.home+" ML";
          if(v.value==="Away")label=g.away+" ML";
          if(v.value==="Draw")label="Draw";
        }
        if(bet.name==="Goals Over/Under"&&/^(Over|Under) [1-4]\\.5$/.test(v.value))label=v.value+" Goals";
        const price=american(v.odd);
        if(label&&price!==null&&!map.has(label.toLowerCase())){
          map.set(label.toLowerCase(),{label,odds:price,displayOdds:(price>0?"+":"")+price,provider:book.name,bookExact:true,verifiedPrice:true,oddsTimestamp:x.update,priceDecimal:Number(v.odd)});
        }
      }
    }
  }
  return map;
}

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const poisson=(lambda,k)=>Math.exp(-lambda)*Math.pow(lambda,k)/[1,1,2,6,24,120,720,5040,40320,362880][k];
const n=s=>Number.isFinite(Number(s))?Number(s):null;
const pickStars=s=>s>=92?"★★★★★":s>=88?"★★★★½":s>=85?"★★★★":s>=78?"★★★½":"★★★";
const markets=(home,away)=>{
  let out={home:0,away:0,draw:0,bttsYes:0,over15:0,over25:0,over35:0,over45:0,homeOver05:0,awayOver05:0};
  for(let h=0;h<=9;h++)for(let a=0;a<=9;a++){
    const p=poisson(home,h)*poisson(away,a);
    out[h>a?"home":h<a?"away":"draw"]+=p;
    if(h>0&&a>0)out.bttsYes+=p;
    for(const k of [15,25,35,45])if(h+a>k/10)out["over"+k]+=p;
    if(h>0)out.homeOver05+=p;if(a>0)out.awayOver05+=p;
  }
  return out;
};
function h2hFacts(g,label){
  const m=(g.h2h||[]).filter(x=>x.homeScore!=null&&x.awayScore!=null&&Number.isFinite(+x.homeScore)&&Number.isFinite(+x.awayScore));
  if(!m.length)return "";
  const btts=m.filter(x=>+x.homeScore>0&&+x.awayScore>0).length;
  const line=Number(label.match(/(?:Over|Under) ([1-4]\\.5)/i)?.[1]||2.5);
  const above=m.filter(x=>+x.homeScore+(+x.awayScore)>line).length;
  if(/btts/i.test(label))return "Both teams scored in "+btts+" of the last "+m.length+" meetings.";
  if(/over|under/i.test(label))return "Across their last "+m.length+" meetings, "+( /under/i.test(label)?m.length-above:above)+" finished "+(/under/i.test(label)?"under ":"over ")+line+" goals.";
  const team=/fiorentina/i.test(label)?"Fiorentina":/ ml|double chance/i.test(label)?label.replace(/ ML| Double Chance.*$/i,""):"";
  if(!team)return "";
  let w=0,d=0,known=0;
  for(const x of m){
    const h=String(x.home||"").toLowerCase()===team.toLowerCase(),a=String(x.away||"").toLowerCase()===team.toLowerCase();
    if(!h&&!a)continue;
    known++;
    const gf=h?+x.homeScore:+x.awayScore,ga=h?+x.awayScore:+x.homeScore;
    if(gf>ga)w++;else if(gf===ga)d++;
  }
  return known?"In their last "+known+" meetings, "+team+" won "+w+" and drew "+d+".":"";
}
function explanation(g,label,prob){
  const h=g.model?.home,a=g.model?.away,parts=[];
  if(h?.n&&a?.n){
    parts.push(g.home+" have won "+h.wins+" of their last "+h.n+" and conceded "+Number(h.ga).toFixed(1)+" goals per match; "+g.away+" have won "+a.wins+" of their last "+a.n+" and conceded "+Number(a.ga).toFixed(1)+".");
  }
  const head=h2hFacts(g,label);if(head)parts.push(head);
  if(/double chance/i.test(label))parts.push("This selection also covers a draw, unlike the straight win.");
  if(/over|under/i.test(label)&&h&&a){const key=label.match(/([1-4]\\.5)/)?.[1]?.replace(".","");const stat=(/under/i.test(label)?"under":"over")+(key||"25");if(Number.isFinite(h[stat])&&Number.isFinite(a[stat]))parts.push(g.home+" met this line in "+Math.round(h[stat]*h.n)+" of "+h.n+" recent matches; "+g.away+" in "+Math.round(a[stat]*a.n)+" of "+a.n+".");}
  if(/btts/i.test(label)&&h&&a)parts.push("Both teams scored in "+Math.round(h.btts*h.n)+" of "+g.home+"'s last "+h.n+" and "+Math.round(a.btts*a.n)+" of "+g.away+"'s last "+a.n+".");
  if(prob<.6)parts.push("The available results do not provide a strong edge for this line.");
  return parts.join(" ");
}
function buildGame(g){
  const h=g.model?.home,a=g.model?.away;
  if(!h||!a||!h.n||!a.n)return g;
  const xh=clamp((Number(h.gf)+Number(a.ga))/2*1.08,.25,4);
  const xa=clamp((Number(a.gf)+Number(h.ga))/2*.94,.25,4);
  const p=markets(xh,xa);
  const odds=fixtureQuotes(g);
  const candidates=[
    [g.home+" ML","Match Result",p.home],[g.away+" ML","Match Result",p.away],["Draw","Match Result",p.draw],
    [g.home+" Double Chance (1X)","Double Chance",p.home+p.draw],
    [g.away+" Double Chance (X2)","Double Chance",p.away+p.draw],
    ["Double Chance (12)","Double Chance",p.home+p.away],
    ["BTTS Yes","BTTS",p.bttsYes],["BTTS No","BTTS",1-p.bttsYes],
    ...[15,25,35,45].flatMap(k=>[["Over "+(k/10).toFixed(1)+" Goals","Goals",p["over"+k]],["Under "+(k/10).toFixed(1)+" Goals","Goals",1-p["over"+k]]])
  ];
  const sample=Math.min(h.n,a.n);
  const rows=candidates.map(([label,category,prob])=>{
    const quoted=odds.get(label.toLowerCase());
    // No blanket small-sample multiplier. Sample size remains explicit metadata.
    const score=Math.round(clamp(prob*100,20,94));
    const verified=Boolean(quoted&&Number(quoted.odds)>=-500);
    return {label,category,score,stars:pickStars(score),odds:verified?quoted.odds:null,displayOdds:verified?quoted.displayOdds:"Not verified",verifiedPrice:verified,bookExact:verified,provider:verified?quoted.provider:null,oddsTimestamp:verified?quoted.oddsTimestamp:null,priceDecimal:verified?quoted.priceDecimal:null,priceStatus:verified?"verified":"unavailable",researchOnly:!verified,modelScore:score,modelProbability:+prob.toFixed(4),confidenceType:"uncalibrated_model_probability_estimate",sampleSize:sample,reason:explanation(g,label,prob),modelVersion:"evidence-first-v1"};
  }).sort((x,y)=>y.score-x.score);
  // No verified player-level event, minutes or market prices: player props are withheld rather than invented.
  const qualified=rows.filter(x=>x.verifiedPrice);
  const top3=rows.slice(0,3);
  g.top3=top3;g.top=top3[0]||null;
  g.model={...g.model,top:g.top,top3,rankedCandidates:rows,candidates:rows,expectedGoals:{home:xh,away:xa,total:xh+xa}};
  g.modelReview={version:"evidence-first-v1",playerMarkets:"withheld: unverified player and odds coverage",thirdPartyCrossChecks:"not yet incorporated",sampleSize:sample};
  return g;
}
board.games=board.games.map(buildGame);
const best=board.games.flatMap(g=>(g.model?.rankedCandidates||[]).filter(p=>p.score>=85&&p.verifiedPrice&&p.bookExact&&Number(p.odds)>=-500).slice(0,1).map(p=>({g,p}))).sort((a,b)=>b.p.score-a.p.score);
board.top5=best.slice(0,5).map(({g,p},i)=>({rank:i+1,gameId:g.id,home:g.home,away:g.away,pick:p}));
board.leagueTop5=Object.fromEntries([...new Set(board.games.map(g=>g.league).filter(Boolean))].map(league=>[league,board.games.filter(g=>g.league===league&&g.top).sort((a,b)=>(b.top?.score||0)-(a.top?.score||0)).slice(0,5).map((g,i)=>({rank:i+1,gameId:g.id,home:g.home,away:g.away,pick:g.top}))]));
board.modelEngine="evidence-first-v1";
board.modelLimitations="Uncalibrated probability estimates without blanket sample penalty; last-five form summaries; independent expert/Whispers verification and player market coverage incomplete. No invented quotes.";
board.generatedAt=new Date().toISOString();
const out="data/model-previews/"+date+"-evidence-first.json";
fs.mkdirSync("data/model-previews",{recursive:true});
fs.writeFileSync(out,JSON.stringify(board,null,2)+"\n");
console.log(JSON.stringify({preview:out,games:board.games.length,top5:board.top5.map(x=>({match:x.home+" vs "+x.away,pick:x.pick.label,score:x.pick.score})),playerProps:"withheld",published:false},null,2));
