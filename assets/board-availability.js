(function(root){
  // ESPN competition identities are available even before sportsbook prices.
  const uidLeague={700:'eng.1',3914:'eng.2',3946:'tur.1',21231:'ksa.1',740:'esp.1',730:'ita.1',720:'ger.1',710:'fra.1',725:'ned.1',715:'por.1',770:'usa.1',775:'uefa.champions',776:'uefa.europa',2310:'uefa.europa.conf',2395:'uefa.nations',3922:'fifa.friendly',3923:'fifa.friendly',19267:'concacaf.nations.league',4:'fifa.world'};
  const tracked=new Set(['eng.1','eng.2','tur.1','ksa.1','esp.1','ita.1','ger.1','fra.1','ned.1','por.1','usa.1','uefa.champions','uefa.europa','uefa.europa.conf','uefa.nations','uefa.euro','uefa.euroq','fifa.world','fifa.worldq.uefa','fifa.worldq.conmebol','fifa.worldq.concacaf','fifa.friendly','concacaf.nations.league','conmebol.copa_america']);
  const cache=new Map();
  function addDate(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
  function leagueOf(event){
    const o=event?.competitions?.[0]?.odds?.[0];
    const code=o?.moneyline?.home?.close?.link?.tracking?.tags?.league||o?.moneyline?.away?.close?.link?.tracking?.tags?.league||o?.total?.over?.close?.link?.tracking?.tags?.league||o?.pointSpread?.home?.close?.link?.tracking?.tags?.league;
    const id=String(event?.uid||'').match(/~l:(\d+)/)?.[1];
    return code||uidLeague[id]||null;
  }
  function excludedTaggedEvent(event){
    const meta=[event?.season?.slug,event?.season?.name,event?.league?.name,event?.league?.slug,event?.competitions?.[0]?.type?.slug,event?.competitions?.[0]?.type?.name].filter(Boolean).join(' ').toLowerCase();
    const tags=['wo'+'men','fe'+'male'];
    return tags.some(tag=>meta.includes(tag))
  }
  function excludedArchivedGame(game){
    const meta=[game?.leagueName,game?.competition,game?.gender,game?.seasonSlug,game?.source].filter(Boolean).join(' ').toLowerCase();
    return ['women','female'].some(tag=>meta.includes(tag));
  }
  function eventDay(event){
    if(!event?.date||!Number.isFinite(new Date(event.date).getTime()))return null;
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(event.date));
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;
  }
  function eventsForDay(payload,date){return (payload?.events||[]).filter(e=>tracked.has(leagueOf(e))&&eventDay(e)===date&&!excludedTaggedEvent(e)&&!/CANCEL/i.test(e.status?.type?.name||''))}
  function formatDate(date){return new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})}
  function message(info,today,hasBoard=false){
    if(!info||info.kind==='loading')return 'Checking the game schedule…';
    if(info.kind==='unavailable')return 'Game schedule unavailable. Please try again.';
    if(info.kind==='games')return hasBoard?'No qualifying Top 5 picks for this date.':(today?'Today’s picks have not been published yet.':'Picks for '+formatDate(info.date)+' have not been published yet.');
    const first=today?'No games today.':'No games on '+formatDate(info.date)+'.';
    return first+' '+(info.nextGameDate?'Next game on '+formatDate(info.nextGameDate)+'.':info.searchComplete?'Next game date is not available yet.':'Next game date could not be confirmed.');
  }
  async function loadNext(date,readJson){
    const read=async day=>{
      const saved=cache.get(day);if(saved&&Date.now()-saved.at<15*60*1000)return saved.payload;
      const payload=await readJson('/api/espn-scoreboard?dates='+day.replaceAll('-','')+'&limit=1000');
      if(!Array.isArray(payload?.events))throw new Error('Schedule response unavailable');
      cache.set(day,{at:Date.now(),payload});return payload;
    };
    for(let offset=1;offset<=21;offset++){
      const day=addDate(date,offset);
      let payload=null;
      try{payload=await read(day)}catch{return {kind:'empty',date,count:0,nextGameDate:null,searchComplete:false}}
      if(eventsForDay(payload,day).length)return {kind:'empty',date,count:0,nextGameDate:day,searchComplete:true};
    }
    return {kind:'empty',date,count:0,nextGameDate:null,searchComplete:true};
  }
  async function load(date,readJson,seed){
    const read=async day=>{
      if(day===date&&Array.isArray(seed?.events))return seed;
      const saved=cache.get(day);if(saved&&Date.now()-saved.at<15*60*1000)return saved.payload;
      const payload=await readJson('/api/espn-scoreboard?dates='+day.replaceAll('-','')+'&limit=1000');
      if(!Array.isArray(payload?.events))throw new Error('Schedule response unavailable');
      cache.set(day,{at:Date.now(),payload});return payload;
    };
    const fetchDays=async days=>Promise.all(days.map(async day=>{try{return {day,payload:await read(day)}}catch{return {day,payload:null}}}));
    let results=await fetchDays([date,addDate(date,1)]);
    const current=results.flatMap(x=>eventsForDay(x.payload,date));
    const count=new Set(current.map(x=>String(x.id))).size;
    if(count)return {kind:'games',date,count};
    if(results.some(x=>!x.payload))return {kind:'unavailable',date};
    for(let start=2;start<=15;start+=4){
      results.push(...await fetchDays(Array.from({length:Math.min(4,16-start)},(_,i)=>addDate(date,start+i))));
      const limit=Math.min(start+2,14);
      for(let offset=1;offset<=limit;offset++){
        const day=addDate(date,offset),slice=results.filter(x=>x.day===day||x.day===addDate(day,1));
        if(slice.length<2)continue;
        // An unavailable earlier day prevents claiming a later day is the next game.
        if(slice.some(x=>!x.payload))return {kind:'empty',date,count:0,nextGameDate:null,searchComplete:false};
        if(slice.some(x=>eventsForDay(x.payload,day).length))return {kind:'empty',date,count:0,nextGameDate:day,searchComplete:true};
      }
    }
    return {kind:'empty',date,count:0,nextGameDate:null,searchComplete:true};
  }
  root.FootyEdgeAvailability={uidLeague,leagueOf,eventDay,excludedTaggedEvent,excludedArchivedGame,eventsForDay,formatDate,message,load,loadNext};
})(globalThis);
