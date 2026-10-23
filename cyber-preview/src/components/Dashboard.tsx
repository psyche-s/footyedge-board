"use client";

import {useMemo, useState} from "react";
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Bookmark, CalendarDays,
  CheckCircle2, ChevronDown, ChevronRight, CircleDot, Clock3, Compass, Crosshair,
  Filter, Gauge, Layers3, ListFilter, Search, ShieldCheck, Sparkles, Target, Trophy,
  TrendingUp, X, Zap
} from "lucide-react";
import TacticalLineup from "./TacticalLineup";
import {leagueStyles} from "@/lib/theme";
import type {DashboardData, LeagueId, LineupData, MatchData} from "@/lib/types";

type Workspace = "board" | "picks" | "results";
type InsightTab = "overview" | "picks" | "tactics" | "h2h";
type MatchStatus = "all" | "live" | "scheduled" | "final";
type PickEntry = {match:MatchData; label:string; reason?:string; confidence:number|null};

const sample433Lineup: LineupData = {
  teamName:"Arsenal · demo",accentColor:"#ef0107",formation:"4-3-3",confirmed:false,
  sourceLabel:"Design preview, not an authenticated starting XI",
  players:[
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
const statusOptions: {value:MatchStatus;label:string}[]=[
  {value:"all",label:"All"}, {value:"live",label:"Live"},
  {value:"scheduled",label:"Upcoming"}, {value:"final",label:"Final"}
];
const insightTabs: {value:InsightTab;label:string}[]=[
  {value:"overview",label:"Overview"}, {value:"picks",label:"Research picks"},
  {value:"tactics",label:"Tactical XI"}, {value:"h2h",label:"H2H & form"}
];
function number(value:number|null|undefined,digits=1){
  return value==null||!Number.isFinite(value)?"—":value.toFixed(digits);
}
function when(kickoff:string,mode:"time"|"date"="time"){
  const date=new Date(kickoff);
  if(Number.isNaN(date.getTime()))return "TBC";
  return mode==="time"
    ?new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",hour:"numeric",minute:"2-digit",hour12:true}).format(date)
    :new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",month:"short",day:"numeric"}).format(date);
}
function shortDate(date:string){
  const dt=new Date(date+"T12:00:00Z");
  return Number.isNaN(dt.getTime())?date:new Intl.DateTimeFormat("en-CA",{weekday:"long",month:"long",day:"numeric",timeZone:"UTC"}).format(dt);
}
function badgeName(name:string){
  const stripped=name.replace(/^(FC|AFC|AC|AS|CD|CF|SS|VfB)\s+/i,"").trim();
  const words=stripped.split(/\s+/);
  return words.length===1?words[0].slice(0,2).toUpperCase():words.slice(0,2).map(w=>w[0]).join("").toUpperCase();
}
function clubIcon(name:string,color:string,large=false){
  return <div aria-hidden="true" className={"club-emblem relative flex shrink-0 items-center justify-center rounded-full border border-white/10 font-mono font-black tracking-[-0.08em] text-white/90 "+
    (large?"h-[56px] w-[56px] text-[18px] sm:h-[68px] sm:w-[68px] sm:text-[21px]":"h-9 w-9 text-[11px]")}
    style={{backgroundColor:/^#[0-9a-f]{6}$/i.test(color)?color:"#334155"}}>
    <span className="relative z-10" style={{textShadow:"0 1px 5px rgba(0,0,0,.55)"}}>{badgeName(name)}</span>
  </div>;
}
function Form({list,align="left"}:{list:string[];align?:"left"|"right"}){
  if(!list.length)return <span className="text-[11px] text-zinc-600">No verified form</span>;
  return <div className={"flex gap-1 "+(align==="right"?"justify-end":"")}>{list.slice(0,5).map((v,i)=>
    <span key={i} title={"Match "+(i+1)+": "+v} className={"flex h-[22px] w-[22px] items-center justify-center rounded-[4px] font-mono text-[10px] font-bold tabular-nums "+
      (v==="W"?"bg-emerald-400/15 text-emerald-300":v==="D"?"bg-zinc-700/60 text-zinc-300":"bg-rose-400/10 text-rose-300")}>{v}</span>
  )}</div>;
}
function SectionTitle({eyebrow,title,aside}: {eyebrow:string;title:string;aside?:React.ReactNode}){
  return <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div><div className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.19em] text-lime-300/80">{eyebrow}</div>
      <h3 className="text-[17px] font-semibold tracking-[-0.035em] text-zinc-100">{title}</h3></div>{aside}
  </div>;
}
function Metric({label,value,note,tone}:{label:string;value:string;note:string;tone?:"green"}){
  return <div className="min-w-0 border-r border-white/[0.06] px-3.5 py-3.5 last:border-0 sm:px-5">
    <div className="truncate text-[10px] font-medium uppercase tracking-[.10em] text-zinc-500">{label}</div>
    <div className={"mt-2 font-mono text-[23px] font-semibold leading-none tabular-nums tracking-[-0.065em] sm:text-[29px] "+(tone==="green"?"text-lime-300":"text-zinc-50")}>{value}</div>
    <div className="mt-2 truncate text-[10px] text-zinc-600">{note}</div>
  </div>;
}
function Coverage({match}:{match:MatchData}){
  const checks=[
    {name:"Team form",ok:match.homeTeam.form.length>0&&match.awayTeam.form.length>0},
    {name:"Goal history",ok:match.homeTeam.goalsFor!=null&&match.awayTeam.goalsFor!=null},
    {name:"Shot history",ok:match.homeTeam.shotsFor!=null&&match.awayTeam.shotsFor!=null},
    {name:"Measured xG",ok:match.homeXG!=null&&match.awayXG!=null},
    {name:"Head-to-head",ok:!!match.h2h?.length},
    {name:"Verified lineup",ok:!!match.lineup?.players&&match.lineup.players.length===11},
    {name:"Verified SGP",ok:match.sgp?.verified===true&&match.sgp.legs.length===3}
  ];
  const complete=checks.filter(x=>x.ok).length;
  return <div className="fe-panel p-5">
    <SectionTitle eyebrow="DATA INTEGRITY" title="Coverage monitor" aside={<div className="font-mono text-lg font-semibold tabular-nums text-zinc-100">{complete}<span className="text-zinc-600">/7</span></div>}/>
    <div className="mb-4 flex h-1.5 overflow-hidden rounded-full bg-zinc-800">{checks.map((c,i)=><div key={i} className={"flex-1 "+(c.ok?"bg-lime-300":"bg-zinc-800")} style={{marginRight:i===checks.length-1?0:2}} />)}</div>
    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
      {checks.map(c=><div key={c.name} className="flex min-w-0 items-center gap-2 text-[11px] text-zinc-500">
        {c.ok?<CheckCircle2 size={13} className="shrink-0 text-lime-300"/>:<span className="flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-full border border-zinc-700 text-[8px]">−</span>}
        <span className="truncate">{c.name}</span></div>)}
    </div>
    <p className="mt-4 border-t border-white/[0.06] pt-3 text-[10px] leading-relaxed text-zinc-600">Missing coverage is shown as unavailable, never replaced with invented data.</p>
  </div>;
}
function StatCompare({match}:{match:MatchData}){
  const rows=[
    {label:"Goals scored / match",h:match.homeTeam.goalsFor,a:match.awayTeam.goalsFor},
    {label:"Goals conceded / match",h:match.homeTeam.goalsAgainst,a:match.awayTeam.goalsAgainst},
    {label:"Shots taken / match",h:match.homeTeam.shotsFor,a:match.awayTeam.shotsFor}
  ];
  return <div className="fe-panel p-5">
    <SectionTitle eyebrow="RECENT MATCHES" title="Attack vs. defense" aside={<span className="font-mono text-[10px] text-zinc-600">HOME / AWAY</span>}/>
    <div className="space-y-6">{rows.map(row=>{
      const okay=row.h!=null&&row.a!=null;
      const max=okay?Math.max(.1,row.h!,row.a!):1;
      return <div key={row.label}>
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <span className="font-mono text-[13px] font-semibold tabular-nums text-zinc-100">{number(row.h)}</span>
          <span className="text-center text-[11px] text-zinc-500">{row.label}</span>
          <span className="font-mono text-[13px] font-semibold tabular-nums text-zinc-100">{number(row.a)}</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex h-[7px] justify-end rounded-l-sm bg-zinc-800/60">{okay&&<div className="h-full rounded-l-sm bg-lime-300" style={{width:(100*row.h!/max)+"%"}}/>}</div>
          <div className="h-[7px] rounded-r-sm bg-zinc-800/60">{okay&&<div className="h-full rounded-r-sm bg-sky-400/75" style={{width:(100*row.a!/max)+"%"}}/>}</div>
        </div>
      </div>;
    })}</div>
    <p className="mt-5 border-t border-white/[0.06] pt-3 text-[10px] leading-relaxed text-zinc-600">Observed rolling averages where available. Bars show relative values, not win likelihood.</p>
  </div>;
}
function GoalModel({match}:{match:MatchData}){
  const f=match.modelForecast;
  return <div className="fe-panel p-5">
    <SectionTitle eyebrow="QUANT LAB / V1" title="Goal model" aside={<Gauge size={18} className="text-zinc-500"/>}/>
    {f?<div>
      <div className="grid grid-cols-2 gap-2">
        {[["HOME λ",f.homeLambda],["AWAY λ",f.awayLambda]].map(([title,v])=><div key={String(title)} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="font-mono text-[10px] tracking-[.12em] text-zinc-500">{title}</div>
          <div className="mt-2 font-mono text-xl font-semibold tracking-tight tabular-nums">{number(Number(v),2)}</div></div>)}
      </div>
      <div className="mt-5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">1X2 model estimate</div>
      <div className="mt-2 flex gap-1 overflow-hidden rounded-sm">
        {[
          {x:f.homeWin,c:"bg-lime-300"},{x:f.draw,c:"bg-zinc-500"},{x:f.awayWin,c:"bg-sky-400"}
        ].map((p,i)=><div key={i} className={p.c+" h-[7px]"} style={{width:p.x+"%"}}/>)}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">{[["HOME",f.homeWin],["DRAW",f.draw],["AWAY",f.awayWin]].map(([n,p])=>
        <div key={String(n)} className="font-mono"><div className="text-[15px] font-semibold tabular-nums text-zinc-200">{number(Number(p),1)}%</div>
          <div className="text-[9px] tracking-wider text-zinc-600">{n}</div></div>)}
      </div>
      <div className="mt-4 flex justify-between gap-2 border-t border-zinc-800/60 pt-3 text-[11px]">
        <span className="text-zinc-500">P(over 2.5 goals)</span><span className="font-mono font-semibold tabular-nums">{number(f.over25,1)}%</span>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">Estimated from completed results only ({f.sample.league} league matches). Independent Poisson model; uncalibrated. Not measured xG or a betting recommendation.</p>
    </div>:<div className="py-2">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950"><Activity size={18} className="text-zinc-500"/></div>
      <p className="text-[12px] font-medium text-zinc-300">Model awaiting historical input</p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">No validated goal-rate forecast for this fixture yet. We&apos;ll display it only when prior match data passes coverage checks.</p>
    </div>}
  </div>;
}
function ResearchPicks({match}:{match:MatchData}){
  const picks=match.analysis||[];
  return <div className="fe-panel p-5">
    <SectionTitle eyebrow="RESEARCH DESK" title="Top match selections" aside={<span className="rounded border border-lime-300/20 bg-lime-300/[.07] px-2 py-1 font-mono text-[10px] text-lime-300">{picks.length} PUBLISHED</span>}/>
    {picks.length ? <div className="space-y-3">{picks.slice(0,3).map((pick,i)=>
      <div key={i} className="rounded-lg border border-zinc-800/80 bg-zinc-950/35 p-3.5">
        <div className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-lime-300/10 font-mono text-[11px] font-bold text-lime-300">0{i+1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="text-[12px] font-semibold text-zinc-100">{pick.label}</h4>
              <div className="font-mono text-[12px] font-semibold tabular-nums text-lime-300">{pick.confidence!=null?pick.confidence+"/100":"—"}</div></div>
            {pick.reason&&<p className="mt-2 text-[11px] leading-[1.65] text-zinc-500">{pick.reason}</p>}
          </div>
        </div>
      </div>)}</div>:
      <p className="rounded-md border border-dashed border-zinc-800 px-3 py-5 text-[12px] text-zinc-500">No published, supported picks for this match.</p>}
    <p className="mt-3 text-[10px] text-zinc-600">Ratings describe research strength, not calibrated win probabilities.</p>
  </div>;
}
function SGP({match}:{match:MatchData}){
  const good=match.sgp?.verified&&match.sgp.legs?.length===3;
  return <div className="fe-panel p-5">
    <SectionTitle eyebrow="BET BUILDER" title="Same-game analysis" aside={<Zap size={17} className="text-lime-300"/>}/>
    {good?<div className="space-y-3">
      {match.sgp!.legs.map((leg,i)=><div key={i} className="flex items-start gap-3 border-b border-zinc-800/60 pb-3 last:border-0">
        <span className="font-mono text-xs text-lime-300">0{i+1}</span>
        <div><div className="text-[12px] font-medium text-zinc-200">{leg.label}</div>
        {leg.reason&&<p className="mt-1 text-[11px] text-zinc-500">{leg.reason}</p>}</div></div>)}
      <div className="flex justify-between pt-1 text-[11px]"><span className="text-zinc-500">Verified quoted odds</span><span className="font-mono tabular-nums">{match.sgp?.totalOdds??"Unavailable"}</span></div>
      <div className="flex justify-between text-[11px]"><span className="text-zinc-500">Whole-slip rating</span><span className="font-mono tabular-nums">{match.sgp?.confidence??"N/A"}</span></div>
    </div>:<div className="rounded-lg border border-dashed border-zinc-800 p-4">
      <div className="text-[12px] font-medium text-zinc-300">No verified slip available</div>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">Player props, availability and quoted lines must be verified before a multi-leg selection is published. We do not auto-generate unsupported SGPs.</p>
    </div>}
  </div>;
}
function HeadToHead({match}:{match:MatchData}){
  return <div className="fe-panel p-5">
    <SectionTitle eyebrow="HISTORICAL CONTEXT" title="Recent head-to-head" aside={<ShieldCheck size={17} className="text-zinc-500"/>}/>
    {match.h2h?.length?<div>{match.h2h.slice(0,5).map((h,i)=>
      <div key={i} className="flex items-center justify-between gap-2 border-b border-white/[.06] py-3 last:border-0">
        <div className="min-w-0 text-[12px] text-zinc-300"><div className="truncate">{h.home}</div><div className="truncate text-zinc-600">{h.away}</div></div>
        <div className="shrink-0 text-right"><div className="font-mono text-[15px] font-semibold tabular-nums">{h.score}</div>
          <div className="font-mono text-[10px] text-zinc-600">{h.date}</div></div>
      </div>)}</div>:
      <div className="rounded-lg border border-dashed border-zinc-800 p-5 text-[12px] text-zinc-500">No verified recent head-to-head entries in this published board.</div>}
  </div>;
}
function MainHero({match,onFavorite,favorited}:{match:MatchData;onFavorite:()=>void;favorited:boolean}){
  const status=match.status;
  return <section className="fe-hero relative overflow-hidden rounded-2xl border border-white/[.10] bg-[#151b19]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.07] px-5 py-3.5 sm:px-7">
      <div className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-zinc-400">
        <CircleDot size={13} style={{color:leagueStyles[match.league].accent}}/>
        <span className="truncate">{match.leagueName}</span><ChevronRight size={12} className="text-zinc-700"/>
        <span className="font-mono text-[10px] text-zinc-600">{when(match.kickoff,"date")}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={"flex items-center gap-1.5 rounded-full px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider "+
          (status==="live"?"bg-rose-400/10 text-rose-300":status==="final"?"bg-zinc-700/50 text-zinc-300":"bg-amber-400/10 text-amber-300")}>
          {status==="live"&&<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400"/>}
          {status==="live"?"LIVE":status==="final"?"FINAL":"UPCOMING"}
        </span>
        <button type="button" title={favorited?"Remove from session watchlist":"Add to session watchlist"} aria-label={favorited?"Remove from watchlist":"Add to watchlist"}
          onClick={onFavorite} className={"flex h-8 w-8 items-center justify-center rounded-lg border transition-colors "+(favorited?"border-lime-300/40 bg-lime-300/10 text-lime-300":"border-white/10 text-zinc-500 hover:text-zinc-100")}>
          <Bookmark size={15} fill={favorited?"currentColor":"none"}/></button>
      </div>
    </div>
    <div className="relative px-4 py-8 sm:px-7 sm:py-10">
      <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-[5px]" style={{backgroundColor:match.homeTeam.color}}/>
      <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-[5px]" style={{backgroundColor:match.awayTeam.color}}/>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(64px,auto)_minmax(0,1fr)] items-center gap-2 sm:gap-6">
        <div className="flex min-w-0 flex-col items-center text-center sm:items-start sm:text-left">
          {clubIcon(match.homeTeam.name,match.homeTeam.color,true)}
          <h2 className="mt-4 max-w-[225px] text-[17px] font-bold leading-[1.15] tracking-[-.045em] text-white sm:text-[24px]">{match.homeTeam.name}</h2>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[.21em] text-zinc-500">Home</p>
        </div>
        <div className="min-w-[64px] text-center">
          <div className="font-mono text-[30px] font-semibold leading-none tabular-nums tracking-[-.08em] text-zinc-100 sm:text-[44px]">
            {match.score?.home!=null&&match.score?.away!=null?<>{match.score.home}<span className="px-1 text-zinc-600">:</span>{match.score.away}</>:
              <span className="font-sans text-[24px] font-light tracking-[-.07em] text-zinc-600 sm:text-[30px]">VS</span>}
          </div>
          <div className="mt-3 whitespace-nowrap font-mono text-[10px] font-semibold tabular-nums tracking-tight text-lime-300 sm:text-[12px]">
            {status==="live"?(match.minute!=null?match.minute+"'":"LIVE"):status==="final"?"FT":when(match.kickoff)}
          </div>
          <div className="mt-1 font-mono text-[9px] text-zinc-600">ET</div>
        </div>
        <div className="flex min-w-0 flex-col items-center text-center sm:items-end sm:text-right">
          {clubIcon(match.awayTeam.name,match.awayTeam.color,true)}
          <h2 className="mt-4 max-w-[225px] text-[17px] font-bold leading-[1.15] tracking-[-.045em] text-white sm:text-[24px]">{match.awayTeam.name}</h2>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[.21em] text-zinc-500">Away</p>
        </div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 border-t border-white/[.07] bg-[#111715] px-5 py-3.5 sm:px-7">
      <div><div className="mb-2 font-mono text-[9px] uppercase tracking-wider text-zinc-600">Recent form</div><Form list={match.homeTeam.form}/></div>
      <div className="text-right"><div className="mb-2 font-mono text-[9px] uppercase tracking-wider text-zinc-600">Recent form</div><Form list={match.awayTeam.form} align="right"/></div>
    </div>
  </section>;
}
function FixtureRow({match,selected,onClick}:{match:MatchData;selected:boolean;onClick:()=>void}){
  return <button type="button" onClick={onClick} aria-current={selected?"true":undefined}
    className={"fe-fixture group relative w-full rounded-xl border px-3 py-3 text-left transition-[border-color,background-color] "+
      (selected?"border-lime-300/40 bg-[#1a2620]":"border-transparent bg-[#141919] hover:border-zinc-700/70 hover:bg-[#1a211f]")}>
    {selected&&<span className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full bg-lime-300"/>}
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="w-8 shrink-0 font-mono text-[10px] tabular-nums text-zinc-500">{when(match.kickoff)}</span>
        <div className="min-w-0 space-y-[5px]">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{backgroundColor:match.homeTeam.color}}/>
            <span className={"truncate text-[12px] "+(selected?"font-semibold text-zinc-100":"font-medium text-zinc-300")}>{match.homeTeam.name}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{backgroundColor:match.awayTeam.color}}/>
            <span className={"truncate text-[12px] "+(selected?"font-semibold text-zinc-100":"font-medium text-zinc-300")}>{match.awayTeam.name}</span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={"font-mono text-[11px] font-semibold tabular-nums "+(match.rating!=null?"text-lime-300":"text-zinc-600")}>
          {match.rating!=null?match.rating+"/100":"—"}
        </span>
        <ChevronRight size={13} className={selected?"text-lime-300":"text-zinc-600 group-hover:text-zinc-300"}/>
      </div>
    </div>
  </button>;
}
function PicksSurface({picks,onOpen}:{picks:PickEntry[];onOpen:(id:string)=>void}){
  return <div className="space-y-5">
    <div className="fe-panel p-6 sm:p-8">
      <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[.19em] text-lime-300"><Trophy size={14}/> THE RESEARCH BOARD</div>
      <h2 className="mt-3 text-[28px] font-semibold tracking-[-.055em] sm:text-4xl">Highest-rated <span className="text-zinc-500">selections.</span></h2>
      <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-zinc-500">Ranked from the published fixture research already in this snapshot. They are not a freshly sourced, independent Top 5 or guaranteed outcomes.</p>
    </div>
    {picks.length? <div className="grid gap-3 xl:grid-cols-2">{picks.slice(0,5).map((pick,i)=>
      <button onClick={()=>onOpen(pick.match.id)} key={pick.match.id+pick.label} type="button" className={"fe-panel group p-5 text-left transition-colors hover:border-lime-300/40 "+(i===0?"xl:col-span-2":"")}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-4">
            <span className="font-mono text-[25px] font-semibold tabular-nums tracking-tight text-lime-300/80">0{i+1}</span>
            <div className="min-w-0">
              <div className="text-[10px] text-zinc-500">{pick.match.leagueName} · {when(pick.match.kickoff)}</div>
              <h3 className="mt-2 text-[16px] font-semibold leading-tight tracking-tight text-zinc-100">{pick.label}</h3>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{pick.reason||"No supporting reasoning attached."}</p>
              <p className="mt-3 truncate font-mono text-[10px] text-zinc-600">{pick.match.homeTeam.name} / {pick.match.awayTeam.name}</p>
            </div>
          </div>
          <div className="shrink-0 text-right"><div className="font-mono text-xl font-semibold tabular-nums text-lime-300">{pick.confidence!=null?pick.confidence:"—"}</div>
            <div className="font-mono text-[9px] text-zinc-600">/ 100</div><ArrowUpRight size={15} className="ml-auto mt-4 text-zinc-600 group-hover:text-lime-300"/></div>
        </div>
      </button>)}</div>:
      <div className="fe-panel p-8 text-center text-sm text-zinc-500">No supported selections available in this snapshot.</div>}
    <p className="text-[11px] text-zinc-600">Research-strength scores are not validated betting probabilities. The shortlist includes only existing published selections.</p>
  </div>;
}

export default function Dashboard({initialData}:{initialData:DashboardData}){
  const games=initialData.matches||[];
  const [workspace,setWorkspace]=useState<Workspace>("board");
  const [selectedId,setSelectedId]=useState(games[0]?.id??"");
  const [insight,setInsight]=useState<InsightTab>("overview");
  const [status,setStatus]=useState<MatchStatus>("all");
  const [league,setLeague]=useState<string>("all");
  const [query,setQuery]=useState("");
  const [favorites,setFavorites]=useState<string[]>([]);
  const [onlyFavorites,setOnlyFavorites]=useState(false);
  const [demoXI,setDemoXI]=useState(false);
  const selected=games.find(m=>m.id===selectedId)??games[0];
  const visible=useMemo(()=>games.filter(m=>
    (status==="all"||m.status===status)&&
    (league==="all"||m.league===league)&&
    (!onlyFavorites||favorites.includes(m.id))&&
    (m.homeTeam.name+" "+m.awayTeam.name+" "+m.leagueName).toLowerCase().includes(query.toLowerCase().trim())
  ),[games,status,league,query,favorites,onlyFavorites]);
  const groups=useMemo(()=>{
    const map=new Map<LeagueId,MatchData[]>();
    visible.forEach(m=>map.set(m.league,[...(map.get(m.league)||[]),m]));
    return Array.from(map.entries());
  },[visible]);
  const boardPicks=useMemo<PickEntry[]>(()=>games.flatMap(match=>(match.analysis||[]).map(pick=>({
    match,label:pick.label,reason:pick.reason,confidence:pick.confidence??null
  }))).sort((a,b)=>(b.confidence??-1)-(a.confidence??-1)),[games]);
  const leagues=useMemo(()=>Array.from(new Map(games.map(m=>[m.league,m.leagueName])).entries()),[games]);
  const updated=new Date(initialData.generatedAt);
  const updatedLabel=Number.isNaN(updated.getTime())?"Timestamp unavailable":new Intl.DateTimeFormat("en-CA",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/Toronto"}).format(updated)+" ET";
  function openMatch(id:string){
    setSelectedId(id);setWorkspace("board");setInsight("overview");setDemoXI(false);
  }
  function toggleFavorite(id:string){setFavorites(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);}
  const liveCount=games.filter(m=>m.status==="live").length;
  return <div className="min-h-screen bg-[#090d0c] text-zinc-100">
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#0b100f]">
      <div className="mx-auto flex min-h-[70px] max-w-[1700px] items-center justify-between gap-4 px-4 sm:px-6 xl:px-9">
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-lime-300/30 bg-lime-300/10 text-lime-300"><Crosshair size={20} strokeWidth={2.5}/></div>
          <div><div className="text-[18px] font-black uppercase leading-none tracking-[-.065em]">FOOTY<span className="text-lime-300">EDGE</span><span className="ml-2 align-middle font-mono text-[8px] font-bold tracking-[.2em] text-zinc-500">LAB</span></div>
          <div className="mt-1 font-mono text-[8px] font-medium tracking-[.18em] text-zinc-600">THE MATCH INTELLIGENCE PLATFORM</div></div>
        </div>
        <nav className="hidden h-[70px] items-stretch gap-7 md:flex" aria-label="Workspace views">
          {([{id:"board",label:"Match centre",icon:Layers3},{id:"picks",label:"Top picks",icon:Target},{id:"results",label:"Results lab",icon:Trophy}] as const).map(item=>
            <button key={item.id} type="button" onClick={()=>setWorkspace(item.id)}
              className={"relative flex items-center gap-2 text-[12px] font-medium transition-colors "+(workspace===item.id?"text-zinc-100":"text-zinc-500 hover:text-zinc-200")}>
              <item.icon size={14} className={workspace===item.id?"text-lime-300":""}/>{item.label}
              {workspace===item.id&&<span className="absolute bottom-0 left-0 right-0 h-[2px] bg-lime-300"/>}
            </button>)}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-1.5 font-mono text-[10px] text-zinc-500 xl:flex"><Clock3 size={13}/> {updatedLabel}</span>
          <span className="rounded-md border border-amber-500/25 bg-amber-400/[.06] px-2.5 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-amber-300">Design preview</span>
        </div>
      </div>
      <div className="flex gap-1 border-t border-white/[.05] px-4 md:hidden" aria-label="Mobile workspace views">
        {([{id:"board",label:"Matches"},{id:"picks",label:"Top picks"},{id:"results",label:"Results"}] as const).map(n=>
          <button key={n.id} type="button" onClick={()=>setWorkspace(n.id)} className={"px-4 py-2.5 text-[11px] font-medium "+(workspace===n.id?"border-b-2 border-lime-300 text-lime-300":"text-zinc-500")}>{n.label}</button>)}
      </div>
    </header>
    <main className="mx-auto max-w-[1700px] px-4 pb-16 pt-7 sm:px-6 xl:px-9">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[.21em] text-lime-300/80">
            <span className="inline-block h-[5px] w-[5px] rounded-full bg-lime-300"/> MATCHDAY INTELLIGENCE <span className="text-zinc-700">/</span> 2026
          </div>
          <h1 className="text-[31px] font-semibold leading-[1.1] tracking-[-.06em] sm:text-[42px]">
            {workspace==="board"?<>Your matchday. <span className="text-zinc-500">Decoded.</span></>:
             workspace==="picks"?<>The edge <span className="text-zinc-500">board.</span></>:
             <>Results & <span className="text-zinc-500">accountability.</span></>}
          </h1>
          <p className="mt-2.5 text-[12px] text-zinc-500">
            {workspace==="board"?"Fixtures, supporting evidence and tactical context — all in one focused workspace.":
             workspace==="picks"?"A ranked view of existing published research, with explanations you can inspect.":
             "A dedicated home for transparent grading and post-match learning."}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-white/[.07] bg-[#111715] px-4 py-3">
          <CalendarDays size={15} className="text-lime-300"/>
          <div><div className="text-[11px] font-semibold">{shortDate(initialData.date)}</div>
          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wide text-zinc-600">Archived published board</div></div>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {[
          {label:"Fixtures on board",value:String(games.length).padStart(2,"0"),note:"Published fixture snapshot"},
          {label:"Leagues covered",value:String(leagues.length).padStart(2,"0"),note:"Men's competitions"},
          {label:"Research selections",value:String(boardPicks.length).padStart(2,"0"),note:"Published match insights"},
          {label:"Currently marked live",value:String(liveCount).padStart(2,"0"),note:"Snapshot status, not a live feed"}
        ].map((m,i)=><div key={m.label} className="rounded-xl border border-white/[.07] bg-[#111715] px-4 py-3.5">
          <div className="flex items-start justify-between gap-2"><div className="font-mono text-[24px] font-semibold leading-none tracking-[-.05em] tabular-nums text-zinc-100">{m.value}</div>
            <span className={"mt-1 h-1.5 w-1.5 rounded-full "+(i===2?"bg-lime-300":"bg-zinc-600")}/></div>
          <div className="mt-3 text-[11px] font-medium text-zinc-300">{m.label}</div>
          <div className="mt-1 text-[10px] text-zinc-600">{m.note}</div></div>)}
      </div>
      {workspace==="picks"&&<PicksSurface picks={boardPicks} onOpen={openMatch}/>}
      {workspace==="results"&&<div className="grid gap-5 lg:grid-cols-2">
        <div className="fe-panel p-7 sm:p-9">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-lime-300/10 text-lime-300"><Trophy size={22}/></div>
          <h2 className="text-2xl font-semibold tracking-tight">Transparent pick tracking.</h2>
          <p className="mt-3 text-[12px] leading-relaxed text-zinc-500">This preview includes an archived pre-match board, but no verified settled pick outcomes. Win rates, profit, hit counts and learning insights remain blank until actual match results are linked and graded.</p>
          <div className="mt-7 grid grid-cols-3 divide-x divide-white/[.07] rounded-lg border border-white/[.07] bg-zinc-950/50 p-4">
            {["Graded picks","Hit rate","Whole-slip record"].map(x=><div key={x} className="px-3 text-center"><div className="font-mono text-2xl tabular-nums text-zinc-500">—</div><div className="mt-2 text-[10px] text-zinc-600">{x}</div></div>)}
          </div>
        </div>
        <div className="fe-panel p-7 sm:p-9"><SectionTitle eyebrow="LEARNING LOOP" title="What the tracker will reveal"/>
          <div className="space-y-4">{[
            ["01","Post-match grading","Mark each published leg ✓ or × only after checking the final result."],
            ["02","Explain misses","Surface cards, injuries, VAR, rotation and tactical changes when verified."],
            ["03","Improve the model","Track hit rates by market, league, confidence band and whole slip."]
          ].map(([n,t,d])=><div key={n} className="flex gap-4 border-b border-white/[.06] pb-4 last:border-0"><span className="font-mono text-lime-300">{n}</span><div><div className="text-[13px] font-semibold">{t}</div><p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{d}</p></div></div>)}</div>
        </div>
      </div>}
      {workspace==="board"&&<div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(285px,0.36fr)_minmax(0,0.64fr)] xl:grid-cols-[minmax(315px,0.33fr)_minmax(0,0.67fr)]">
        <aside className="min-w-0 rounded-2xl border border-white/[.07] bg-[#111715] p-3.5 lg:sticky lg:top-[88px]">
          <div className="flex items-center justify-between px-2 pb-3 pt-1">
            <div><div className="font-mono text-[10px] font-semibold uppercase tracking-[.19em] text-lime-300/80">THE SLATE</div>
              <h2 className="mt-1 text-[16px] font-semibold tracking-tight">Match fixtures</h2></div>
            <div className="rounded-md border border-white/10 px-2 py-1 font-mono text-[11px] tabular-nums text-zinc-400">{visible.length}<span className="text-zinc-600">/{games.length}</span></div>
          </div>
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"/>
            <input aria-label="Search fixtures" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search clubs, competitions..." className="w-full rounded-lg border border-white/[.08] bg-[#0b100f] py-3 pl-9 pr-9 text-[12px] text-zinc-100 placeholder:text-zinc-600 focus:border-lime-300/40 focus:outline-none"/>
            {!!query&&<button type="button" aria-label="Clear search" onClick={()=>setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"><X size={14}/></button>}
          </div>
          <div className="mb-3 flex gap-1 rounded-lg bg-[#0b100f] p-1" role="group" aria-label="Fixture status">
            {statusOptions.map(item=><button key={item.value} type="button" aria-pressed={status===item.value} onClick={()=>setStatus(item.value)}
              className={"min-w-0 flex-1 rounded-md px-1 py-2 text-[10px] font-semibold transition-colors "+(status===item.value?"bg-[#28342b] text-lime-300":"text-zinc-500 hover:text-zinc-200")}>
              {item.label}</button>)}
          </div>
          <div className="mb-4 grid grid-cols-[1fr_auto] gap-2">
            <label className="relative min-w-0"><span className="sr-only">Filter by league</span>
              <select value={league} onChange={e=>setLeague(e.target.value)} className="w-full appearance-none rounded-lg border border-white/[.07] bg-[#151b19] py-2.5 pl-3 pr-8 text-[11px] text-zinc-300 focus:border-lime-300/40 focus:outline-none">
                <option value="all">All competitions</option>
                {leagues.map(([id,name])=><option key={id} value={id}>{name}</option>)}
              </select><ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500"/></label>
            <button type="button" onClick={()=>setOnlyFavorites(v=>!v)} aria-pressed={onlyFavorites} title="Toggle session watchlist"
              className={"flex items-center gap-1.5 rounded-lg border px-2.5 text-[11px] "+(onlyFavorites?"border-lime-300/35 bg-lime-300/10 text-lime-300":"border-white/[.08] text-zinc-500 hover:text-zinc-200")}>
              <Bookmark size={13} fill={onlyFavorites?"currentColor":"none"}/><span className="font-mono tabular-nums">{favorites.length}</span></button>
          </div>
          <div className="space-y-4 lg:max-h-[calc(100vh-325px)] lg:min-h-[220px] lg:overflow-y-auto lg:pr-1">
            {groups.length?groups.map(([code,list])=><section key={code}>
              <div className="mb-2 flex items-center justify-between px-2">
                <span className="flex min-w-0 items-center gap-2"><span className="h-[7px] w-[7px] rounded-sm" style={{backgroundColor:leagueStyles[code].accent}}/>
                  <span className="truncate text-[11px] font-semibold text-zinc-300">{leagueStyles[code].name}</span></span>
                <span className="font-mono text-[10px] tabular-nums text-zinc-600">{list.length}</span>
              </div>
              <div className="space-y-1">{list.map(m=><FixtureRow key={m.id} match={m} selected={selected?.id===m.id} onClick={()=>openMatch(m.id)}/>)}</div>
            </section>):<div className="rounded-lg border border-dashed border-zinc-800 px-3 py-10 text-center">
              <ListFilter size={20} className="mx-auto text-zinc-600"/>
              <p className="mt-2 text-xs text-zinc-500">No matching fixtures.</p>
              <button type="button" onClick={()=>{setStatus("all");setLeague("all");setQuery("");setOnlyFavorites(false)}} className="mt-3 text-[11px] font-semibold text-lime-300">Reset filters</button>
            </div>}
          </div>
          <div className="mt-4 border-t border-white/[.07] px-2 pt-3">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-zinc-600"><ShieldCheck size={13} className="text-lime-300/70"/> Numbers verified or labeled unavailable</div>
          </div>
        </aside>
        <div className="min-w-0 space-y-4">
          {!selected?<div className="fe-panel p-10 text-center text-zinc-500">No fixtures on this board.</div>:<>
            <MainHero match={selected} favorited={favorites.includes(selected.id)} onFavorite={()=>toggleFavorite(selected.id)}/>
            <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-white/[.07] bg-[#111715] sm:grid-cols-4">
              <Metric label="Research rating" value={selected.rating!=null?selected.rating+"/100":"—"} note="Not win probability" tone="green"/>
              <Metric label="Home goals avg" value={number(selected.homeTeam.goalsFor)} note="Observed form"/>
              <Metric label="Away goals avg" value={number(selected.awayTeam.goalsFor)} note="Observed form"/>
              <Metric label="Verified xG total" value={selected.homeXG!=null&&selected.awayXG!=null?number(selected.homeXG+selected.awayXG,2):"—"} note="Only if measured"/>
            </div>
            <div className="rounded-xl border border-white/[.07] bg-[#111715]">
              <div className="flex items-center gap-0.5 overflow-x-auto px-2 sm:px-4" role="tablist" aria-label="Match intelligence sections">
                {insightTabs.map(tab=><button key={tab.value} id={"fe-tab-"+tab.value} type="button" role="tab" aria-selected={insight===tab.value}
                  onClick={()=>setInsight(tab.value)} className={"relative shrink-0 px-3 py-3.5 text-[11px] font-semibold transition-colors sm:px-4 "+
                    (insight===tab.value?"text-lime-300":"text-zinc-500 hover:text-zinc-200")}>
                    {tab.label}{insight===tab.value&&<span className="absolute bottom-0 left-3 right-3 h-[2px] bg-lime-300 sm:left-4 sm:right-4"/>}
                  </button>)}
              </div>
            </div>
            <div role="tabpanel" aria-labelledby={"fe-tab-"+insight}>
              {insight==="overview"&&<div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(275px,.95fr)]">
                <div className="min-w-0 space-y-4"><StatCompare match={selected}/><ResearchPicks match={selected}/></div>
                <div className="min-w-0 space-y-4"><GoalModel match={selected}/><Coverage match={selected}/></div>
              </div>}
              {insight==="picks"&&<div className="grid gap-4 xl:grid-cols-2">
                <ResearchPicks match={selected}/><div className="space-y-4"><SGP match={selected}/>
                  <div className="fe-panel p-5"><SectionTitle eyebrow="TEAM CONTEXT" title="News & availability"/>
                  <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-[11px] leading-relaxed text-zinc-500">No verified injury, suspension or starting-lineup update is supplied for this fixture. No player availability is assumed.</div>
                  </div></div></div>}
              {insight==="tactics"&&<div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(230px,.8fr)]">
                <div className="fe-panel p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div><div className="font-mono text-[10px] tracking-widest text-lime-300">ON THE PITCH</div>
                      <h3 className="mt-1 text-[17px] font-semibold tracking-tight">Starting XI & player intelligence</h3></div>
                    <button type="button" onClick={()=>setDemoXI(v=>!v)} className={"rounded-lg border px-3 py-2 text-[10px] font-semibold "+(demoXI?"border-amber-500/40 bg-amber-400/10 text-amber-300":"border-white/10 text-zinc-400 hover:border-lime-300/40")}>
                      {demoXI?"Hide design demo":"Try sample 4-3-3"}</button>
                  </div>
                  {demoXI&&<p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-400/[.06] px-3 py-2 text-[11px] leading-relaxed text-amber-200/80">Illustrative Arsenal design mockup only. Names, positions and advanced player statistics are not authenticated current match data.</p>}
                  <TacticalLineup key={selected.id+(demoXI?"-demo":"-match")} lineup={demoXI?sample433Lineup:(selected.lineup??null)} demo={demoXI}/>
                </div>
                <div className="space-y-4"><Coverage match={selected}/>
                  <div className="fe-panel p-5"><SectionTitle eyebrow="LINEUP STATUS" title="Verified vs projected"/>
                  <p className="text-[11px] leading-relaxed text-zinc-500">{selected.lineup?.players.length===11?(selected.lineup.confirmed?"Verified confirmed starting XI loaded.":"Projected XI supplied, not yet confirmed."):"A verified projected or confirmed XI has not been supplied for this match. We keep this separate from the optional design demo."}</p></div></div>
              </div>}
              {insight==="h2h"&&<div className="grid gap-4 xl:grid-cols-2">
                <HeadToHead match={selected}/>
                <div className="fe-panel p-5">
                  <SectionTitle eyebrow="RECENT FIVE" title="Form guide"/>
                  {[selected.homeTeam,selected.awayTeam].map(team=><div key={team.name} className="border-b border-white/[.06] py-4 first:pt-0 last:border-0 last:pb-0">
                    <div className="mb-3 flex items-center gap-2.5">{clubIcon(team.name,team.color)}
                      <span className="text-[12px] font-semibold">{team.name}</span></div>
                    <Form list={team.form}/>
                    <div className="mt-3 flex flex-wrap gap-4 font-mono text-[11px] text-zinc-500">
                      <span>GF <strong className="font-semibold text-zinc-200">{number(team.goalsFor)}</strong></span>
                      <span>GA <strong className="font-semibold text-zinc-200">{number(team.goalsAgainst)}</strong></span>
                    </div>
                  </div>)}
                </div>
              </div>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-[10px] text-zinc-600">
              <span className="flex items-center gap-1.5"><ShieldCheck size={12}/> Snapshot data · editorial evidence only</span>
              <span className="font-mono">MATCH ID {selected.id}</span>
            </div>
          </>}
        </div>
      </div>}
      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/[.07] pt-5 text-[10px] text-zinc-600">
        <span>© FootyEdge · Command concept · isolated Vercel preview</span>
        <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-lime-300"/> Source-backed stats only <span className="text-zinc-800">/</span> Original production unaffected <ArrowUpRight size={12}/></span>
      </footer>
    </main>
  </div>;
}
