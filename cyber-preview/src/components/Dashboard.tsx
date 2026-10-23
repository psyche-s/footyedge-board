"use client";

import {useMemo, useState} from "react";
import {Activity, ArrowUpRight, BarChart3, CalendarDays, ChevronRight, CircleDot, Clock3, Layers2, Search, ShieldCheck, SlidersHorizontal, Target, Zap} from "lucide-react";
import MatchStatsCard from "./MatchStatsCard";
import TacticalLineup from "./TacticalLineup";
import {leagueStyles} from "@/lib/theme";
import type {DashboardData, LeagueId, LineupData, MatchData} from "@/lib/types";

const sample433Lineup: LineupData = {
  teamName: "Arsenal · example",
  accentColor: "#ef0107",
  formation: "4-3-3",
  confirmed: false,
  sourceLabel: "User-provided illustrative formation",
  players: [
    {id:"raya",name:"David Raya",number:22,role:"Goalkeeper",xT:0.012,recoveries:6,foulsCommitted:0,shotsOnTarget:0,positionGrid:{top:"88%",left:"50%"}},
    {id:"white",name:"Ben White",number:4,role:"Right Back",xT:0.084,recoveries:5,foulsCommitted:1,shotsOnTarget:0,positionGrid:{top:"68%",left:"85%"}},
    {id:"saliba",name:"William Saliba",number:2,role:"Center Back",xT:0.031,recoveries:9,foulsCommitted:0,shotsOnTarget:1,positionGrid:{top:"72%",left:"60%"}},
    {id:"gabriel",name:"Gabriel Magalhães",number:6,role:"Center Back",xT:0.024,recoveries:8,foulsCommitted:2,shotsOnTarget:1,positionGrid:{top:"72%",left:"40%"}},
    {id:"timber",name:"Jurriën Timber",number:12,role:"Left Back",xT:0.071,recoveries:4,foulsCommitted:1,shotsOnTarget:0,positionGrid:{top:"68%",left:"15%"}},
    {id:"partey",name:"Thomas Partey",number:5,role:"Defensive Mid",xT:0.095,recoveries:11,foulsCommitted:3,shotsOnTarget:0,positionGrid:{top:"48%",left:"50%"}},
    {id:"rice",name:"Declan Rice",number:41,role:"Central Mid",xT:0.142,recoveries:7,foulsCommitted:1,shotsOnTarget:1,positionGrid:{top:"40%",left:"28%"}},
    {id:"odegaard",name:"Martin Ødegaard",number:8,role:"Attacking Mid",xT:0.285,recoveries:4,foulsCommitted:0,shotsOnTarget:2,positionGrid:{top:"40%",left:"72%"}},
    {id:"saka",name:"Bukayo Saka",number:7,role:"Right Winger",xT:0.341,recoveries:3,foulsCommitted:1,shotsOnTarget:3,positionGrid:{top:"18%",left:"80%"}},
    {id:"havertz",name:"Kai Havertz",number:29,role:"Center Forward",xT:0.112,recoveries:5,foulsCommitted:2,shotsOnTarget:2,positionGrid:{top:"14%",left:"50%"}},
    {id:"martinelli",name:"Gabriel Martinelli",number:11,role:"Left Winger",xT:0.218,recoveries:2,foulsCommitted:0,shotsOnTarget:1,positionGrid:{top:"18%",left:"20%"}}
  ]
};

