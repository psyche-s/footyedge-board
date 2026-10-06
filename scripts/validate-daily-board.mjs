import fs from "node:fs/promises";
const DATE=process.env.BOARD_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"})
  .formatToParts(new Date()).reduce((o,x)=>(o[x.type]=x.value,o),{});
const date=typeof DATE==="string"?DATE:`${DATE.year}-${DATE.month}-${DATE.day}`;
const read=async f=>JSON.parse(await fs.readFile(f,"utf8"));
const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const words=s=>String(s||"").trim().split(/\s+/).filter(Boolean).length;
const errors=[],warnings=[];
const fail=m=>errors.push(m),warn=m=>warnings.push(m);
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

  const fixtures=new Map((base.fixtures||[]).map(x=>[norm(x.home)+"|"+norm(x.away),x]));
  if(!fixtures.size)fail("Research base has no fixtures");

  const insightKeys=new Set();
  for(const item of insights.fixtures||[]){
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
    for(const s of item.sources||[]){
      if(!/^https:\/\//i.test(String(s.url||"")))fail("Invalid source URL for "+item.home+" vs "+item.away);
      const host=(()=>{try{return new URL(s.url).hostname}catch{return""}})();
      if(/footballwhispers\.com$/i.test(host)||/sportskeeda\.com$/i.test(host)){}
      else warn("Non-primary research source used: "+host+" for "+item.home+" vs "+item.away);
    }
  }

  const oddsKeys=new Set();
  for(const e of odds.events||[]){
    const k=norm(e.home)+"|"+norm(e.away);oddsKeys.add(k);
    const source=String(e.provider||e.mlBook?.name||"");
    const prices=[e.homeML,e.drawML,e.awayML,...Object.values(e.totals||{}).flatMap(t=>[t?.over,t?.under])].filter(v=>v!=null);
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
