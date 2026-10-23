"use client";

import { useState } from "react";
import { Activity, CircleHelp, Crosshair, Footprints, Shield } from "lucide-react";
import type { LineupData, PlayerVector } from "@/lib/types";

export type TacticalLineupProps = { lineup: LineupData | null; demo?: boolean };

function textStat(value: number | null, digits = 0) {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}
function compactName(full: string) {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? parts[0].charAt(0) + ". " + parts.slice(1).join(" ") : full;
}
function getAccent(input: string) {
  return /^#[0-9a-f]{6}$/i.test(input) ? input : "#34d399";
}
function StatDetails({ player }: { player: PlayerVector }) {
  const metrics = [
    {label: "xT", value: textStat(player.xT, 3)},
    {label: "Recoveries", value: textStat(player.recoveries)},
    {label: "Fouls", value: textStat(player.foulsCommitted)},
    {label: "SOT", value: textStat(player.shotsOnTarget)}
  ];
  return <div className="grid grid-cols-4 gap-2">
    {metrics.map((stat) => <div key={stat.label} className="min-w-0">
      <div className="text-[9px] uppercase tracking-wide text-zinc-500">{stat.label}</div>
      <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums tracking-tight text-zinc-100">{stat.value}</div>
    </div>)}
  </div>;
}

export default function TacticalLineup({lineup, demo = false}: TacticalLineupProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const players = lineup?.players ?? [];
  const activePlayer = players.find((p) => p.id === selectedId) ?? null;
  const accent = getAccent(lineup?.accentColor ?? "#34d399");
  if (!lineup || players.length !== 11) {
    return <section className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/10 px-6 py-8 text-center">
      <CircleHelp size={23} className="text-zinc-600" />
      <h3 className="text-sm font-semibold text-zinc-300">Starting XI unavailable</h3>
      <p className="max-w-sm text-xs leading-relaxed text-zinc-500">
        We will show verified projected or confirmed lineups here. Missing players and advanced tracking metrics are never estimated as facts.
      </p>
    </section>;
  }
  return (
    <section aria-label={"Tactical formation for " + lineup.teamName}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-zinc-100">{lineup.teamName}</span>
            <span className="rounded-md border border-zinc-800 px-2 py-0.5 font-mono text-[11px] tabular-nums text-zinc-400">{lineup.formation}</span>
          </div>
          <p className="mt-1 text-[10px] text-zinc-500">
            {demo ? "Illustrative example only — not a current starting XI" : lineup.confirmed ? "Confirmed lineup" : "Projected XI · unconfirmed"}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] text-zinc-500"><Activity size={12} /> Tap a player</span>
      </div>
      <div className="mx-auto w-full max-w-[550px]">
        <div className="relative aspect-[3/4] min-h-[430px] w-full overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/10" style={{boxShadow:"inset 0 0 0 1px rgba(255,255,255,.01)"}}>
          {/* Flat pitch geometry. No imagery, canvas, filter or network requests. */}
          <div className="pointer-events-none absolute inset-[5%] rounded-sm border border-zinc-600/40" />
          <div className="pointer-events-none absolute left-[5%] right-[5%] top-1/2 border-t border-zinc-600/40" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[19%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-600/40" />
          <div className="pointer-events-none absolute left-[24%] right-[24%] top-[5%] h-[15%] border-x border-b border-zinc-600/40" />
          <div className="pointer-events-none absolute left-[38%] right-[38%] top-[5%] h-[6%] border-x border-b border-zinc-600/40" />
          <div className="pointer-events-none absolute bottom-[5%] left-[24%] right-[24%] h-[15%] border-x border-t border-zinc-600/40" />
          <div className="pointer-events-none absolute bottom-[5%] left-[38%] right-[38%] h-[6%] border-x border-t border-zinc-600/40" />
          <span className="pointer-events-none absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-500/60" />
          {players.map((player) => {
            const isActive = selectedId === player.id;
            return (
              <div key={player.id} className="group absolute z-10 flex w-[21%] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
                style={{top: player.positionGrid.top, left: player.positionGrid.left}}>
                <button
                  type="button"
                  onClick={() => setSelectedId(isActive ? null : player.id)}
                  aria-pressed={isActive}
                  aria-label={player.name + ", " + player.role + ". View player statistics."}
                  className="flex h-9 w-9 items-center justify-center rounded-full border bg-zinc-950 font-mono text-xs font-bold tabular-nums text-white shadow-sm transition-transform hover:scale-110 active:scale-95 sm:h-10 sm:w-10"
                  style={{borderColor: accent, boxShadow: isActive ? "0 0 0 3px " + accent + "44" : undefined}}>
                  {player.number}
                </button>
                <span className="mt-1 w-full truncate rounded-sm bg-zinc-950/90 px-0.5 py-0.5 text-[9px] font-semibold leading-3 text-zinc-200 sm:text-[10px]">{compactName(player.name)}</span>
                <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-40 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-left shadow-xl group-hover:block group-focus-within:block">
                  <div className="mb-1 truncate text-[11px] font-semibold text-zinc-50">{player.name}</div>
                  <StatDetails player={player} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-zinc-800/60 bg-zinc-900/30 px-4 py-3">
        {activePlayer ? (
          <>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div><strong className="text-[13px] text-zinc-100">{activePlayer.name}</strong>
                <span className="ml-2 text-[11px] text-zinc-500">{activePlayer.role}</span></div>
              <span className="font-mono text-xs tabular-nums text-zinc-400">#{activePlayer.number}</span>
            </div>
            <StatDetails player={activePlayer} />
          </>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <Footprints size={14} className="text-emerald-400" />
            Select a player to inspect xT, ball recoveries, fouls and shots on target.
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-zinc-600">
        <span className="flex items-center gap-1"><Crosshair size={11} /> xT: expected threat</span>
        <span className="flex items-center gap-1"><Shield size={11} /> SOT: shots on target</span>
        <span>Metrics shown only when provided, not inferred from formation</span>
      </div>
    </section>
  );
}
