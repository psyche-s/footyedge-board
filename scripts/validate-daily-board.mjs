import fs from "node:fs/promises";
const DATE=process.env.BOARD_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"})
  .formatToParts(new Date()).reduce((o,x)=>(o[x.type]=x.value,o),{});
const date=typeof DATE==="string"?DATE:`${DATE.year}-${DATE.month}-${DATE.day}`;
const read=async f=>JSON.parse(await fs.readFile(f,"utf8"));
const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const words=s=>String(s||"").trim().split(/\s+/).filter(Boolean).length;
const errors=[],warnings=[];
const fail=m=>errors.push(m),warn=m=>warnings.push(m);
const womenText=v=>/(^|[^a-z])(women|womens|women's|female|feminine|femminile|frauen|nwsl|uwcl|wsl)([^a-z]|$)|(^|[^a-z])liga\s+f([^a-z]|$)|(^|[^a-z])d1f([^a-z]|$)/i.test(String(v||""));
const fixtureWomen=x=>womenText([x?.home?.name||x?.home,x?.away?.name||x?.away,x?.league,x?.competition,x?.season?.slug].join(" "));
function marketSupportFromFacts(market,facts,fixture){
  const m=norm(market),tags=new Set();
  for(const f of facts||[])for(const t of (typeof f==="string"?[]:(f.tags||[])))tags.add(norm(t));
  if(m.includes("under"))return tags.has("under");
  if(m.includes("over"))return tags.has("over");
  if(m.includes("btts")){
    if(m.includes("no"))return tags.has("btts")||tags.has("defense")||tags.has("team goals")||tags.has("under");
    return tags.has("btts");
  }
  if(m.includes("draw")||m.includes("ml")){
    const team=m.includes(norm(fixture.home))?norm(fixture.home):m.includes(norm(fixture.away))?norm(fixture.away):"";
    if(!team)return tags.has("result");
    return (facts||[]).some(f=>{
      const text=norm(typeof f==="string"?f:f?.text);
      const ftags=(typeof f==="string"?[]:(f.tags||[])).map(norm);
      return text.includes(team)&&ftags.includes("result");
    });
  }
  if(m.includes("goal")){
    const team=m.includes(norm(fixture.home))?norm(fixture.home):m.includes(norm(fixture.away))?norm(fixture.away):"";
    return tags.has("team goals")||Boolean(team&&(facts||[]).some(f=>norm(typeof f==="string"?f:f?.text).includes(team)));
  }
  return false
}

async function exists(f){try{await fs.access(f);return true}catch{return false}}

async function main(){
  const baseFile=`data/research-base-${date}.json`,insightsFile=`data/daily-insights-${date}.json`,oddsFile=`data/daily-odds-${date}.json`;
  if(!await exists(baseFile))fail("Missing "+baseFile);
  if(!await exists(insightsFile))fail("Missing "+insightsFile);
  if(!await exists(oddsFile))fail("Missing "+oddsFile);
  if(errors.length)throw new Error(errors.join("\n"));

  const [base,insights,odds,readiness]=await Promise.all([read(baseFile),read(insightsFile),read(oddsFile),read("data/board-readiness.json").catch(()=>null)]);
  if(base.date!==date)fail("Research base date mismatch");
  if(insights.date!==date)fail("Daily insights date mismatch");
  if(odds.date!==date)fail("Daily odds date mismatch");

  for(const x of base.fixtures||[])if(fixtureWomen(x))fail("Women's fixture reached research base: "+(x.home?.name||x.home)+" vs "+(x.away?.name||x.away));
  const fixtures=new Map((base.fixtures||[]).map(x=>[norm(x.home?.name||x.home)+"|"+norm(x.away?.name||x.away),x]));
  const verifiedEmpty=readiness?.today?.date===date&&readiness?.today?.providerStatus==="verified"&&readiness?.today?.scheduledMensGames===0;
  if(!fixtures.size&&!verifiedEmpty)fail("Research base has no fixtures and the men's schedule is not verified empty");
  if(verifiedEmpty&&(!/No games today/i.test(readiness?.today?.emptyState||"")||!readiness?.today?.nextMensGameDate))fail("Verified empty slate must resolve to No games today plus a confirmed next men's date");

  const insightKeys=new Set();
  for(const item of insights.fixtures||[]){
    if(fixtureWomen(item))fail("Women's fixture reached daily insights: "+item.home+" vs "+item.away);
    const k=norm(item.home)+"|"+norm(item.away);
    if(insightKeys.has(k))fail("Duplicate insight fixture: "+item.home+" vs "+item.away);
    insightKeys.add(k);
    if(!fixtures.has(k))fail("Insight fixture not on tracked slate: "+item.home+" vs "+item.away);
    if((item.facts||[]).length>5)fail("Too many facts: "+item.home+" vs "+item.away);
    if((item.supportedMarkets||[]).length>3)fail("Too many supported markets: "+item.home+" vs "+item.away);
    const seen=new Set();
    for(const f of item.facts||[]){
      const text=typeof f==="string"?f:f?.text;
      if(!text)fail("Blank fact: "+item.home+" vs "+item.away);
      if(words(text)>30)fail("Fact too long (>30 words): "+item.home+" vs "+item.away+" :: "+text);
      const nk=norm(text);if(seen.has(nk))fail("Duplicate fact: "+text);seen.add(nk);
    }
    const sources=item.sources||[];
    for(const s of sources){
      if(!/^https:\/\//i.test(String(s.url||"")))fail("Invalid source URL for "+item.home+" vs "+item.away);
      const host=(()=>{try{return new URL(s.url).hostname}catch{return""}})();
      if(/footballwhispers\.com$/i.test(host)||/sportskeeda\.com$/i.test(host)){}
      else warn("Non-primary research source used: "+host+" for "+item.home+" vs "+item.away);
      if(s.checkedAt){
        const age=Math.abs(Date.now()-new Date(s.checkedAt).getTime());
        if(!Number.isFinite(age)||age>48*3600000)warn("Research source check is older than 48h: "+item.home+" vs "+item.away+" :: "+host);
      }
    }
    const baseFixture=fixtures.get(k);
    if((item.supportedMarkets||[]).length&&!sources.length)fail("Supported market has no external source: "+item.home+" vs "+item.away);
    for(const market of item.supportedMarkets||[]){
      if(!marketSupportFromFacts(market,baseFixture?.facts||[],{home:item.home,away:item.away})){
        fail("Supported market lacks matching deterministic evidence: "+item.home+" vs "+item.away+" :: "+market);
      }
    }
    for(const market of item.markets||[]){
      const d=Number(market?.decimal);
      if(!market?.label||!market?.price||!Number.isFinite(d)||d<=1)fail("Research market lacks verified native price metadata: "+item.home+" vs "+item.away+" :: "+String(market?.label||""));
      if(d<1.25)fail("Research market is worse than the -400 floor: "+item.home+" vs "+item.away+" :: "+String(market?.label||""));
      if(!market?.source||!market?.reason)fail("Research market lacks source/reason: "+item.home+" vs "+item.away+" :: "+String(market?.label||""));
      if(norm(market?.category)==="player"&&Number(market?.confidence)>=80){
        const start=norm(market?.expectedStart||market?.startStatus),minutes=Number(market?.expectedMinutes),book=norm(market?.bookmaker||market?.sportsbook||market?.priceSource);
        if(!/confirmed|expected|probable/.test(start)||!Number.isFinite(minutes)||minutes<60)fail("Player prop fails expected-start/minutes gate: "+item.home+" vs "+item.away+" :: "+market.label);
        if(market?.priceVerified!==true||!/^https:\/\//i.test(String(market?.priceSourceUrl||market?.sourceUrl||""))||!/draftkings|fan duel|fanduel|espn bet|bet365|betmgm|caesars|pointsbet|betway/.test(book))fail("Player prop lacks verified native sportsbook price: "+item.home+" vs "+item.away+" :: "+market.label);
      }
    }
    for(const news of item.teamNews||[]){
      if(!news?.text||!news?.status||!/^https:\/\//i.test(String(news?.sourceUrl||"")))fail("Team-news item lacks text/status/current source: "+item.home+" vs "+item.away);
      if(news.status==="uncertain"&&!/doubt|question|uncertain|expected|reported|monitor/i.test(String(news.text)))fail("Uncertain team news is stated too strongly: "+item.home+" vs "+item.away+" :: "+news.text);
    }
    for(const check of item.teamNewsChecks||[])if(!/^https:\/\//i.test(String(check?.url||""))||!check?.checkedAt)fail("Team-news verification check lacks URL/timestamp: "+item.home+" vs "+item.away);
    if(item.primaryPick){
      if(!item.whyThisPick||!(item.whyThisPick.facts||[]).length||(item.whyThisPick.facts||[]).length>3)fail("Pick #1 requires 1-3 Why this pick facts: "+item.home+" vs "+item.away);
      if(!marketSupportFromFacts(item.primaryPick.label,baseFixture?.facts||[],{home:item.home,away:item.away}))fail("Pick #1 Why this pick evidence does not match its market: "+item.home+" vs "+item.away+" :: "+item.primaryPick.label);
    }
  }

  const oddsKeys=new Set();
  for(const e of odds.events||[]){
    if(fixtureWomen(e))fail("Women's fixture reached daily odds: "+e.home+" vs "+e.away);
    const k=norm(e.home)+"|"+norm(e.away);oddsKeys.add(k);
    const source=String(e.provider||e.mlBook?.name||"");
    const prices=[e.homeML,e.drawML,e.awayML,...Object.values(e.totals||{}).flatMap(t=>[t?.over,t?.under]),...(e.spreads||[]).flatMap(s=>[s?.home,s?.away])].filter(v=>v!=null);
    for(const p of prices){
      const n=Number(String(p).replace("+",""));if(!Number.isFinite(n))fail("Invalid odds value for "+e.home+" vs "+e.away+": "+p);
    }
    if(prices.length&&!source&&!Object.values(e.totals||{}).some(t=>t?.book?.name))warn("Odds present without explicit book metadata: "+e.home+" vs "+e.away);
  }
  for(const k of fixtures.keys())if(!oddsKeys.has(k))warn("No odds event entry for tracked fixture: "+k);

  const dataFiles=await fs.readdir("data");
  for(const name of dataFiles){
    const m=name.match(/^(?:daily-insights|daily-odds|research-base)-(\d{4}-\d{2}-\d{2})\.json$/);
    if(m&&m[1]>date)fail("Future-day betting/research artifact is prohibited: data/"+name);
  }
  const boardFile=`data/boards/${date}.json`;
  if(await exists(boardFile)){
    const board=await read(boardFile);if(board.date!==date)fail("Published board date mismatch");
    for(const g of board.games||[])if(fixtureWomen(g))fail("Women's fixture reached published board: "+g.home+" vs "+g.away);
  }

  for(const name of (await fs.readdir("data/boards")).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x)&&x.slice(0,10)<date)){
    const day=name.slice(0,10),board=await read("data/boards/"+name),postFile="data/postmortems/"+name;
    if(!await exists(postFile)){fail("Missing historical Top 3 postmortem: "+day);continue}
    const post=await read(postFile),keys=new Set((post.reviews||[]).map(r=>norm(r.home)+"|"+norm(r.away)+"|"+Number(r.rank||1)+"|"+norm(r.selection)));
    for(const g of board.games||[])for(const [i,p] of (g.top3||[]).entries()){
      const k=norm(g.home)+"|"+norm(g.away)+"|"+(i+1)+"|"+norm(p.label);
      if(!keys.has(k))fail(`Missing saved Top 3 review: ${day} ${g.home} vs ${g.away} Pick #${i+1}`);
    }
  }

  const [ui1,ui2]=await Promise.all([fs.readFile("ui/part1.html","utf8"),fs.readFile("ui/part2.html","utf8")]);
  if(!/class="searchBar" id="searchBar"/.test(ui1)||!/\.searchBar\{display:flex/.test(ui1)||!/renderBest\(\);renderGames\(\)/.test(ui2))fail("Compact game search is missing or does not update both Top Picks and games");
  if(!/why=i===0\?researchHtml/.test(ui2)||!/WHY THIS PICK/.test(ui2))fail("Why this pick is not positioned directly under Pick #1");
  if(!/\.clubCrest\{[\s\S]*?border-radius:0!important/.test(ui1)||!/\.countryFlag\{[\s\S]*?border-radius:50%!important/.test(ui1))fail("Club/country logo treatments are not separated");
  for(const league of ['"ita.1"','"ger.1"','"fra.1"'])if(!ui2.includes(league+':"https://'))fail("Missing league filter logo asset: "+league);
  if(!/\.gameTop \{?[\s\S]*?overflow:hidden!important/.test(ui1)||!/\.gameTop \.leagueLogoImg\{[\s\S]*?object-fit:contain!important/.test(ui1))fail("League header logo containment is missing");
  const availability=await fs.readFile("assets/board-availability.js","utf8");
  if(!/function isWomensEvent/.test(availability)||!/!isWomensEvent\(e\)/.test(availability)||!/FootyEdgeAvailability\.isWomensEvent\(e\)/.test(ui2))fail("Men's-only filter is not enforced before schedule/model processing");

  console.log(JSON.stringify({date,fixtures:fixtures.size,insightFixtures:insightKeys.size,oddsEvents:(odds.events||[]).length,warnings},null,2));
  if(errors.length)throw new Error(errors.join("\n"));
}
main().catch(e=>{console.error("BOARD VALIDATION FAILED\n"+e.message);process.exit(1)});
