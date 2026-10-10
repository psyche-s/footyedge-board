import fs from "node:fs/promises";
const DATE=process.env.BOARD_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"})
  .formatToParts(new Date()).reduce((o,x)=>(o[x.type]=x.value,o),{});
const date=typeof DATE==="string"?DATE:`${DATE.year}-${DATE.month}-${DATE.day}`;
const read=async f=>JSON.parse(await fs.readFile(f,"utf8"));
const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const words=s=>String(s||"").trim().split(/\s+/).filter(Boolean).length;
const errors=[],warnings=[];
const fail=m=>errors.push(m),warn=m=>warnings.push(m);
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

  const [base,insights,odds]=await Promise.all([read(baseFile),read(insightsFile),read(oddsFile)]);
  if(base.date!==date)fail("Research base date mismatch");
  if(insights.date!==date)fail("Daily insights date mismatch");
  if(odds.date!==date)fail("Daily odds date mismatch");
  if(insights.status&&!['ready','ready-with-passes'].includes(insights.status))fail("Research/team-news review is not ready for publication");
  if(odds.status==="blocked")fail("Verified native sportsbook odds are not ready for publication");

  const insightRows=insights.fixtures||[];
  const insightByKey=new Map(insightRows.map(x=>[norm(x.home)+"|"+norm(x.away),x]));
  const fixtures=new Map((base.fixtures||[]).map(x=>[norm(x.home?.name||x.home)+"|"+norm(x.away?.name||x.away),x]));
  if(!fixtures.size)fail("Research base has no fixtures");
  for(const [k,f] of fixtures)if(Number(f.history?.home)<10||Number(f.history?.away)<10){
    const review=insightByKey.get(k);
    if(review?.reviewStatus!=="pass-insufficient-data")fail("Incomplete all-competition last-10 history without an explicit PASS: "+(f.home?.name||f.home)+" vs "+(f.away?.name||f.away));
  }

  const insightKeys=new Set();
  for(const item of insightRows){
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
    if(item.reviewStatus&&!['ready','pass-insufficient-data'].includes(item.reviewStatus))fail("Fixture review is not ready: "+item.home+" vs "+item.away);
    if(item.reviewStatus==='pass-insufficient-data'&&((item.supportedMarkets||[]).length||(item.markets||[]).length))fail("PASS fixture cannot publish a supported market: "+item.home+" vs "+item.away);
    if(!['reviewed','blocked-provider-failure'].includes(item.teamNewsReview?.status))fail("Team-news review is incomplete: "+item.home+" vs "+item.away);
    if(item.reviewStatus==='ready'&&item.teamNewsReview?.status!=="reviewed")fail("Published fixture lacks a completed team-news review: "+item.home+" vs "+item.away);
    const sources=item.sources||[];
    for(const s of sources){
      if(!/^https:\/\//i.test(String(s.url||"")))fail("Invalid source URL for "+item.home+" vs "+item.away);
      const host=(()=>{try{return new URL(s.url).hostname}catch{return""}})();
      if(/footballwhispers\.com$/i.test(host)||/sportskeeda\.com$/i.test(host)){}
      else warn("Non-primary research source used: "+host+" for "+item.home+" vs "+item.away);
      if(s.checkedAt){
        const age=Math.abs(Date.now()-new Date(s.checkedAt).getTime());
        if(!Number.isFinite(age)||age>48*3600000)fail("Research source check is older than 48h: "+item.home+" vs "+item.away+" :: "+host);
      }else fail("Research source lacks checkedAt: "+item.home+" vs "+item.away+" :: "+host);
    }
    const baseFixture=fixtures.get(k);
    if((item.supportedMarkets||[]).length&&!sources.length)fail("Supported market has no external source: "+item.home+" vs "+item.away);
    for(const market of item.supportedMarkets||[]){
      if(!marketSupportFromFacts(market,baseFixture?.facts||[],{home:item.home,away:item.away})){
        fail("Supported market lacks matching deterministic evidence: "+item.home+" vs "+item.away+" :: "+market);
      }
    }
    for(const news of item.teamNews||[]){
      if(!news?.text||!["confirmed","doubtful","projected","unknown"].includes(news.status)||news.fixtureDate!==date)fail("Team-news claim lacks current status/date: "+item.home+" vs "+item.away);
      if(!(news.sources||[]).length)fail("Team-news claim lacks sources: "+item.home+" vs "+item.away);
      if(news.status!=="confirmed"&&/\b(will miss|ruled out|definitely|certainly)\b/i.test(String(news.text||"")+" "+String(news.impact||"")))fail("Uncertain team news is overstated: "+item.home+" vs "+item.away);
      if(news.modelImpact&&(!news.modelImpact.role||!news.modelImpact.importance||!news.modelImpact.replacement||!news.modelImpact.evidence))fail("Team-news model adjustment lacks role/replacement evidence: "+item.home+" vs "+item.away);
    }
    for(const market of item.markets||[]){
      const d=Number(market?.decimal);
      if(!market?.label||!market?.price||!Number.isFinite(d)||d<=1)fail("Research market lacks verified native price metadata: "+item.home+" vs "+item.away+" :: "+String(market?.label||""));
      if(d<1.20)fail("Research market is worse than the -500 floor: "+item.home+" vs "+item.away+" :: "+String(market?.label||""));
      if(!market?.source||!market?.reason)fail("Research market lacks source/reason: "+item.home+" vs "+item.away+" :: "+String(market?.label||""));
      if(market.category==="Player"){const n=market.playerNews;if(!n||n.expectedStart!==true||Number(n.expectedMinutes)<60||n.status!=="expected"||n.rotationRisk||n.injuryRisk||!(n.sources||[]).length)fail("Player prop lacks credible expected-start/minutes evidence: "+String(market.label||""));}
    }
  }

  for(const k of fixtures.keys())if(!insightKeys.has(k))fail("Tracked fixture lacks current research/team-news review: "+k);
  if(fixtures.size&&!(odds.events||[]).length)fail("No verified native sportsbook odds available for the tracked slate");

  const oddsKeys=new Set();
  for(const e of odds.events||[]){
    const k=norm(e.home)+"|"+norm(e.away);oddsKeys.add(k);
    const source=String(e.provider||e.mlBook?.name||"");
    const prices=[e.homeML,e.drawML,e.awayML,...Object.values(e.totals||{}).flatMap(t=>[t?.over,t?.under]),...(e.spreads||[]).flatMap(s=>[s?.home,s?.away])].filter(v=>v!=null);
    for(const p of prices){
      const n=Number(String(p).replace("+",""));if(!Number.isFinite(n))fail("Invalid odds value for "+e.home+" vs "+e.away+": "+p);
    }
    if(prices.length&&!source&&!Object.values(e.totals||{}).some(t=>t?.book?.name))warn("Odds present without explicit book metadata: "+e.home+" vs "+e.away);
  }
  for(const k of fixtures.keys())if(!oddsKeys.has(k))warn("No odds event entry for tracked fixture: "+k);

  console.log(JSON.stringify({date,fixtures:fixtures.size,insightFixtures:insightKeys.size,oddsEvents:(odds.events||[]).length,warnings},null,2));
  if(errors.length)throw new Error(errors.join("\n"));
}
main().catch(e=>{console.error("BOARD VALIDATION FAILED\n"+e.message);process.exit(1)});
