#!/usr/bin/env node
/**
 * Daily reviewed FootyEdge publication: source-supported picks, not a
 * statistical model masquerading as independent editorial research.
 *
 * Requires dated, explicitly authorised evidence from the configured feed
 * or data/editorial-evidence/YYYY-MM-DD.json. Public output has original,
 * plain-English explanations, no provider names, article links or odds.
 * Absence of licensed evidence => PASS. Does not rewrite frozen archives.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {authorised,readEvidence,trend} from "./apply-editorial-consensus.mjs";
import {compatible} from "./build-daily-slips.mjs";

const todayET=()=>Object.fromEntries(new Intl.DateTimeFormat("en-CA",{
 timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"
}).formatToParts(new Date()).map(p=>[p.type,p.value]));
const norm=v=>String(v??"").toLowerCase().normalize("NFD")
 .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const identity=(g,side)=>typeof g[side]==="string"?g[side]:g[side]?.name||"";
const MARKET_DEFINITIONS={
 home_win:{category:"Match Result",family:"winner",label:(h)=>h+" ML"},
 away_win:{category:"Match Result",family:"winner",label:(_h,a)=>a+" ML"},
 home_or_draw:{category:"Double Chance",family:"double-chance",label:(h)=>h+" or Draw"},
 away_or_draw:{category:"Double Chance",family:"double-chance",label:(_h,a)=>a+" or Draw"},
 over_1_5:{category:"Goals",family:"total",label:()=>"Over 1.5 Goals"},
 over_2_5:{category:"Goals",family:"total",label:()=>"Over 2.5 Goals"},
 under_2_5:{category:"Goals",family:"total",label:()=>"Under 2.5 Goals"},
 under_3_5:{category:"Goals",family:"total",label:()=>"Under 3.5 Goals"},
 under_4_5:{category:"Goals",family:"total",label:()=>"Under 4.5 Goals"},
 btts_yes:{category:"BTTS",family:"btts",label:()=>"BTTS Yes"},
 btts_no:{category:"BTTS",family:"btts",label:()=>"BTTS No"},
 home_goal:{category:"Team Goals",family:"team-goal",label:h=>h+" 1+ Goal"},
 away_goal:{category:"Team Goals",family:"team-goal",label:(_h,a)=>a+" 1+ Goal"}
};
const read=async p=>fs.readFile(p,"utf8").then(JSON.parse).catch(e=>{
 if(e.code==="ENOENT")return null;throw e;
});
function prose(key,h,a,hitsH,hitsA,H,A,homeVenue,awayVenue){
 const first=(key==="home_win"||key==="home_or_draw")?
    h+" have made themselves difficult to beat, and "+a+" have shown some weaknesses that could matter here.":
 (key==="away_win"||key==="away_or_draw")?
    a+" have shown enough quality to stay competitive, while "+h+" have not been completely convincing.":
 key.startsWith("over_")?
    "Both teams have been involved in games with goals, which makes this lower scoring threshold attractive.":
 key.startsWith("under_")?
    "Neither side needs to turn this into a shootout, and their recent results give this upper goal limit some support.":
 key==="btts_yes"?
    "Both attacks have had opportunities recently, and neither back line looks impossible to breach.":
 key==="btts_no"?
    "Recent matches include plenty of occasions when at least one side failed to score.":
 key==="home_goal"?
    h+" have regularly found a goal, and "+a+" have allowed opponents chances.":
    a+" have shown they can score, and "+h+" have given opponents openings.";
 const numbers=" The recent-match record backs that up in "+hitsH+"/"+H.length+
    " "+h+" games and "+hitsA+"/"+A.length+" "+a+" games.";
 const venue=homeVenue.length>=3&&awayVenue.length>=3?
   " The home-and-away split was checked as well.":"";
 return first+numbers+venue;
}
function supports(key,H,A,h,a){
 const t=trend(key);
 if(!t)return null;
 const [fh,fa]=t;
 const hitsH=H.filter(fh).length,hitsA=A.filter(fa).length;
 const rateH=hitsH/H.length,rateA=hitsA/A.length;
 const r5=(H.slice(0,5).filter(fh).length+A.slice(0,5).filter(fa).length)/10;
 const homeVenue=H.filter(x=>x.venue==="home"),awayVenue=A.filter(x=>x.venue==="away");
 const venue=homeVenue.length>=3&&awayVenue.length>=3?
   (homeVenue.filter(fh).length/homeVenue.length+awayVenue.filter(fa).length/awayVenue.length)/2:
   (rateH+rateA)/2;
 return {rateH,rateA,r5,venue,hitsH,hitsA,homeVenue,awayVenue};
}
function tickets(choices){
 const legsByGame=new Map();
 for(const m of choices)for(const p of m.picks){
   const leg={gameId:m.gameId,fixture:m.home+" vs "+m.away,league:m.league,kickoff:m.kickoff,
    label:p.label,category:p.category,family:p.family,rating:p.confidenceRating,
    why:p.reason,evidence:"Dated independent match review plus form and venue checks.",
    verifiedPrice:false,odds:null,bookKey:null,source:"FootyEdge original match analysis",risk:[]};
   if(!legsByGame.has(m.gameId))legsByGame.set(m.gameId,[]);
   legsByGame.get(m.gameId).push(leg);
 }
 let best=null;
 for(const legs of legsByGame.values()){
   if(legs.length<3)continue;
   const group=legs.filter(x=>x.rating>=65).slice(0,5);
   if(group.length<3)continue;
   if(group.some((x,i)=>group.slice(i+1).some(y=>!compatible(x,y))))continue;
   const strength=Math.min(...group.map(x=>x.rating));
   if(!best||strength>best.strength)best={strength,legs:group};
 }
 const passSgp={status:"pass",format:"Same-game parlay",legs:[],
   caution:"No match has three distinct, supported, compatible legs from authorised research. No SGP was forced."};
 const sgp=best?{status:"qualified",format:"Same-game parlay",legs:best.legs.slice(0,5),
    overallResearchRating:null,caution:"Three to five match conditions, some correlated. Exact sportsbook markets and odds are unverified."}:passSgp;
 const pool=[...legsByGame.values()].flat().filter(x=>x.rating>=72)
   .sort((a,b)=>b.rating-a.rating||a.gameId.localeCompare(b.gameId));
 const picked=[],usedGames=new Set(),usedFamilies=new Map();
 for(const leg of pool){
   if(usedGames.has(leg.gameId)||(usedFamilies.get(leg.family)||0)>=2)continue;
   picked.push(leg);usedGames.add(leg.gameId);
   usedFamilies.set(leg.family,(usedFamilies.get(leg.family)||0)+1);
   if(picked.length===5)break;
 }
 const acca=picked.length>=4?{status:"qualified",format:"Cross-game parlay",legs:picked,
   overallResearchRating:null,caution:"One independently researched market per fixture. Parlay risk compounds and sportsbook odds are unverified."}:
   {status:"pass",format:"Cross-game parlay",legs:[],
    caution:"Fewer than four distinct supported matches. No cross-game slip was forced."};
 const sgpsByLeague=[...new Set(choices.map(x=>x.league))].flatMap(league=>{
   const filtered=choices.filter(x=>x.league===league);
   const data=ticketsForLeague(filtered);
   return data? [{league,...data}]:[];
 });
 return {sgp,acca,sgpsByLeague};
}
function ticketsForLeague(choices){
 let best=null;
 for(const m of choices){
   const legs=m.picks.filter(x=>x.confidenceRating>=65).map(p=>({
    gameId:m.gameId,fixture:m.home+" vs "+m.away,league:m.league,kickoff:m.kickoff,
    label:p.label,category:p.category,family:p.family,rating:p.confidenceRating,
    why:p.reason,verifiedPrice:false,odds:null,risk:[]
   }));
   if(legs.length<3||legs.length>5||legs.some((x,i)=>legs.slice(i+1).some(y=>!compatible(x,y))))continue;
   const score=Math.min(...legs.map(x=>x.rating));
   if(!best||score>best.score)best={score,legs};
 }
 return best?{status:"qualified",format:"League same-game parlay",
   legs:best.legs,overallResearchRating:null,caution:"Odds and exact bet-builder markets unverified."}:null;
}
export function buildEditorialDesk({date,board,research,evidence=[]}){
 if(board?.date!==date||research?.date!==date||!Array.isArray(board.games)||!Array.isArray(research.fixtures))
   throw Error("Editorial desk requires complete, same-date fixtures and research");
 const refs=new Map(research.fixtures.map(f=>[String(f.id),f]));
 const valid=new Set(refs.keys()),votes=new Map();
 for(const e of evidence){
   if(!authorised(e,date,valid))continue;
   const key=String(e.match_id)+"|"+e.market_key;
   const group=votes.get(key)||new Map();
   // Same publisher counts only once per fixture/market. Oppositions stay visible.
   if(!group.has(e.source))group.set(e.source,e);
   votes.set(key,group);
 }
 const matches=[];
 for(const g of board.games){
   const f=refs.get(String(g.id));
   if(!f||norm(identity(g,"home"))!==norm(f.home.name)||norm(identity(g,"away"))!==norm(f.away.name))continue;
   const H=(f.last10?.home||[]).filter(r=>r?.date&&Date.parse(r.date)<Date.parse(f.date)
     &&Number.isFinite(r.gf)&&Number.isFinite(r.ga)).slice(0,10);
   const A=(f.last10?.away||[]).filter(r=>r?.date&&Date.parse(r.date)<Date.parse(f.date)
     &&Number.isFinite(r.gf)&&Number.isFinite(r.ga)).slice(0,10);
   if(H.length<5||A.length<5)continue;
   const h=f.home.name,a=f.away.name,options=[];
   for(const [key,definition] of Object.entries(MARKET_DEFINITIONS)){
     const opinions=[...(votes.get(String(g.id)+"|"+key)||new Map()).values()];
     const agrees=opinions.filter(x=>x.stance==="support").length;
     const oppose=opinions.filter(x=>x.stance==="oppose").length;
     if(agrees<1||agrees<=oppose)continue; // No invented consensus.
     const s=supports(key,H,A,h,a);
     if(!s||Math.min(s.rateH,s.rateA)<.35||(s.rateH+s.rateA)/2<.52)continue;
     const rating=Math.max(40,Math.min(96,Math.round(
       48*((s.rateH+s.rateA)/2)+25*s.r5+17*s.venue+4*Math.min(3,agrees)-6*oppose
     )));
     const label=definition.label(h,a);
     options.push({label,category:definition.category,family:definition.family,
       confidenceRating:rating,score:null,ev:null,probabilityCalibrated:false,
       researchOnly:true,sourceBackedReason:true,
       reason:prose(key,h,a,s.hitsH,s.hitsA,H,A,s.homeVenue,s.awayVenue),
       evidenceAgreement:agrees,evidenceDisagreement:oppose,
       priceStatus:"not_verified",odds:null,verifiedPrice:false});
   }
   options.sort((a,b)=>b.confidenceRating-a.confidenceRating||
     b.evidenceAgreement-a.evidenceAgreement||a.label.localeCompare(b.label));
   const selected=[],families=new Set();
   for(const candidate of options){
     if(families.has(candidate.family))continue;
     selected.push(candidate);families.add(candidate.family);
     if(selected.length===3)break;
   }
   if(selected.length!==3)continue; // Three genuine editorial angles or PASS.
   matches.push({gameId:String(g.id),home:h,away:a,league:g.league,kickoff:g.date,
     reviewed:true,picks:selected.map((p,i)=>({...p,rank:i+1}))});
 }
 const slip=tickets(matches);
 return {schema:"footyedge-editorial-desk-v1",date,
   state:matches.length?"reviewed":"pass",researchGradeNotProbability:true,
   noSportsbookOdds:true,confidenceCalibrated:false,originalMatchBoardsUnchanged:true,
   checkedMarkets:["Match Result","Double Chance","Totals","BTTS","Team Goals"],
   fixturesConsidered:board.games.length,licensedEvidenceItems:[...votes.values()].reduce((n,g)=>n+g.size,0),
   matches,...slip,props:[],
   notes:["Only independently authorised dated research can qualify public selections.",
    "Unreviewed matches show PASS rather than model-generated placeholders.",
    "Research grades are not calibrated winning probabilities.",
    "No sportsbook odds or payout estimates without exact verified prices.",
    "Frozen previous boards are never rewritten."]};
}
export function applyEditorialToDraft(board,desk){
 if(board.immutable||board.date!==desk.date)throw Error("Cannot modify frozen or mismatched board");
 const output=structuredClone(board);
 const reviewed=new Map(desk.matches.map(m=>[String(m.gameId),m]));
 for(const g of output.games){
   const row=reviewed.get(String(g.id));
   const picks=row&&norm(row.home)===norm(identity(g,"home"))&&norm(row.away)===norm(identity(g,"away"))?
     row.picks.map(p=>({...p})): [];
   g.top3=picks;g.top=picks[0]||null;
   g.model={...(g.model||{}),top:g.top,top3:picks,candidates:picks,
     rankedCandidates:picks,researchCandidates:picks};
   g.recoveryStatus=picks.length===3?"licensed-editorial-review":"pass-unverified-editorial";
 }
 const sorted=items=>items.filter(g=>g.top&&Number(g.top.confidenceRating)>=85&&Date.parse(g.date)>Date.now())
   .sort((a,b)=>Number(b.top.confidenceRating)-Number(a.top.confidenceRating));
 const refs=rows=>rows.slice(0,5).map((g,i)=>({rank:i+1,gameId:String(g.id),
   home:identity(g,"home"),away:identity(g,"away"),pick:g.top}));
 output.top5=refs(sorted(output.games));
 output.leagueTop5=Object.fromEntries([...new Set(output.games.map(g=>g.league))]
   .map(l=>[l,refs(sorted(output.games.filter(g=>g.league===l)))]));
 output.sourceQuality={...(output.sourceQuality||{}),editorialSelection:{
   mode:"authorised-evidence-only",reviewedFixtures:desk.matches.length,
   sourceCount:desk.licensedEvidenceItems,missingSourcesAreNotAgreement:true
 }};
 output.publicationNotes="Only authorised independent match-research angles qualify. Unsupported fixtures PASS. Confidence is a research grade, not a win probability.";
 return output;
}
async function main(){
 const d=todayET(),date=process.env.EDITORIAL_DATE||d.year+"-"+d.month+"-"+d.day;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Invalid editorial date");
 const dest=path.join("data","editorial-desk",date+".json");
 if(await read(dest)){console.log("Existing dated editorial desk is immutable; skip",date);return;}
 const boardPath=path.join("data","boards",date+".json"),
   draftPath=path.join("data","board-drafts",date+".json");
 const frozen=await read(boardPath);
 const board=frozen||await read(draftPath),
   research=await read(path.join("data","research-base-"+date+".json"));
 if(!board||!research){console.log("No exact-date fixtures and research. No editorial desk published.");return;}
 let evidence=[];
 try{evidence=await readEvidence(date);}
 catch(e){console.warn("Authorised editorial evidence unavailable; PASS rather than inventing source picks:",e.message);}
 const desk=buildEditorialDesk({date,board,research,evidence});
 await fs.mkdir(path.dirname(dest),{recursive:true});
 // Before first freeze only. Never rewrite an existing official JSON board.
 if(!frozen){
   const draft=applyEditorialToDraft(board,desk);
   await fs.writeFile(draftPath,JSON.stringify(draft,null,2)+"\n");
 }
 await fs.writeFile(dest,JSON.stringify(desk,null,2)+"\n");
 console.log(JSON.stringify({date,sourceEvidence:desk.licensedEvidenceItems,
   reviewedFixtures:desk.matches.length,sgpLegs:desk.sgp.legs.length,
   accaLegs:desk.acca.legs.length,updatedPreFreeze:!frozen}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
 main().catch(e=>{console.error(e);process.exitCode=1});
