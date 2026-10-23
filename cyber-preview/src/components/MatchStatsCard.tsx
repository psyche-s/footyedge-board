"use client";

import { ChevronDown, Target, TrendingUp, Zap } from "lucide-react";
import type { MatchData } from "@/lib/types";

type Props = {
  match: MatchData;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
};

function showNumber(value: number | null | undefined, digits = 2) {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}
function kickoffLabel(match: MatchData) {
  if (match.status === "live") return match.minute != null ? String(match.minute) + "'" : "LIVE";
  if (match.status === "final") return "FT";
  const d = new Date(match.kickoff);
  return Number.isNaN(d.getTime())
    ? "TBD"
    : new Intl.DateTimeFormat("en-CA", {hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Toronto"}).format(d);
}

export default function MatchStatsCard({match, selected, expanded, onSelect}: Props) {
  const previewId = "match-expand-" + match.id;
  const rating = match.rating != null && Number.isFinite(match.rating)
    ? Math.max(0, Math.min(100, match.rating))
    : null;
  const legs = match.sgp?.verified ? (match.sgp.legs ?? []).slice(0, 3) : [];
  return (
    <article className={
      "overflow-hidden rounded-xl border transition-colors duration-200 " +
      (selected ? "border-emerald-400/50 bg-zinc-900/50" : "border-zinc-800/60 bg-zinc-900/30 hover:border-zinc-700")
    }>
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={expanded}
        aria-controls={previewId}
        aria-label={"Select and expand " + match.homeTeam.name + " versus " + match.awayTeam.name}
        className="block w-full px-3.5 py-3.5 text-left sm:px-4"
      >
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full border border-white/10"
                style={{backgroundColor: match.homeTeam.color}} />
              <span className="truncate text-[13px] font-semibold leading-tight tracking-tight text-zinc-100">
                {match.homeTeam.name}
              </span>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full border border-white/10"
                style={{backgroundColor: match.awayTeam.color}} />
              <span className="truncate text-[13px] font-semibold leading-tight tracking-tight text-zinc-100">
                {match.awayTeam.name}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={
              "rounded-md border px-1.5 py-1 text-[11px] font-semibold font-mono tabular-nums tracking-tight " +
              (match.status === "live" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-zinc-800 text-zinc-300")
            }>
              {kickoffLabel(match)}
            </span>
            <span className={"text-zinc-500 transition-transform duration-200 " + (expanded ? "rotate-180" : "")}><ChevronDown size={15} aria-hidden="true" /></span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-emerald-400/80 transition-all duration-300"
              style={{width: String(rating ?? 0) + "%"}} />
          </div>
          <span className="min-w-[50px] text-right font-mono text-[11px] font-semibold tabular-nums tracking-tight text-zinc-300">
            {rating == null ? "N/A" : String(Math.round(rating)) + "/100"}
          </span>
        </div>
        <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-zinc-600">
          Research strength · not win probability
        </div>
      </button>
      <div id={previewId} aria-hidden={!expanded}
        className={"grid transition-[grid-template-rows,opacity] duration-300 ease-in-out " +
          (expanded ? "grid-rows-[1fr] border-t border-zinc-800/60 opacity-100" : "grid-rows-[0fr] opacity-0")}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-4 px-3.5 py-4 sm:px-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="border-r border-zinc-800/60">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Verified xG</div>
                  <div className="mt-1 font-mono text-lg font-semibold tabular-nums tracking-tight">
                    {showNumber(match.homeXG)} <span className="text-xs text-zinc-600">:</span> {showNumber(match.awayXG)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Recent goals / game</div>
                  <div className="mt-1 font-mono text-lg font-semibold tabular-nums tracking-tight">
                    {showNumber(match.homeTeam.goalsFor, 1)} <span className="text-xs text-zinc-600">:</span> {showNumber(match.awayTeam.goalsFor, 1)}
                  </div>
                </div>
              </div>
              <section>
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                  <Target className="text-emerald-400" size={14} />
                  <span className="font-semibold">Projected shots vs. quoted line</span>
                </div>
                {match.projectedShots && match.projectedShots.line > 0 ? (
                  <div className="mt-2">
                    <div className="flex justify-between gap-2 text-[11px] font-mono tabular-nums text-zinc-400">
                      <span>{match.projectedShots.metric} · line {showNumber(match.projectedShots.line, 1)}</span>
                      <span>{showNumber(match.projectedShots.projected, 1)} projected</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                      <div className="h-full rounded-full bg-emerald-400"
                        style={{width: String(Math.min(100, Math.max(0, 100 * match.projectedShots.projected / (match.projectedShots.line * 2)))) + "%"}} />
                    </div>
                    <p className="mt-1.5 text-[10px] text-zinc-500">As of {match.projectedShots.asOf ?? "source timestamp unavailable"}. A higher projection is not a calibrated betting edge.</p>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">No verified live line and shot projection available.</p>
                )}
              </section>
              <section className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-100">
                    <Zap size={14} className="text-emerald-400" /> 3-leg SGP
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-emerald-400">
                    {match.sgp?.verified ? (match.sgp.totalOdds || "Odds N/A") : "NOT VERIFIED"}
                  </span>
                </div>
                {legs.length === 3 ? (
                  <ol className="space-y-2">
                    {legs.map((leg, i) => (
                      <li key={i} className="flex gap-2 text-[11px] text-zinc-300">
                        <span className="font-mono text-emerald-400">{String(i + 1).padStart(2, "0")}</span>
                        <span>{leg.label}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-[11px] leading-relaxed text-zinc-500">
                    A supported 3-leg slip has not been verified for this fixture.
                  </p>
                )}
                <div className="mt-3 flex justify-between border-t border-zinc-800/60 pt-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  <span>Whole-slip confidence</span>
                  <span className="text-zinc-300">{match.sgp?.verified && match.sgp.confidence != null ? showNumber(match.sgp.confidence, 0) + "%" : "N/A"}</span>
                </div>
              </section>
              {(match.analysis?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300">
                    <TrendingUp size={13} className="text-emerald-400" /> Current research
                  </div>
                  {match.analysis?.slice(0, 3).map((pick, i) => (
                    <div className="text-[11px] text-zinc-400" key={i}>
                      <span className="text-zinc-200">{pick.label}</span>
                      {pick.reason && <p className="mt-0.5 leading-relaxed text-zinc-500">{pick.reason}</p>}
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>
    </article>
  );
}
