(function(root){
  // ESPN competition identities are available even before sportsbook prices.
  const uidLeague={750:'jpn.1',700:'eng.1',3914:'eng.2',3946:'tur.1',21231:'ksa.1',740:'esp.1',730:'ita.1',720:'ger.1',710:'fra.1',725:'ned.1',715:'por.1',770:'usa.1',775:'uefa.champions',776:'uefa.europa',20296:'uefa.europa.conf',2310:'uefa.europa.conf',2395:'uefa.nations',3920:'eng.league_cup',3951:'esp.copa_del_rey',3957:'ned.cup',3922:'fifa.friendly',3923:'fifa.friendly',19267:'concacaf.nations.league',4:'fifa.world'};
  const tracked=new Set(['cze.1','jpn.1','kor.1','eng.1','eng.2','eng.league_cup','eng.fa_cup','ger.dfb_pokal','esp.copa_del_rey','ita.coppa_italia','fra.coupe_de_france','ned.cup','por.taca.portugal','sco.1','sco.tennents','sco.cis','tur.1','ksa.1','esp.1','ita.1','ger.1','fra.1','ned.1','por.1','usa.1','uefa.champions','uefa.europa','uefa.europa.conf','uefa.nations','uefa.euro','uefa.euroq','fifa.world','fifa.worldq.uefa','fifa.worldq.conmebol','fifa.worldq.concacaf','fifa.friendly','concacaf.nations.league','conmebol.copa_america']);
  const cache=new Map();
  function addDate(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
  function leagueOf(event){
    const o=event?.competitions?.[0]?.odds?.[0];
    const code=o?.moneyline?.home?.close?.link?.tracking?.tags?.league||o?.moneyline?.away?.close?.link?.tracking?.tags?.league||o?.total?.over?.close?.link?.tracking?.tags?.league||o?.pointSpread?.home?.close?.link?.tracking?.tags?.league;
    const id=String(event?.uid||'').match(/~l:(\d+)/)?.[1];
    return event?.footyedgeLeague||code||uidLeague[id]||null;
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
  function isExcludedSecondTier(id,name){
    const code=String(id||"").trim().toLowerCase();
    if(code==="eng.2")return false;
    if(/^[a-z]{2,8}\.2$/.test(code))return true;
    const title=String(name||"").trim().toLowerCase();
    if(/championship/.test(title)&&/(efl|english|england)/.test(title))return false;
    return /^(ita 2|ger 2|fra 2|esp 2|serie b|2\.? bundesliga|bundesliga 2|ligue 2|laliga 2|laliga hypermotion|segunda divisi[oó]n|serie bkt)$/.test(title);
  }
  function eventsForDay(payload,date){return (payload?.events||[]).filter(e=>tracked.has(leagueOf(e))&&!isExcludedSecondTier(leagueOf(e),e?.league?.name)&&eventDay(e)===date&&!excludedTaggedEvent(e)&&!/CANCEL/i.test(e.status?.type?.name||''))}
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
  root.FootyEdgeAvailability={isExcludedSecondTier,uidLeague,leagueOf,eventDay,excludedTaggedEvent,excludedArchivedGame,eventsForDay,formatDate,message,load,loadNext};
})(globalThis);
