(function(root){
  const esc=value=>String(value??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[x]));
  function todayToronto(now=new Date()){
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;
  }
  function monthDays(summary,today){
    return (summary.monthDays||summary.recentDays||[]).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.date||'')&&x.date.startsWith(today.slice(0,7))&&x.date<=today&&x.top5?.length).sort((a,b)=>b.date.localeCompare(a.date)).map(x=>({...x,top5:[...x.top5].sort((a,b)=>a.rank-b.rank).slice(0,5)}));
  }
  function stats(days){
    const picks=days.flatMap(x=>x.top5||[]),hits=picks.filter(x=>x.result==='hit').length,misses=picks.filter(x=>x.result==='miss').length;
    return {hits,misses,settled:hits+misses,hitRate:hits+misses?hits/(hits+misses)*100:null};
  }
  function scoreOnly(score){const m=String(score||'').match(/(\d+)\s*[-–:]\s*(\d+)/);return m?m[1]+'–'+m[2]:'—'}
  function dayLabel(date){return new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).toUpperCase()}
  function historyHtml(days){
    if(!days.length)return '<p class="empty">No official picks tracked this month yet.</p>';
    const labels={hit:'Hit',miss:'Miss',push:'Push',pending:'Pending'},marks={hit:'✓',miss:'✕',push:'—',pending:'•'};
    return days.map(day=>'<section class="day"><h2 class="date">'+esc(dayLabel(day.date))+'</h2><div class="card"><table class="results" aria-label="Top 5 results for '+esc(dayLabel(day.date))+'"><thead><tr><th scope="col">Result</th><th scope="col">Pick / Match</th><th scope="col">Score</th></tr></thead><tbody>'+day.top5.map((pick,i)=>{
      const result=Object.hasOwn(labels,pick.result)?pick.result:'pending';
      return '<tr><td><span class="mark '+result+'" role="img" aria-label="'+labels[result]+'"><span class="markGlyph">'+marks[result]+'</span></span></td><td><span class="selection">'+esc(pick.selection||'Pick')+'</span><span class="fixture">'+esc(pick.home||'')+' vs '+esc(pick.away||'')+'</span></td><td class="score">'+esc(scoreOnly(pick.finalScore))+'</td></tr>';
    }).join('')+'</tbody></table></div></section>').join('');
  }
  function render(summary,today=todayToronto()){
    const days=monthDays(summary,today),month=stats(days),year=summary.year?.key===today.slice(0,4)?summary.year:stats([]);
    const short=new Date(today+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',timeZone:'UTC'});
    document.getElementById('monthLabel').textContent=short+' Tracking';document.getElementById('yearLabel').textContent=today.slice(0,4)+' Tracking';
    for(const [prefix,period,suffix] of [['month',month,'this month'],['year',year,'YTD']]){
      document.getElementById(prefix+'Record').textContent=(period.hits||0)+'–'+(period.misses||0);
      document.getElementById(prefix+'Rate').textContent=period.hitRate==null?'No settled picks yet':Math.round(period.hitRate)+'% Hit Rate';
      document.getElementById(prefix+'Count').textContent=(period.settled||0)+' official picks tracked '+suffix;
    }
    document.getElementById('history').innerHTML=historyHtml(days);
  }
  async function load(){
    const path='data/performance/summary.json?v='+Date.now();let summary;
    for(const url of ['https://raw.githubusercontent.com/psyche-s/footyedge-board/main/'+path,'/'+path]){
      try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('Tracking unavailable');summary=await r.json();break}catch{}
    }
    if(summary){render(summary);return}
    for(const id of ['monthRate','yearRate'])document.getElementById(id).textContent='Tracking unavailable';
    document.getElementById('history').innerHTML='<p class="empty">Tracked results could not be loaded. Please try again.</p>';
  }
  root.FootyEdgeHitRate={todayToronto,monthDays,stats,scoreOnly,historyHtml,render};
  if(typeof document!=='undefined'&&document.getElementById('history'))load();
})(globalThis);
