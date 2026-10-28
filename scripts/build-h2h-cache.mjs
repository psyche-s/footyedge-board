#!/usr/bin/env node
// Read-only, date-specific H2H cache for the original FootyEdge match details.
// Reads completed ESPN schedule SCORE facts; never imports odds or modifies picks.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const SITE=(process.env.FOOTYEDGE_URL||'https://footyedge-board.vercel.app').replace(/\/$/,'');
const toronto=()=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
const today=()=>{const v=toronto();return v.year+'-'+v.month+'-'+v.day};
const str=v=>String(v??'');
const score=c=>{
  const value=c?.score&&typeof c.score==='object'?c.score.value??c.score.displayValue:c?.score;
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isInteger(n)&&n>=0&&n<=30?n:null;
};
export function extractPreviousMeetings(fixture,payloads,now=Date.now()){
  const cutoff=Date.parse(fixture?.date||'');
  if(!Number.isFinite(cutoff)||!fixture.home?.id||!fixture.away?.id)return[];
  const seen=new Set(),out=[];
  const homeId=str(fixture.home.id),awayId=str(fixture.away.id);
  for(const payload of payloads){
    for(const event of payload?.events||[]){
      const kickoff=Date.parse(event?.date||'');
      if(!Number.isFinite(kickoff)||kickoff>=cutoff||kickoff>now)continue;
      if(event?.status?.type?.completed===false||event?.competitions?.[0]?.status?.type?.completed===false)continue;
      const teams=event?.competitions?.[0]?.competitors||[];
      const home=teams.find(x=>x.homeAway==='home'),away=teams.find(x=>x.homeAway==='away');
      if(!home||!away)continue;
      const hi=str(home.id??home.team?.id),ai=str(away.id??away.team?.id);
      if(!((hi===homeId&&ai===awayId)||(hi===awayId&&ai===homeId)))continue;
      const hs=score(home),as=score(away);
      if(hs===null||as===null)continue;
      const nameHome=str(home.team?.displayName||home.team?.name);
      const nameAway=str(away.team?.displayName||away.team?.name);
      if(!nameHome||!nameAway)continue;
      const id=str(event.id||kickoff+'-'+hi+'-'+ai);
      if(seen.has(id))continue;
      seen.add(id);
      out.push({id,date:new Date(kickoff).toISOString(),home:nameHome,away:nameAway,
        homeScore:hs,awayScore:as,source:'ESPN historical results'});
    }
  }
  return out.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,5);
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fetchSchedule(game,year){
 const url=SITE+'/api/espn-schedule?league='+encodeURIComponent(game.league)+
   '&team='+encodeURIComponent(game.home.id)+'&season='+year+'&scope=all';
 try{
   const res=await fetch(url,{signal:AbortSignal.timeout(11000),headers:{accept:'application/json'}});
   if(!res.ok)throw Error('HTTP '+res.status);
   const j=await res.json();
   if(!Array.isArray(j?.events))throw Error('Schedule missing events');
   return {payload:j,success:true};
 }catch(e){return{payload:{events:[]},success:false,error:String(e.message||e).slice(0,70)}}
}
async function build(game,previous){
 if(!game?.id||!game?.date||!game.home?.id||!game.away?.id)return null;
 const hubMeetings=(game.hubHistory?.h2h||[]).filter(m=>/^\\d{4}-\\d{2}-\\d{2}$/.test(m.date)&&
   m.date<String(game.date).slice(0,10)&&Number.isInteger(m.homeScore)&&Number.isInteger(m.awayScore))
   .slice(0,5).map(m=>({id:m.sourceId||"hub:"+m.date+":"+m.home+":"+m.away,
     date:m.date+"T12:00:00Z",home:m.home,away:m.away,
     homeScore:m.homeScore,awayScore:m.awayScore,source:"CC0 verified domestic-league results"}));
 if(String(game.home.id).startsWith("source-")||String(game.away.id).startsWith("source-")){
   return {fixtureId:str(game.id),league:game.league,homeId:str(game.home.id),
     awayId:str(game.away.id),home:game.home.name,away:game.away.name,
     h2h:hubMeetings,checkedSeasons:[],failedSeasons:[],
     status:hubMeetings.length?"verified-hub-domestic-history":"no-cross-competition-h2h-verified"};
 }
 const limitYear=Math.min(Number(game.season||String(game.date).slice(0,4)),Number(String(game.date).slice(0,4)));
 const years=Array.from({length:9},(_,i)=>limitYear-i).filter(y=>y>=2017);
 const payloads=[],checked=[],failed=[];
 let meetings=[];
 for(const year of years){
   const got=await fetchSchedule(game,year);
   if(got.success){payloads.push(got.payload);checked.push(year)}
   else failed.push(year);
   meetings=extractPreviousMeetings(game,payloads);
   if(meetings.length===5)break;
 }
 const old=previous?.h2h||[];
 if(old.length>meetings.length){
   // Never replace previously verified, date-matched older cache with a transient
   // partial lookup. Keep observations, but retain explicit partial status.
   meetings=extractPreviousMeetings(game,[{events:[]}]); // reset; normalized below
   meetings=old.filter(m=>m?.date&&Date.parse(m.date)<Date.parse(game.date)&&
     Number.isInteger(m.homeScore)&&Number.isInteger(m.awayScore)).slice(0,5);
 }
 return {fixtureId:str(game.id),league:game.league,homeId:str(game.home.id),
    awayId:str(game.away.id),home:game.home.name,away:game.away.name,
    h2h:meetings,checkedSeasons:checked,failedSeasons:failed,
    status:meetings.length?'verified-partial-or-complete':checked.length?'no-verified-meetings-in-checked-seasons':'history-source-unavailable'};
}
async function main(){
 const date=process.env.H2H_DATE||today();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Bad date');
 const research=JSON.parse(await fs.readFile(path.join('data','research-base-'+date+'.json'),'utf8'));
 if(research.date!==date||!Array.isArray(research.fixtures))throw Error('Matching research required');
 const file=path.join('data','h2h',date+'.json');
 const previous=await fs.readFile(file,'utf8').then(JSON.parse).catch(e=>{if(e.code!=='ENOENT')throw e;return null});
 const prior=new Map((previous?.fixtures||[]).map(x=>[str(x.fixtureId),x]));
 const fixtures=research.fixtures;
 const rows=new Array(fixtures.length);
 let next=0;
 const worker=async()=>{while(true){const i=next++;if(i>=fixtures.length)return;
   rows[i]=await build(fixtures[i],prior.get(str(fixtures[i].id)));
   // Be considerate to the free public reference endpoint.
   await sleep(110);
 }};
 await Promise.all(Array.from({length:5},worker));
 const doc={schema:'footyedge-h2h-history-v1',date,generatedAt:new Date().toISOString(),
   source:'Historical ESPN team schedules via read-only FootyEdge proxy',
   note:'Scores are previous completed matches only; partial source coverage is never represented as five verified meetings.',
   frozenBoardsUnchanged:true,fixtures:rows.filter(Boolean)};
 await fs.mkdir(path.dirname(file),{recursive:true});
 await fs.writeFile(file,JSON.stringify(doc,null,2)+'\n');
 console.log(JSON.stringify({date,fixtures:doc.fixtures.length,withH2H:doc.fixtures.filter(x=>x.h2h.length).length,
   totalMeetings:doc.fixtures.reduce((n,x)=>n+x.h2h.length,0),sourceFailure:doc.fixtures.filter(x=>x.status==='history-source-unavailable').length}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e);process.exitCode=1});