function prettyDate(date: string) {
  const d = new Date(date + "T12:00:00Z");
  return Number.isNaN(d.valueOf()) ? date : new Intl.DateTimeFormat("en-CA",{weekday:"short",month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(d);
}
function number(value: number | null | undefined, digits = 1) {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}
function Metric({label,value,sub,accent=false}: {label:string;value:string;sub:string;accent?:boolean}) {
  return <div className="min-w-0 rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-3.5">
    <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
    <div className={"mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight " + (accent?"text-emerald-400":"text-zinc-100")}>{value}</div>
    <div className="mt-1 truncate text-[10px] text-zinc-600">{sub}</div>
  </div>;
}
function Form({list}: {list:string[]}) {
  if (!list.length) return <span className="text-[11px] text-zinc-600">No verified form</span>;
  return <div className="flex gap-1">{list.slice(0,5).map((v,i)=>
    <span key={i} className={"flex h-6 w-6 items-center justify-center rounded font-mono text-[10px] font-bold tabular-nums " +
      (v === "W" ? "bg-emerald-900/40 text-emerald-300" : v === "D" ? "bg-zinc-700/60 text-zinc-300" : "bg-rose-900/30 text-rose-300")}>{v}</span>
  )}</div>;
}
function PanelHeading({title,subtitle,icon}: {title:string;subtitle?:string;icon:React.ReactNode}) {
  return <div className="mb-4 flex items-start gap-2.5">
    <span className="mt-0.5 text-emerald-400">{icon}</span>
    <div><h3 className="text-sm font-semibold tracking-tight text-zinc-100">{title}</h3>
      {subtitle && <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{subtitle}</p>}</div>
  </div>;
}
export default function Dashboard({initialData}: {initialData:DashboardData}) {
  const games = initialData.matches || [];
  const [selectedId, setSelectedId] = useState<string>(games[0]?.id ?? "");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showDemoLineup, setShowDemoLineup] = useState(true);
  const selected = games.find((m)=>m.id===selectedId) ?? games[0];
  const grouped = useMemo(() => {
    const filtered = games.filter(m => (m.homeTeam.name + " " + m.awayTeam.name + " " + m.leagueName).toLowerCase().includes(query.toLowerCase().trim()));
    const map = new Map<LeagueId,MatchData[]>();
    filtered.forEach(m=>map.set(m.league,[...(map.get(m.league)||[]),m]));
    return Array.from(map.entries());
  }, [games, query]);
  const published = initialData.generatedAt && new Date(initialData.generatedAt);
  const updatedText = published instanceof Date && !Number.isNaN(published.getTime())
    ? new Intl.DateTimeFormat("en-CA",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"America/Toronto"}).format(published) + " ET"
    : "Timestamp unavailable";
  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-800/60 bg-zinc-950">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
              <Activity size={18} strokeWidth={2.5} className="text-emerald-400"/>
            </div>
            <div><div className="text-[17px] font-extrabold tracking-[-0.055em]">FOOTY<span className="text-emerald-400">EDGE</span><span className="ml-2 align-middle font-mono text-[9px] font-medium tracking-wide text-zinc-600">CYBER</span></div>
              <div className="text-[10px] tracking-[0.16em] text-zinc-500">THE MATCH INTELLIGENCE DESK</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-full border border-amber-700/30 bg-amber-500/5 px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.1em] text-amber-300">ISOLATED TEST PREVIEW</span>
            <span className="hidden items-center gap-1.5 font-mono text-[10px] tabular-nums text-zinc-500 md:flex"><Clock3 size={12}/> Updated {updatedText}</span>
            <div className="h-5 w-px bg-zinc-800/70 hidden sm:block" />
            <span className="text-[11px] text-zinc-400">No production changes</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 pb-16 pt-7 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> FOOTBALL / MATCH CENTER / PREVIEW
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.05em] text-zinc-50 sm:text-4xl">Match intelligence<span className="text-zinc-600">.</span></h1>
            <p className="mt-2 text-[12px] text-zinc-500">A calmer way to read a full matchday. Select a fixture to go deeper.</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/30 px-3 py-2 font-mono text-xs tabular-nums text-zinc-300">
            <CalendarDays size={14} className="text-emerald-400" />{prettyDate(initialData.date)}
            <span className="ml-1 border-l border-zinc-800 pl-2 text-zinc-600">{games.length} MATCHES</span>
          </div>
        </div>
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(315px,1fr)_minmax(0,2fr)]">
          <aside className="min-w-0 rounded-xl border border-zinc-800/60 bg-zinc-900/10 p-3 sm:p-4 xl:sticky xl:top-[90px]">
            <div className="mb-4 flex items-center justify-between px-1">
              <div className="flex items-center gap-2"><Layers2 size={15} className="text-emerald-400" /><h2 className="text-sm font-semibold">Match selector</h2></div>
              <span className="font-mono text-[10px] tabular-nums text-zinc-500">{games.length} fixtures</span>
            </div>
            <label className="mb-4 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5">
              <Search size={15} className="shrink-0 text-zinc-600" />
              <span className="sr-only">Search fixtures</span>
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search clubs or leagues" className="w-full min-w-0 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none" />
              <SlidersHorizontal size={13} className="text-zinc-700"/>
            </label>
            <div className="space-y-5 xl:max-h-[calc(100vh-240px)] xl:overflow-y-auto xl:pr-1">
              {grouped.length===0 ? <p className="px-2 py-10 text-center text-xs text-zinc-500">No fixtures match your search.</p> :
              grouped.map(([code,list]) => (
                <section key={code}>
                  <div className="mb-2.5 flex items-center justify-between px-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{backgroundColor:leagueStyles[code].accent}}/>
                      <h3 className="truncate text-[11px] font-semibold tracking-tight text-zinc-300">{leagueStyles[code].name}</h3>
                    </div>
                    <span className="ml-2 font-mono text-[10px] tabular-nums text-zinc-600">{list.length}</span>
                  </div>
                  <div className="space-y-2">
                    {list.map(m=><MatchStatsCard key={m.id} match={m} selected={selected?.id===m.id}
                      expanded={expandedId===m.id} onSelect={()=>{setSelectedId(m.id);setExpandedId(prev=>prev===m.id?null:m.id)}} />)}
                  </div>
                </section>
              ))}
            </div>
          </aside>
          <div className="min-w-0 space-y-5">
            {!selected ? <div className="rounded-xl border border-zinc-800/60 p-10 text-center text-sm text-zinc-500">No matches on this board.</div> : <>
            <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 px-4 py-5 sm:px-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                  <CircleDot size={13} style={{color:leagueStyles[selected.league].accent}}/>
                  {selected.leagueName}
                </span>
                <span className="font-mono text-[10px] tracking-wider text-zinc-600">MATCH ID {selected.id}</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-6">
                <div className="min-w-0">
                  <span className="mb-3 block h-1 w-10 rounded-full" style={{backgroundColor:selected.homeTeam.color}}/>
                  <h2 className="break-words text-lg font-semibold leading-tight tracking-tight text-zinc-100 sm:text-2xl">{selected.homeTeam.name}</h2>
                  <div className="mt-2 text-[10px] uppercase tracking-widest text-zinc-600">HOME</div>
                </div>
                <div className="text-center">
                  <div className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-zinc-300 sm:text-3xl">
                    {selected.score?.home != null && selected.score?.away != null ? String(selected.score.home)+" : "+String(selected.score.away) : "vs"}
                  </div>
                  <div className="mt-1 font-mono text-[10px] tabular-nums text-zinc-500">
                    {selected.status==="live" ? "LIVE" : selected.status==="final" ? "FINAL" : new Intl.DateTimeFormat("en-CA",{hour:"2-digit",minute:"2-digit",timeZone:"America/Toronto",hour12:false}).format(new Date(selected.kickoff))+" ET"}
                  </div>
                </div>
                <div className="min-w-0 text-right">
                  <span className="mb-3 ml-auto block h-1 w-10 rounded-full" style={{backgroundColor:selected.awayTeam.color}}/>
                  <h2 className="break-words text-lg font-semibold leading-tight tracking-tight text-zinc-100 sm:text-2xl">{selected.awayTeam.name}</h2>
                  <div className="mt-2 text-[10px] uppercase tracking-widest text-zinc-600">AWAY</div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-zinc-800/60 pt-4">
                <div><p className="mb-2 text-[10px] uppercase tracking-wider text-zinc-600">Home recent form</p><Form list={selected.homeTeam.form}/></div>
                <div className="text-right"><p className="mb-2 text-[10px] uppercase tracking-wider text-zinc-600">Away recent form</p><div className="flex justify-end"><Form list={selected.awayTeam.form}/></div></div>
              </div>
            </section>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Metric label="Research rating" value={selected.rating==null?"N/A":String(Math.round(selected.rating))+"/100"} sub="Not a calibrated probability" accent={true}/>
              <Metric label="Home goals avg." value={number(selected.homeTeam.goalsFor)} sub="Recent observed games"/>
              <Metric label="Away goals avg." value={number(selected.awayTeam.goalsFor)} sub="Recent observed games"/>
              <Metric label="Combined xG" value={selected.homeXG!=null&&selected.awayXG!=null?number(selected.homeXG+selected.awayXG,2):"N/A"} sub="Verified data only"/>
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="min-w-0 space-y-5">
                <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/20 p-4 sm:p-5">
                  <PanelHeading icon={<BarChart3 size={17}/>} title="Match dynamics" subtitle="Recent observed team averages, not a score prediction"/>
                  {[
                    ["Goals scored",selected.homeTeam.goalsFor,selected.awayTeam.goalsFor],
                    ["Goals conceded",selected.homeTeam.goalsAgainst,selected.awayTeam.goalsAgainst],
                    ["Shots taken",selected.homeTeam.shotsFor,selected.awayTeam.shotsFor]
                  ].map(([label,home,away])=>{
                    const h=typeof home==="number"?home:null;const a=typeof away==="number"?away:null;
                    const total=Math.max(0.1,(h??0)+(a??0));
                    return <div className="mb-5 last:mb-0" key={String(label)}>
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-mono tabular-nums text-zinc-300">{number(h)}</span>
                        <span className="text-zinc-500">{label}</span>
                        <span className="font-mono tabular-nums text-zinc-300">{number(a)}</span>
                      </div>
                      {h==null||a==null ? <div className="h-1.5 rounded-full bg-zinc-800/60"/> :
                      <div className="flex h-1.5 gap-1">
                        <div className="flex justify-end" style={{width:String(100*h/total)+"%"}}><div className="h-full w-full rounded-full bg-emerald-400/70"/></div>
                        <div className="rounded-full bg-zinc-500/60" style={{width:String(100*a/total)+"%"}}/>
                      </div>}
                    </div>;
                  })}
                </section>
                <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/20 p-4 sm:p-5">
                  <PanelHeading icon={<Target size={17}/>} title="Match analysis" subtitle="Evidence-led selections on this published board"/>
                  {(selected.analysis?.length??0)>0? <div className="space-y-3">
                    {selected.analysis!.map((pick,i)=><div key={i} className="border-b border-zinc-800/60 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2"><span className="text-xs font-semibold text-zinc-100">{pick.label}</span>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-emerald-400">{pick.confidence == null ? "N/A" : String(pick.confidence)+"/100"}</span></div>
                      {pick.reason && <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">{pick.reason}</p>}
                    </div>)}
                  </div>:<p className="text-xs text-zinc-500">No validated picks available for this match.</p>}
                </section>
                <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/20 p-4 sm:p-5">
                  <PanelHeading icon={<Zap size={17}/>} title="SGP & market lab" subtitle="No synthesized sportsbook prices or unsupported edges"/>
                  {selected.sgp?.verified && selected.sgp.legs.length===3 ?
                    <div>{selected.sgp.legs.map((leg,i)=><p key={i} className="mb-2 text-xs text-zinc-300">{i+1}. {leg.label}</p>)}
                      <p className="font-mono text-xs text-emerald-400">{selected.sgp.totalOdds??"Odds unavailable"}</p></div>
                    : <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-4 text-xs leading-relaxed text-zinc-500">
                      No source-verified three-leg SGP and market line are available for this fixture. Space is reserved for published picks once supported by real data.
                    </div>}
                </section>
                <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/20 p-4 sm:p-5">
                  <PanelHeading icon={<ShieldCheck size={17}/>} title="Head to head" subtitle="Most recent meetings, newest first"/>
                  {selected.h2h?.length ? <div className="space-y-2">{selected.h2h.slice(0,5).map((h,i)=><div key={i} className="flex justify-between gap-2 border-b border-zinc-800/50 pb-2 font-mono text-[10px] text-zinc-400"><span className="truncate">{h.home} / {h.away}</span><span className="shrink-0 tabular-nums">{h.score}</span></div>)}</div> :
                  <p className="text-xs text-zinc-500">No verified recent H2H entries in this dataset.</p>}
                </section>
              </div>
              <section className="min-w-0 rounded-xl border border-zinc-800/60 bg-zinc-900/20 p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2"><CircleDot size={16} className="text-emerald-400"/><h3 className="text-sm font-semibold">Tactical lineup</h3></div>
                  <button type="button" onClick={()=>setShowDemoLineup(p=>!p)}
                    className="rounded-lg border border-zinc-800 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-300 transition-colors hover:border-emerald-500/40">
                    {showDemoLineup ? "Show match XI" : "Show Arsenal demo"}
                  </button>
                </div>
                {showDemoLineup && <div className="mb-4 rounded-md border border-amber-600/20 bg-amber-400/5 px-3 py-2 text-[11px] leading-relaxed text-amber-200/80">
                  DESIGN DEMO · Arsenal example from your brief. Players and stat vectors are illustrative, not verified current team selections.
                </div>}
                <TacticalLineup key={selected.id + (showDemoLineup?"-demo":"-actual")} lineup={showDemoLineup?sample433Lineup:(selected.lineup??null)} demo={showDemoLineup}/>
              </section>
            </div>
            </>}
          </div>
        </div>
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/60 pt-6 text-[11px] text-zinc-600">
          <span>FootyEdge cyber-minimal concept · independent preview build</span>
          <span className="flex items-center gap-1">Data: {initialData.source} <ChevronRight size={12}/> Preview only <ArrowUpRight size={12}/></span>
        </footer>
      </main>
    </div>
  );
}
