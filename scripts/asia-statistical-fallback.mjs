// FootyEdge J1/K League 1 research fallback when licensed editorial picks are absent.
// Pre-match results only; no sportsbook quotes, fictional team news or external
// preview consensus. Three distinct football theses or PASS.
import {trend} from "./apply-editorial-consensus.mjs";

const ASIA=new Set(["jpn.1","kor.1"]);
const choices=[
 ["home_win","result","Match Result",(h)=>h+" ML"],
 ["away_win","result","Match Result",(_h,a)=>a+" ML"],
 ["home_or_draw","result","Double Chance",(h)=>h+" or Draw"],
 ["away_or_draw","result","Double Chance",(_h,a)=>a+" or Draw"],
 ["over_1_5","total","Goals",()=>"Over 1.5 Goals"],
 ["over_2_5","total","Goals",()=>"Over 2.5 Goals"],
 ["under_2_5","total","Goals",()=>"Under 2.5 Goals"],
 ["under_3_5","total","Goals",()=>"Under 3.5 Goals"],
 ["under_4_5","total","Goals",()=>"Under 4.5 Goals"],
 ["btts_yes","attack","BTTS",()=>"BTTS Yes"],
 ["btts_no","attack","BTTS",()=>"BTTS No"],
 ["home_goal","attack","Team Goals",h=>h+" 1+ Goal"],
 ["away_goal","attack","Team Goals",(_h,a)=>a+" 1+ Goal"]
];
const valid=(x,at)=>Number.isFinite(Date.parse(x?.date))&&Date.parse(x.date)<at&&
 Number.isInteger(x.gf)&&x.gf>=0&&Number.isInteger(x.ga)&&x.ga>=0&&
 ["W","D","L"].includes(x.result);
