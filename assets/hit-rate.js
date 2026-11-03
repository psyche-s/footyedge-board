(function(root){
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[x]));
 const leagues={'eng.1':'Premier League','esp.1':'La Liga','ita.1':'Serie A','ger.1':'Bundesliga','fra.1':'Ligue 1','por.1':'Liga Portugal','tur.1':'Süper Lig','eng.2':'Championship','ned.1':'Eredivisie','usa.1':'MLS','uefa.champions':'Champions League','uefa.europa':'Europa League','uefa.europa.conf':'Conference League'};
 const labels={hit:'Hit',miss:'Miss',push:'Void / push',pending:'Pending',unpriced:'Price pending'};
 const marks={hit:'✓',miss:'×',push:'—',pending:'•',unpriced:'•'};
 const resultOf=value=>Object.hasOwn(labels,value)?value:'pending';
 function todayToronto(now=new Date()){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;
 }
 function monthDays(summary,today){
  return (summary.monthDays||summary.recentDays||[]).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.date||'')&&x.date.startsWith(today.slice(0,7))&&x.date<=today&&x.top5?.length).sort((a,b)=>b.date.localeCompare(a.date)).map(x=>({...x,top5:[...x.top5].sort((a,b)=>a.rank-b.rank).slice(0,5)}));
 }
 function stats(days){
  const picks=days.flatMap(x=>x.top5||[]),hits=picks.filter(x=>x.result==='hit').length,misses=picks.filter(x=>x.result==='miss').length;
  return {hits,misses,pushes:picks.filter(x=>x.result==='push').length,pending:picks.filter(x=>!['hit','miss','push'].includes(x.result)).length,settled:hits+misses,hitRate:hits+misses?hits/(hits+misses)*100:null};
 }
 function scoreOnly(score){const m=String(score||'').match(/(\d+)\s*[-–:]\s*(\d+)/);return m?m[1]+'–'+m[2]:'—'}
 function dayLabel(date){return new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).toUpperCase()}
 function leagueName(league){return leagues[league]||''}
 function american(value){const n=Number(value);return value!=null&&Number.isFinite(n)&&Math.abs(n)>=100?(n>0?'+':'')+Math.round(n):null}
 function ticketTitle(ticket){return ticket.type==='acca'?'Matchday ACCA':(ticket.bestSgp?'Best SGP':leagueName(ticket.league)?leagueName(ticket.league)+' SGP':'Same-game parlay')}
 function markHtml(result){return '<span class="mark '+result+'" role="img" aria-label="'+labels[result]+'"><span class="markGlyph">'+marks[result]+'</span></span>'}
 function legValue(leg){
  if(leg.result==='push'&&leg.voidReason==='did_not_start')return {value:'Void',detail:'Did not start'};
  const label=String(leg.selection||leg.label||''),hasStat=typeof leg.observedStat==='number'&&Number.isFinite(leg.observedStat);
  if(hasStat)return {value:String(leg.observedStat),detail:leg.observedUnit||label.match(/\d+\+\s+(Shots? on Target|Shots?|Fouls Committed|Fouls Won|Tackles?|Cards?|Goals?|Assists?)$/i)?.[1]||'Recorded'};
  // Match scores describe result markets only. They are never a substitute
  // for tackles, shots, corners, a half's goals, or another event count.
  const score=scoreOnly(leg.finalScore),scoreMarket=/\bML$|\bor Draw$|\bHandicap$|\bBTTS\b/i.test(label);
  const goals=score.match(/^(\d+)–(\d+)$/);
  if(goals&&/^(Over|Under)\s+\d+(?:\.\d+)?\s+Goals?$/i.test(label))return {value:String(Number(goals[1])+Number(goals[2])),detail:'Goals'};
  const teamGoal=label.match(/^(.*?)\s+(?:\d+\+\s+Goals?|(Over|Under)\s+\d+(?:\.\d+)?\s+Team Goals?)$/i),teams=leg.home&&leg.away?[leg.home,leg.away]:String(leg.fixture||'').split(' vs ');
  if(goals&&teamGoal&&teams.length===2){const side=teams.findIndex(t=>t.toLowerCase()===teamGoal[1].toLowerCase());if(side>=0)return {value:goals[side+1],detail:'Team goals'};}
  if(scoreMarket&&score!=='—')return {value:score,detail:'Final'};
  return {value:'—',detail:leg.result==='push'?'Void / push':leg.finalScore?'Awaiting stat':'Pending'};
 }
 function legHtml(leg,top5=false){
  const result=resultOf(leg.result),fixture=top5?[leg.home,leg.away].filter(Boolean).join(' vs '):leg.fixture||'',league=leagueName(leg.league);
  const {value,detail}=legValue(leg);
  return '<li class="trackedLeg">'+markHtml(result)+'<div class="legCopy"><h4>'+esc(leg.selection||leg.label||'Pick')+'</h4><p>'+(league?'<span class="legLeague">'+esc(league)+'</span><span class="metaSep"> · </span>':'')+esc(fixture)+'</p></div><div class="resultValue"><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small></div></li>';
 }
 function top5Card(day){
  if(!day.top5?.length)return '';
  const s=stats([day]),pending=s.pending||0,tag=pending?'In progress':'Settled';
  const footer=s.hits+' hit · '+s.misses+' miss'+(s.pushes?' · '+s.pushes+' void':'')+(pending?' · '+pending+' pending':'');
  return '<article class="trackedTicket top5Ticket" data-ticket-title="Top 5 picks" aria-label="Top 5 picks for '+esc(dayLabel(day.date))+'"><header class="ticketHeader"><div class="ticketTopline"><span class="ticketKicker">THE DAILY FIVE</span><span class="ticketStatus '+(pending?'pending':'neutral')+'">'+tag+'</span></div><h3>Top 5 picks</h3><p>Five individual selections. Every result recorded.</p></header><ol class="trackedLegs">'+day.top5.map(p=>legHtml(p,true)).join('')+'</ol><footer class="ticketFooter"><span>'+esc(footer)+'</span><strong>'+(s.hitRate==null?'Awaiting results':Math.round(s.hitRate)+'% Hit Rate')+'</strong></footer></article>';
 }
 function slipCard(ticket,date){
  const research=ticket.trackable===false,grade=resultOf(ticket.result),result=research&&grade==='pending'?'unpriced':grade,s=stats([{top5:ticket.legs||[]}]);
  const status={hit:'LANDED',miss:'DIDN’T LAND',push:'VOID / PUSH',pending:'PENDING',unpriced:'PRICE PENDING'}[result];
  const title=ticketTitle(ticket),fixture=ticket.type==='acca'?'Selections across '+new Set((ticket.legs||[]).map(l=>l.gameId||l.fixture)).size+' different fixtures':ticket.legs?.[0]?.fixture||'Published match selections';
  const price=american(ticket.combinedReferenceAmerican),priceText=research?'Research only':price?price+' reference':(ticket.legs||[]).length+' legs';
  const counts=s.hits+' hit · '+s.misses+' miss'+(s.pushes?' · '+s.pushes+' void':'')+(s.pending?' · '+s.pending+' pending':'');
  const foot=research?(result==='unpriced'?'':counts+' · ')+'Not included in the slip hit rate':counts;
  return '<article class="trackedTicket '+result+'Ticket" data-ticket-title="'+esc(title)+'" aria-label="'+esc(title+' for '+dayLabel(date))+'"><header class="ticketHeader"><div class="ticketTopline"><span class="ticketKicker">'+(ticket.type==='acca'?'ACROSS THE SLATE':'MATCHDAY SGP')+'</span><span class="ticketStatus '+result+'">'+status+'</span></div><h3>'+esc(title)+'</h3><p>'+esc(fixture)+'</p></header><ol class="trackedLegs">'+(ticket.legs||[]).map(l=>legHtml(l)).join('')+'</ol><footer class="ticketFooter"><span>'+esc(foot)+'</span><strong class="ticketPrice">'+esc(priceText)+'</strong></footer></article>';
 }
 function historyHtml(days){
  if(!days.length)return '<p class="empty">No official picks tracked this month yet.</p>';
  return days.map(day=>{
   const tickets=(day.tickets||[]).filter(t=>!t.duplicateOf),cards=[...(day.top5?.length?[{title:'Top 5 picks',html:top5Card(day)}]:[]),...tickets.map(t=>({title:ticketTitle(t),html:slipCard(t,day.date)}))];
   if(!cards.length)return '';
   const id='tracking-'+day.date;
   return '<section class="day dayCarousel" data-tracking-day="'+esc(day.date)+'" aria-roledescription="carousel" aria-label="'+esc(dayLabel(day.date))+' daily record"><div class="dayHeading"><h2 class="date">'+esc(dayLabel(day.date))+'</h2><span class="dayCardCount">'+cards.length+' '+(cards.length===1?'card':'cards')+'</span><div class="railArrows"><button type="button" class="railArrow" data-step="-1" aria-label="Previous card for '+esc(dayLabel(day.date))+'" aria-controls="'+id+'" disabled>‹</button><button type="button" class="railArrow" data-step="1" aria-label="Next card for '+esc(dayLabel(day.date))+'" aria-controls="'+id+'"'+(cards.length===1?' disabled':'')+'>›</button></div></div><div class="ticketRail" id="'+id+'" tabindex="0" aria-label="Swipe through '+esc(dayLabel(day.date))+' picks and slips">'+cards.map(c=>c.html).join('')+'</div><div class="railPagination"><div class="railDots" role="group" aria-label="Choose a tracking card">'+cards.map((c,i)=>'<button type="button" class="railDot'+(i===0?' active':'')+'" data-slide="'+i+'" aria-label="Show '+esc(c.title)+' for '+esc(dayLabel(day.date))+'" aria-current="'+(i===0?'true':'false')+'" aria-controls="'+id+'"></button>').join('')+'</div><span class="railPosition" aria-live="polite">1 / '+cards.length+'</span></div></section>';
  }).join('');
 }
 function trackingDays(history,summary,today){
  if(history?.schema!=='footyedge-tracking-history-v1')return monthDays(summary,today);
  return (history.days||[]).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d.date||'')&&d.date.startsWith(today.slice(0,7))&&d.date<=today&&(d.top5?.length||d.tickets?.length)).sort((a,b)=>b.date.localeCompare(a.date));
 }
 function bindCarousels(){
  const host=document.getElementById('history');if(!host?.querySelectorAll)return;
  for(const group of host.querySelectorAll('.dayCarousel')){
   const rail=group.querySelector('.ticketRail'),cards=[...rail.children],dots=[...group.querySelectorAll('.railDot')],previous=group.querySelector('[data-step="-1"]'),next=group.querySelector('[data-step="1"]');
   let index=0;
   const position=()=>{
    const max=rail.scrollWidth-rail.clientWidth;
    if(max>1&&rail.scrollLeft>=max-3)index=cards.length-1;
    else index=cards.reduce((best,c,i)=>Math.abs(c.offsetLeft-cards[0].offsetLeft-rail.scrollLeft)<Math.abs(cards[best].offsetLeft-cards[0].offsetLeft-rail.scrollLeft)?i:best,0);
    dots.forEach((d,i)=>{d.classList.toggle('active',i===index);d.setAttribute('aria-current',i===index?'true':'false')});
    previous.disabled=index===0;next.disabled=index===cards.length-1;
    group.querySelector('.railPosition').textContent=(index+1)+' / '+cards.length;
   };
   const go=i=>{const target=Math.max(0,Math.min(cards.length-1,i));rail.scrollTo({left:cards[target].offsetLeft-cards[0].offsetLeft,behavior:root.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})};
   previous.addEventListener('click',()=>go(index-1));next.addEventListener('click',()=>go(index+1));dots.forEach((d,i)=>d.addEventListener('click',()=>go(i)));
   rail.addEventListener('scroll',position,{passive:true});rail.addEventListener('keydown',event=>{if(event.target!==rail)return;if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){event.preventDefault();go(event.key==='Home'?0:event.key==='End'?cards.length-1:index+(event.key==='ArrowRight'?1:-1));}});
   position();
  }
 }
 function render(summary,today=todayToronto(),history=null){
  const days=trackingDays(history,summary,today),month=stats(days),year=history?.top5?.year?.key===today.slice(0,4)?history.top5.year:summary.year?.key===today.slice(0,4)?summary.year:stats([]);
  const short=new Date(today+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',timeZone:'UTC'});
  document.getElementById('monthLabel').textContent=short+' Tracking';document.getElementById('yearLabel').textContent=today.slice(0,4)+' Tracking';
  for(const [prefix,period,suffix] of [['month',month,'this month'],['year',year,'YTD']]){
   document.getElementById(prefix+'Record').textContent=(period.hits||0)+'–'+(period.misses||0);
   document.getElementById(prefix+'Rate').textContent=period.hitRate==null?'No settled picks yet':Math.round(period.hitRate)+'% Hit Rate';
   document.getElementById(prefix+'Count').textContent=(period.settled||0)+' Top 5 picks settled '+suffix+(period.pending?' · '+period.pending+' pending':'');
  }
  const slipStats=history?.slips||summary.slips||{};
  for(const [prefix,label,key,period] of [['slipMonth',short+' slips',today.slice(0,7),slipStats.month],['slipYear',today.slice(0,4)+' slips',today.slice(0,4),slipStats.year]]){
   const p=period?.key===key?period:{hits:0,misses:0,pending:0,hitRate:null};
   const labelNode=document.getElementById(prefix+'Label'),recordNode=document.getElementById(prefix+'Record'),rateNode=document.getElementById(prefix+'Rate');
   if(labelNode)labelNode.textContent=label;if(recordNode)recordNode.textContent=(p.hits||0)+'–'+(p.misses||0);
   if(rateNode)rateNode.textContent=(p.hitRate==null?'Awaiting results':Math.round(p.hitRate)+'% Hit Rate')+(p.pending?' · '+p.pending+' pending':'');
  }
  document.getElementById('history').innerHTML=historyHtml(days);bindCarousels();
 }
 async function readData(path){
  for(const base of ['/', 'https://raw.githubusercontent.com/psyche-s/footyedge-board/main/']){
   try{const r=await fetch(base+path+'?v='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(9000)});if(r.ok)return await r.json();}catch{}
  }
  return null;
 }
 async function load(){
  const [summary,history]=await Promise.all([readData('data/performance/summary.json'),readData('data/performance/history.json')]);
  if(summary||history){render(summary||{},todayToronto(),history);return}
  for(const id of ['monthRate','yearRate','slipMonthRate','slipYearRate'])document.getElementById(id).textContent='Tracking unavailable';
  document.getElementById('history').innerHTML='<p class="empty">Tracked results could not be loaded. Please try again.</p>';
 }
 root.FootyEdgeHitRate={todayToronto,monthDays,stats,scoreOnly,dayLabel,historyHtml,trackingDays,render,top5Card,slipCard,legValue};
 if(typeof document!=='undefined'&&document.getElementById('history'))load();
})(globalThis);
