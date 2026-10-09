#!/usr/bin/env node
/**
 * Owner-authorized October 9 TOP THREE refresh.
 * Reuse existing signed, dated model + saved exact DraftKings markets,
 * paraphrased cited external context, do NOT invent a quote or a model.
 * Revisions are append-only and never change original global Top5.
 */
import fs from "node:fs/promises";
import crypto from "node:crypto";
const DATE="2026-10-09";
const BOARD="data/boards/"+DATE+".json",REV="data/board-revisions/"+DATE;
const BACKUP=REV+"/before-owner-plain-english-top3.json";
const sha=s=>crypto.createHash("sha256").update(s).digest("hex");
const fmt=x=>JSON.stringify(x,null,2)+"\n";
const read=async p=>JSON.parse(await fs.readFile(p,"utf8"));
const cfg={
"401884781":{
  why:"Dortmund have won their first four league games, while Bremen have not won any of their last five away league matches. Dortmund also have the stronger attack at home.",
  h2h:"H2H: Dortmund are unbeaten in their last 7 meetings with Bremen (5 wins, 2 draws); Bremen failed to score in 5 of those 7.",
  src:"https://footballwhispers.com/blog/borussia-dortmund-vs-werder-bremen-prediction-preview-09-10-2026/",
  picks:[
   ["home_win","Borussia Dortmund ML","Match Result","Dortmund's perfect league start and Bremen's poor away record make the home win the clearest result option."],
   ["over_1_5","Over 1.5 Goals","Goals","Dortmund have scored at least three in four of their last six home games, giving this goals line more room than Over 2.5."],
   ["under_3_5","Under 3.5 Goals","Goals","The model expects Dortmund to control the game without a major Bremen contribution; a 2-0 or 3-0 result fits. Dortmund's recent big home totals make this less certain."]
  ]},
"401875592":{
  why:"PSV have won four straight meetings against Heerenveen and five of their last six home league games. Heerenveen have had a mixed run of results.",
  h2h:"H2H: PSV won each of the last 4 meetings with Heerenveen.",
  src:"https://footballwhispers.com/blog/psv-eindhoven-vs-heerenveen-prediction-09-10-2026/",
  picks:[
   ["home_win","PSV Eindhoven ML","Match Result","PSV's home form and four straight H2H wins favour the hosts, although the short moneyline price offers limited value."],
   ["over_2_5","Over 2.5 Goals","Goals","PSV scored 20 goals across their last five league matches, and Heerenveen have conceded regularly."],
   ["btts_yes","BTTS — Yes","BTTS","PSV are still without a clean sheet this league season, so Heerenveen scoring is a realistic risk even in a PSV win."]
  ]},
"401882851":{
  why:"Málaga have gone nine matches without a win, while Espanyol have repeatedly found a way past them. The double chance is safer than requiring an away win.",
  h2h:"H2H: Espanyol are unbeaten in the last 15 against Málaga, winning the most recent 6. The last 4 H2Hs went Over 2.5 goals.",
  risk:"Football Whispers expects goals here, but our goals model leans Under 2.5. Treat that under as a disagreement, not a sure thing.",
  src:"https://footballwhispers.com/blog/malaga-vs-espanyol-prediction-09-10-2026/",
  picks:[
   ["away_or_draw","Espanyol or Draw","Double Chance","Málaga are winless in nine and Espanyol have dominated this matchup. The draw is covered."],
   ["away_win","Espanyol ML","Match Result","Espanyol have won six straight meetings. This is a higher-risk way to follow the matchup advantage."],
   ["under_2_5","Under 2.5 Goals","Goals","Our goals forecast points to a tighter game, but four straight high-scoring H2Hs and Football Whispers' Over 2.5 pick are clear reasons for caution."]
  ]},
"401876447":{
  why:"Lyon have been hard to break down, while Lens can still threaten at home. This looks competitive rather than an obvious one-sided game.",
  h2h:"H2H: Lens have won 4 of the last 6 Ligue 1 meetings with Lyon.",
  risk:"Football Whispers prefers BTTS and an away win; the model is more favourable to Lens. Result markets carry added uncertainty.",
  src:"https://footballwhispers.com/blog/lens-vs-lyon-prediction-09-10-2026/",
  picks:[
   ["under_3_5","Under 3.5 Goals","Goals","Lyon's strong defensive start makes five or more goals unlikely, and even a close 2-1 finish stays under this line."],
   ["btts_yes","BTTS — Yes","BTTS","Lens have scored nine in five league games; Football Whispers also expects both teams to score, despite Lyon's defensive strength."],
   ["home_win","Lens ML","Match Result","Lens have won four of the last six league H2Hs, but Lyon's unbeaten start makes this the riskier of the three."]
  ]},
"401885423":{
  why:"Gil Vicente have generally had the better of recent meetings, while Moreirense have struggled to keep clean sheets. The draw cover looks safer than choosing an outright winner.",
  h2h:"H2H: Gil Vicente won 3 of the last 4 against Moreirense, including both league meetings last season.",
  risk:"Recent Moreirense home games have been lively; other previews lean Over 2.5. The model's Under 3.5 is not a guaranteed low-scoring game.",
  src:"https://www.sportytrader.com/en/betting-tips/moreirense-gil-vicente-377432/",
  picks:[
   ["away_or_draw","Gil Vicente or Draw","Double Chance","Gil Vicente have won three of the last four meetings and a draw still gets this pick home."],
   ["under_3_5","Under 3.5 Goals","Goals","Gil Vicente's league matches have generally been low-scoring, and this line allows a 2-1 finish."],
   ["away_win","Gil Vicente ML","Match Result","Gil Vicente's recent H2H success is encouraging, but their current away-win probability is much less convincing."]
  ]},
"401885427":{
  why:"Sporting have the better long-term matchup record but Braga are tough at home. A narrow game with both sides scoring is plausible.",
  h2h:"H2H: Sporting are unbeaten in their last 8 league meetings with Braga. The last 3 finished level, and both teams scored in the last 4.",
  src:"https://footballwhispers.com/blog/braga-vs-sporting-lisbon-prediction-preview-betting-tips-09-10-26/",
  picks:[
   ["away_or_draw","Sporting CP or Draw","Double Chance","Sporting's eight-game unbeaten H2H run stands out, and three straight draws make the draw cover useful."],
   ["btts_yes","BTTS — Yes","BTTS","Both sides scored in the last four meetings, and both have enough attacking options to do so again."],
   ["over_2_5","Over 2.5 Goals","Goals","Both teams have scoring threat, but three consecutive H2H draws make this a more speculative goal line than BTTS."]
  ]},
"401880233":{
  why:"West Ham have won their last three home league games; QPR are winless in four. West Ham's strong attacking form gives them the edge.",
  h2h:"H2H: West Ham beat QPR 2-1 in their January FA Cup meeting.",
  src:"https://footballwhispers.com/blog/west-ham-united-vs-queens-park-rangers-prediction-preview-betting-tips-09-10-2026/",
  picks:[
   ["home_win","West Ham United ML","Match Result","West Ham have three straight home league wins, while QPR are winless in four. The hosts have the clearer route to three points."],
   ["over_1_5","Over 1.5 Goals","Goals","West Ham scored 18 goals in their last five league matches; only two match goals are needed for this line."],
   ["btts_yes","BTTS — Yes","BTTS","Both teams scored in three of West Ham's last four matches, and QPR still have enough attacking quality to threaten."]
  ]},
"401888280":{
  why:"Galatasaray have won four of their six league games and are strong favourites at home, although Kasımpaşa remain unbeaten in the league.",
  h2h:"H2H: Galatasaray won 3-0 at home in December 2025, but Kasımpaşa won 1-0 in May 2026.",
  risk:"Kasımpaşa's unbeaten start is a genuine warning. These are form-and-market leans, not a Turkish model forecast.",
  src:"https://www.mightytips.com/football-predictions/galatasaray-vs-kasimpasa-prediction-09-10-2026/",
  secondary:"https://www.sportytrader.com/en/betting-tips/galatasaray-kasimpasa-377498/",
  picks:[
   ["home_win","Galatasaray ML","Match Result","Galatasaray's 13 points from six matches and home advantage make them favourites. Kasımpaşa's unbeaten start is the main concern."],
   ["under_3_5","Under 3.5 Goals","Goals","The last two H2Hs finished 3-0 and 1-0. A tight game or a narrow Galatasaray win fits this line."],
   ["btts_yes","BTTS — Yes","BTTS","Kasımpaşa have started the league season unbeaten and may score even if Galatasaray win. This is a higher-risk alternative, not a pick to combine blindly with the under."]
  ]}
};
const amer=n=>n<0?"-"+Math.abs(n):"+"+n;
function exact(event,market){
 const q=(event?.competitions?.[0]?.odds||[]).find(x=>(x.provider?.name||x.provider?.displayName)==="DraftKings");
 if(!q)return null;
 const side={home_win:"home",draw:"draw",away_win:"away"}[market];
 const raw=side?q.moneyline?.[side]?.close?.odds:null;
 let price=raw,actualLine=null;
 const total=/^(under|over)_(\d+)_(\d+)$/.exec(market);
 if(total){
  const val=Number(total[2]+"."+total[3]);
  const side=total[1], v=q.total?.[side]?.close;
  if(Number(q.overUnder)!==val||v?.line!==(side==="over"?"o":"u")+val)return null;
  price=v.odds;actualLine=val;
 }
 if(!/^[-+]\d{2,5}$/.test(String(price||"")))return null;
 const n=Number(price);
 if(n===0||n<-500||n>10000)return null;
 return {odds:n,bookKey:"draftkings",provider:"DraftKings",exactLine:actualLine};
}
function fairBookProbability(event,market){
 const q=(event?.competitions?.[0]?.odds||[]).find(x=>(x.provider?.name||x.provider?.displayName)==="DraftKings");
 const toProb=x=>{const n=Number(x);return n<0?Math.abs(n)/(Math.abs(n)+100):100/(n+100)};
 if(!q)return null;
 const ml=q.moneyline;
 if(market==="home_win"){
  const p=["home","draw","away"].map(k=>ml?.[k]?.close?.odds);
  if(p.some(x=>!x))return null;
  const probs=p.map(toProb);
  return probs[0]/probs.reduce((a,b)=>a+b,0);
 }
 if(market==="under_3_5"&&Number(q.overUnder)===3.5){
  const p=["under","over"].map(k=>q.total?.[k]?.close?.odds);
  if(p.some(x=>!x))return null;
  const probs=p.map(toProb);return probs[0]/probs.reduce((a,b)=>a+b,0);
 }
 return null;
}
function pick({modelFixture,event,market,label,category,reason,config,index}){
 const actual=exact(event,market);
 const trained=modelFixture?.status==="shadow_prediction";
 const p=trained?modelFixture.probabilities?.[market]:fairBookProbability(event,market);
 let conf=Number.isFinite(p)?Math.round(p*100):50;
 const marketOnly=!trained;
 const title="WHY THIS PICK";
 const reasons=[reason,config.h2h].filter(Boolean);
 if(index===0&&config.risk)reasons.push(config.risk);
 const ptext=reasons.join(" ");
 const out={label,category,score:conf,stars:conf>=92?"★★★★★":conf>=88?"★★★★½":conf>=83?"★★★★":conf>=78?"★★★½":"★★★",
  modelScore:trained?conf:null,baseScore:trained?conf:null,
  odds:actual?.odds??null,verifiedPrice:!!actual,bookExact:!!actual,
  provider:actual?.provider??null,bookKey:actual?.bookKey??null,
  modelProb:trained&&Number.isFinite(p)?p:null,
  marketProb:actual?Number((actual.odds<0?Math.abs(actual.odds)/(Math.abs(actual.odds)+100):100/(actual.odds+100)).toFixed(6)):null,
  ev:actual&&trained&&Number.isFinite(p)?Number((p*(actual.odds<0?1+100/Math.abs(actual.odds):1+actual.odds/100)-1).toFixed(6)):null,
  displayOdds:actual?.odds??null,priceEligible:!!actual,
  priceStatus:actual?null:"no_verified_odds",displayOnly:false,researchOnly:true,
  confidenceSource:trained?"model_pre_match_probability_uncalibrated":p!=null?"posted_bookmaker_odds_not_model":"qualitative_preview_only",
  editorialSource:config.src,editorialSecondary:config.secondary||null,
  archivedCommentary:ptext,archivedSupportFacts:reasons,
  expandedWhyTitle:title,reviewFlag:marketOnly?"not_a_trained_turkish_forecast":config.risk?"some_previews_disagree":"reference_cross_checked"};
 return out;
}
async function main(){
 const before=await fs.readFile(BOARD,"utf8");
 const board=JSON.parse(before);
 if(board.date!==DATE||board.games?.length!==8||board.state!=="locked")throw Error("Expected original eight-game locked board");
 if(board.ownerCorrection?.threePickEditorial==="football-preview-oct09") {
  console.log("Three-pick board already published; do not rewrite");return;
 }
 const [model,scoreboard,audits]=await Promise.all([
  read("data/model-candidates-expanded/"+DATE+".json"),
  read("data/"+DATE+"/scoreboard.json"),
  read(REV+"/audit.json")]);
 if(model.modelVersion!=="dc-shadow-v0.5"||model.coverage?.eligibleLeagueFixtures!==8)
   throw Error("No dated eight-game model");
 const forecasts=new Map(model.fixtures.map(f=>[String(f.fixtureId),f]));
 const events=new Map(scoreboard.events.map(e=>[String(e.id),e]));
 const trackedSignature=refs=>refs.map(x=>({rank:x.rank,gameId:String(x.gameId),
  label:x.pick?.label,score:x.pick?.score,odds:x.pick?.odds}));
 const originalTop5=JSON.stringify(trackedSignature(board.top5));
 const originalFirsts=new Map(board.games.map(g=>[String(g.id),{label:g.top3?.[0]?.label,odds:g.top3?.[0]?.odds}]));
 for(const g of board.games){
  const id=String(g.id), config=cfg[id], f=forecasts.get(id),event=events.get(id);
  if(!config||!event)throw Error("Unknown board fixture "+id);
  if(f?.status==="shadow_prediction" && Date.parse(f.kickoff)<=Date.parse(model.asOf))throw Error("No original pre-match model "+id);
  let choices=config.picks.map(([market,label,cat,reason],i)=>pick({modelFixture:f,event,market,label,category:cat,reason,config,index:i}));
  const original=originalFirsts.get(id);
  if((id==="401884781"||id==="401875592")&&original){
   const first=choices[0];
   if(first.label!==original.label)throw Error("Original pick label changed "+id);
   // Preserve exactly the original price, score and original pick identity.
   // Only append independent supporting alternatives and revise plain-English narrative.
   const kept=JSON.parse(JSON.stringify(g.top3[0]));
   kept.archivedCommentary=first.archivedCommentary;
   kept.archivedSupportFacts=first.archivedSupportFacts;
   kept.editorialSource=config.src;
   kept.displayOnly=false;
   choices[0]=kept;
  }
  g.top3=choices;
  g.top=choices[0];
  g.model={...(g.model||{}),top:choices[0],top3:choices,
    rankedCandidates:choices.filter(p=>p.odds!=null&&p.score>=80),
    researchCandidates:choices,
    // preserve historical model candidate data alongside user-facing picks
    candidates:g.model?.candidates||[],
    editorialWhy:config.why,editorialH2H:config.h2h,
    editorialSources:[config.src,config.secondary].filter(Boolean)};
  // User-facing cards should show why the choice makes football sense,
  // without repeating model versioning, archival provenance or engineering warnings.
  g.ownerResearchNote=null;
  g.ownerEditorial={primary:config.why,headToHead:config.h2h,
    watchOut:config.risk||null,
    source:config.src,secondarySource:config.secondary||null,
    updatedForOwner:true};
  if(id==="401880233"){
   g.model.home={...(g.model.home||{}),n:5,form:"W W W W D",gf:3.6,ga:1.2};
   g.model.away={...(g.model.away||{}),n:5,form:"W L D D D",gf:1,ga:1};
  }
  if(g.top3.length!==3)throw Error("Not exactly three selections for "+id);
 }
 // Keep every original Top5 position, selection, score and price. Reuse
 // the updated, plain-English explanation in the reference copy so the
 // archive schema stays consistent with each game's saved Top 3.
 for(const refs of [board.top5,...Object.values(board.leagueTop5||{})]){
   for(const ref of refs){
     const game=board.games.find(g=>String(g.id)===String(ref.gameId));
     if(!game||ref.pick?.label!==game.top?.label)throw Error("Unexpected ranked pick identity");
     ref.pick=JSON.parse(JSON.stringify(game.top));
   }
 }
 if(JSON.stringify(trackedSignature(board.top5))!==originalTop5)
   throw Error("Original global Top 5 rankings, confidence or sportsbook prices changed");
 for(const id of ["401884781","401875592"]){
  const g=board.games.find(x=>String(x.id)===id),old=originalFirsts.get(id);
  if(g.top3[0].odds!==old.odds||g.top3[0].label!==old.label)throw Error("Original first pick's price changed");
 }
 board.ownerCorrection={...board.ownerCorrection,
  threePickEditorial:"football-preview-oct09",
  originalTop5Preserved:true,priceFloor:-500,
  previewSources:"Football Whispers plus vetted additional previews where relevant",
  note:"Updated user-facing Why This Pick, H2H and three match-market choices, with exact archived DraftKings quotes where available."};
 const after=fmt(board);
 await fs.writeFile(BACKUP,before,{flag:"wx"});
 audits.push({file:BOARD,owner:"Shaif",
  instruction:"Show plain-language reasons, three picks per game, verified H2H and Football Whispers cross-references; fill real odds; publish quickly through GitHub without Vercel.",
  correctedAt:new Date().toISOString(),beforeSha256:sha(before),afterSha256:sha(after),
  backupPath:BACKUP,reason:"Plain-English eight-game researched three-pick revision with exact archived DraftKings odds and documented H2H; original global Top5 and prior morning first picks remain intact."});
 await fs.writeFile(REV+"/audit.json",fmt(audits));
 await fs.writeFile(BOARD,after);
 console.log("Published 8 games x 3 picks =",board.games.reduce((a,g)=>a+g.top3.length,0));
 for(const g of board.games)console.log(g.home+" v "+g.away,g.top3.map(p=>p.label+" "+(p.odds??"N/A")).join(" | "));
}
main().catch(e=>{console.error(e);process.exitCode=1});