const count=(arr,test)=>arr.filter(test).length;
const ratio=(arr,test)=>arr.length?count(arr,test)/arr.length:null;
const pct=n=>Math.round(n*100);
const descriptor=key=>{
 if(key==="home_win")return "a home result";
 if(key==="away_win")return "an away result";
 if(key.endsWith("or_draw"))return "some protection against an outright defeat";
 if(key.startsWith("under_"))return "a controlled scoring game";
 if(key.startsWith("over_"))return "more scoring opportunities";
 if(key==="btts_yes")return "both teams finding the net";
 if(key==="btts_no")return "at least one attack being kept quiet";
 return "a goal from the selected side";
};
function reason(key,h,a,H,A,fh,fa,homeVenue,awayVenue){
 const allH=count(H,fh),allA=count(A,fa);
 const lastH=count(H.slice(0,5),fh),lastA=count(A.slice(0,5),fa);
 const homeH=count(homeVenue,fh),awayA=count(awayVenue,fa);
 let opener="";
 switch(key){
  case "home_win":opener=h+" have the stronger result case at home, although the visitors can still make it competitive.";break;
  case "away_win":opener=a+" have shown enough winning form to threaten away from home, but this is not a risk-free result.";break;
  case "home_or_draw":opener=h+" have been harder to beat recently, so covering the draw makes more sense than demanding a win.";break;
  case "away_or_draw":opener=a+" have enough recent resilience to avoid relying on an outright away win.";break;
  case "btts_yes":opener="Both sides have been involved in games where each team found a goal, so a goal at either end is a reasonable route.";break;
  case "btts_no":opener="Neither attack has been completely reliable, leaving a clean sheet for either side in play.";break;
  case "home_goal":opener=h+" have found scoring chances, while "+a+" have not always kept opponents out.";break;
  case "away_goal":opener=a+" have found scoring chances, while "+h+" have allowed opportunities.";break;
  default:opener=key.startsWith("over_")?
   "Both clubs' recent scorelines leave room for an open game without needing to predict the winner.":
   "The recent scorelines support a more measured game, rather than counting on a goal rush.";
 }
 const support=h+"'s last "+H.length+" games support this angle "+allH+" times, compared with "+
   allA+" of "+a+"'s last "+A.length+".";
 const recent=" Over the last five, the records are "+lastH+"/5 and "+lastA+"/5 respectively.";
 const venue=homeVenue.length>=3&&awayVenue.length>=3?
   " The home/away split is "+homeH+"/"+homeVenue.length+" for "+h+" at home and "+
     awayA+"/"+awayVenue.length+" for "+a+" away.":"";
 return opener+" "+support+recent+venue;
}
function incompatible(result,total,attack){
 if(!attack)return false;
 if(attack.key==="btts_yes" && ["over_1_5","under_2_5"].includes(total.key))return true;
 if(attack.key==="home_goal" && result.key==="home_win")return true;
 if(attack.key==="away_goal" && result.key==="away_win")return true;
 return false;
}
export function selectAsiaFallback(fixture){
 if(!ASIA.has(fixture?.league))return [];
 const kickoff=Date.parse(fixture.date),h=String(fixture.home?.name||""),a=String(fixture.away?.name||"");
 if(!Number.isFinite(kickoff)||!h||!a||h===a)return [];
 const H=(fixture.last10?.home||[]).filter(x=>valid(x,kickoff)).slice(0,10);
 const A=(fixture.last10?.away||[]).filter(x=>valid(x,kickoff)).slice(0,10);
 if(H.length<8||A.length<8)return [];
 const homeVenue=H.filter(x=>x.venue==="home"),awayVenue=A.filter(x=>x.venue==="away");
 const candidates=[];
 for(const [key,family,category,labelFn] of choices){
  const [fh,fa]=trend(key);
  const hRate=ratio(H,fh),aRate=ratio(A,fa),
   recent=(ratio(H.slice(0,5),fh)+ratio(A.slice(0,5),fa))/2,
   venue=homeVenue.length>=3&&awayVenue.length>=3?
    (ratio(homeVenue,fh)+ratio(awayVenue,fa))/2:(hRate+aRate)/2;
  const combined=(hRate+aRate)/2;
  // Minimum evidence on BOTH sides, never just one club's hot streak.
  if(hRate<.40||aRate<.40||combined<.55||recent<.40)continue;
  const rating=Math.min(94,Math.max(40,Math.round(100*(.52*combined+.28*recent+.20*venue))));
  if(rating<57)continue;
  candidates.push({key,family,label:labelFn(h,a),category,confidenceRating:rating,
   score:null,ev:null,probabilityCalibrated:false,researchOnly:true,sourceBackedReason:false,
   reviewMethod:"verified-last10-last5-home-away",reason:reason(key,h,a,H,A,fh,fa,homeVenue,awayVenue),
   verifiedPrice:false,odds:null,priceStatus:"not_verified",riskNote:"Research grade, not an estimated win probability.",
   independentPreviewConsensus:false});
 }
 candidates.sort((x,y)=>y.confidenceRating-x.confidenceRating||
  x.label.localeCompare(y.label));
 // Exactly one distinct result, one goals total, one scoring thesis.
 // No neighboring over/under lines or redundant ML/DC combinations.
 const groups=["result","total","attack"].map(f=>candidates.filter(c=>c.family===f));
 if(groups.some(group=>!group.length))return [];
 let best=null;
 for(const result of groups[0])for(const total of groups[1])for(const attack of groups[2]){
  if(incompatible(result,total,attack))continue;
  const trio=[result,total,attack];
  const floor=Math.min(...trio.map(x=>x.confidenceRating));
  const strength=trio.reduce((n,x)=>n+x.confidenceRating,0);
  if(!best||floor>best.floor||(floor===best.floor&&strength>best.strength))
   best={floor,strength,trio};
 }
 if(!best)return [];
 return best.trio.sort((x,y)=>y.confidenceRating-x.confidenceRating).map((x,i)=>{
  const {key,family,...pick}=x;return {...pick,rank:i+1};
 });
}
export const ASIA_FALLBACK_LEAGUES=Object.freeze([...ASIA]);
