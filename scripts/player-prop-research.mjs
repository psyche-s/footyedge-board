// FootyEdge player-prop research gate. Never infer player form from team scores.
// Source records must be dated, player-identified and joined to the exact fixture.
const finite=(v)=>typeof v==="number"&&Number.isFinite(v);
const isDate=s=>/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(String(s||""));
export function evaluatePlayerProps({fixture,players=[],quotes=[]}={}){
 if(!fixture?.id||!fixture?.date||!Array.isArray(players))return [];
 const cutoff=Date.parse(fixture.date);if(!Number.isFinite(cutoff))return [];
 const result=[];
 for(const p of players){
  if(!p?.id||!p.name||!p.teamId||!Array.isArray(p.matches)||p.matches.length<5||!p.sourceUrl)continue;
  if(![String(fixture.home?.id),String(fixture.away?.id)].includes(String(p.teamId)))continue;
  const matches=p.matches.filter(m=>isDate(m.date)&&Date.parse(m.date)<cutoff&&m.completed===true&&finite(m.minutes)&&m.minutes>=0&&Number.isInteger(m.goals)&&m.goals>=0&&Number.isInteger(m.assists)&&m.assists>=0&&m.sourceUrl).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,10);
  if(matches.length<5)continue;
  const minutes=matches.reduce((n,m)=>n+m.minutes,0);
  const evidence={last10:matches.length,minutes,goals:matches.reduce((n,m)=>n+m.goals,0),assists:matches.reduce((n,m)=>n+m.assists,0),atgsHits:matches.filter(m=>m.goals>=1).length,scoreOrAssistHits:matches.filter(m=>m.goals+m.assists>=1).length};
  const lineup=p.lineup?.verified===true&&p.lineup.fixtureId===String(fixture.id)&&p.lineup.status==="starting";
  const eligible=lineup&&minutes>=300&&p.availability?.suspended!==true&&p.availability?.injured!==true;
  for(const market of ["ATGS","Score or Assist"]){
   const quote=quotes.find(q=>q.fixtureId===String(fixture.id)&&q.playerId===String(p.id)&&q.market===market&&q.verifiedNative===true&&q.provider&&q.sourceUrl&&isDate(q.asOf)&&Date.parse(q.asOf)<=cutoff&&finite(q.decimalOdds)&&q.decimalOdds>=1.2);
   result.push({fixtureId:String(fixture.id),playerId:String(p.id),player:p.name,teamId:String(p.teamId),market,sourceUrl:p.sourceUrl,stats:evidence,lineupVerified:lineup,eligible:!!eligible,quote:quote?{provider:quote.provider,sourceUrl:quote.sourceUrl,asOf:quote.asOf,decimalOdds:quote.decimalOdds}:null,confidence:null,ev:null,probabilityCalibrated:false,status:eligible&&quote?"research-only-uncalibrated":"PASS",reason:eligible?(quote?"Player history and verified price available; calibration still required.":"Exact native player-market quote unavailable."):"Starting lineup, availability or sufficient sourced minutes unverified."});
  }
 }
 return result;
}
