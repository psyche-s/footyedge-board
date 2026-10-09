/** Czech men's First League supplemental fixture/results feed.
 * Public-domain source: openfootball/europe/czech-republic/<season>_cz1.txt.
 * Not an ESPN ID; never guess an ESPN competition identifier or live status.
 */
const WEEKDAY=/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})(?: (\d{4}))?$/;
const MONTHS={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
const CODE="cze.1";
const ZONE="Europe/Prague";
const k=s=>String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
function localKickoff(date,time){
  const h=Number(time.slice(0,2)),m=Number(time.slice(3));
  const stamp=new Date(date+"T12:00:00Z");
  const token=new Intl.DateTimeFormat("en-US",{timeZone:ZONE,timeZoneName:"shortOffset"})
    .formatToParts(stamp).find(p=>p.type==="timeZoneName")?.value||"GMT+0";
  const offset=token.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if(!offset)throw new Error("Unknown Prague UTC offset");
  const minutes=(offset[1]==="-"?-1:1)*(Number(offset[2])*60+Number(offset[3]||0));
  const utc=Date.parse(date+"T00:00:00Z")+(h*60+m-minutes)*60000;
  return new Date(utc).toISOString();
}
export function sourceUrlForDate(date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("Invalid Czech league date");
  const year=Number(date.slice(0,4)),start=Number(date.slice(5,7))>=7?year:year-1;
  return "https://raw.githubusercontent.com/openfootball/europe/master/czech-republic/"+start+"-"+String((start+1)%100).padStart(2,"0")+"_cz1.txt";
}
export function parseCzechSeason(text,{seasonStart=2026}={}){
  let date=null,time=null;
  const out=[],seen=new Set();
  for(const raw of String(text||"").split(/\r?\n/)){
    const line=raw.trim();
    const day=line.match(WEEKDAY);
    if(day){
      const month=MONTHS[day[1]],yr=day[3]?Number(day[3]):month>=7?seasonStart:seasonStart+1;
      date=yr+"-"+String(month).padStart(2,"0")+"-"+day[2].padStart(2,"0");
      time=null;
      continue;
    }
    if(!date||!line||line.startsWith("#")||line.startsWith("▪"))continue;
    let rest=line;
    const clock=rest.match(/^(\d{1,2}:\d{2})\s{2,}/);
    if(clock){time=clock[1].padStart(5,"0");rest=rest.slice(clock[0].length);}
    if(!time)continue;
    let match=rest.match(/^(.+?)\s{2,}v\s{2,}(.+?)\s*$/);
    let home,away,score=null;
    if(match){home=match[1].trim();away=match[2].trim();}
    else {
      match=rest.match(/^(.+?)\s{2,}(\d+)-(\d+)\s+\(\d+-\d+\)\s{2,}(.+?)\s*$/);
      if(!match)continue;
      home=match[1].trim();away=match[4].trim();
      score=[Number(match[2]),Number(match[3])];
    }
    if(!home||!away||k(home)===k(away))continue;
    const id="cz1-"+date.replaceAll("-","")+"-"+k(home)+"-"+k(away);
    if(seen.has(id))continue;seen.add(id);
    out.push({id,date,time,home,away,kickoff:localKickoff(date,time),
      score,league:CODE,source:"openfootball/europe/czech-republic",seasonStart});
  }
  return out;
}
export function eventForCzechMatch(m){
  const completed=Array.isArray(m.score),id=m.id;
  const teams=[
    {id:"cz1-"+k(m.home),homeAway:"home",score:completed?String(m.score[0]):"",team:{id:"cz1-"+k(m.home),displayName:m.home,name:m.home}},
    {id:"cz1-"+k(m.away),homeAway:"away",score:completed?String(m.score[1]):"",team:{id:"cz1-"+k(m.away),displayName:m.away,name:m.away}},
  ];
  return {id,uid:"footyedge:cze.1:"+id,date:m.kickoff,name:m.away+" at "+m.home,
    footyedgeLeague:CODE,sourceLeague:CODE,league:{name:"Czech First League",slug:CODE},
    season:{year:m.seasonStart,name:"Czech First League",slug:"czech-mens-first-league"},
    status:{type:{completed,name:completed?"STATUS_FINAL":"STATUS_SCHEDULED"}},
    competitions:[{id,competitors:teams,odds:[]}],
    source:"OpenFootball public-domain Czech men's First League calendar; delayed results, not live scores"};
}
export async function loadCzechSeason(date,{fetcher=fetch}={}){
  const url=sourceUrlForDate(date),controller=new AbortController();
  const response=await fetcher(url,{headers:{"Accept":"text/plain","User-Agent":"FootyEdge-Research/1.0"},signal:controller.signal});
  if(!response.ok)throw new Error("Czech source HTTP "+response.status);
  const year=Number(url.match(/\/(\d{4})-\d{2}_cz1\.txt$/)?.[1]);
  const text=await response.text();
  const matches=parseCzechSeason(text,{seasonStart:year});
  if(matches.length<20)throw new Error("Czech results/schedule source incomplete");
  return {url,matches,seasonStart:year};
}
export function eventsForCzechDate(matches,date){
  return matches.filter(x=>x.date===date).map(eventForCzechMatch);
}
