#!/usr/bin/env python3
"""Historical out-of-sample domestic-league DC check; NOT historical FootyEdge picks."""
from __future__ import annotations

import argparse
import json
import math
from collections import Counter
from datetime import date, timedelta, timezone, datetime
from pathlib import Path

import shadow_dixon_coles as dc

VERSION = "dc-domestic-holdout-v0.1"
DEFAULT_CUTOFF = date(2026, 9, 12)
DEFAULT_END = date(2026, 9, 21)  # exclusive; upstream full-time scores last published ~Sep 20

def labels(row: dict) -> dict:
    hg, ag = row["hg"], row["ag"]
    return {
        "home_win": hg > ag, "draw": hg == ag, "away_win": hg < ag,
        "home_or_draw": hg >= ag, "away_or_draw": hg <= ag,
        "over_1_5": hg + ag >= 2, "under_2_5": hg + ag < 3,
        "over_2_5": hg + ag >= 3, "under_3_5": hg + ag <= 3,
        "btts_yes": hg > 0 and ag > 0, "btts_no": hg == 0 or ag == 0,
    }

def summary(rows: list[dict], key: str) -> dict:
    if not rows:
        return {"n": 0, "brier": None, "logLoss": None}
    eps = 1e-9
    brier = sum((r["pred"][key] - int(r["actual"][key])) ** 2 for r in rows) / len(rows)
    logloss = -sum(math.log(max(eps, min(1-eps,
                r["pred"][key] if r["actual"][key] else 1-r["pred"][key]))) for r in rows) / len(rows)
    return {"n": len(rows), "brier": round(brier, 6), "logLoss": round(logloss, 6)}

def build(cutoff: date, end: date, getter=dc.get_league_data, fitter=dc.fit_model) -> dict:
    if end <= cutoff or end > date.today() or (end-cutoff).days > 31:
        raise ValueError("Invalid historical holdout interval")
    output = {
        "modelVersion": VERSION, "trainedBefore": cutoff.isoformat(), "holdoutEndExclusive": end.isoformat(),
        "mode": "retrospective_holdout_not_original_footyedge_picks",
        "statement": "Training outcomes strictly predate cutoff. OpenFootball snapshot provenance is as observed today; real-time historical availability cannot be proven.",
        "leagues": {}, "evaluatedMatches": [],
    }
    for league in dc.LEAGUES:
        training, src, err = getter(league, cutoff)
        extended, _, err2 = getter(league, end)
        holdout = [r for r in extended if cutoff <= r["date"] < end]
        team_counts = Counter(t for m in training for t in (m["home"], m["away"]))
        info = {"trainingMatches": len(training), "candidateHoldout": len(holdout),
                "sourceUrls": src, "sourceErrors": err + err2, "evaluated": 0}
        output["leagues"][league] = info
        if len(training) < dc.MIN_TRAIN_MATCHES or not holdout:
            info["status"] = "insufficient_training_or_holdout"
            continue
        try:
            model = fitter(training, cutoff)
        except Exception as e:
            info["status"] = "fit_failed"
            info["error"] = type(e).__name__
            continue
        for match in holdout:
            if min(team_counts[match["home"]],team_counts[match["away"]]) < dc.MIN_TEAM_MATCHES:
                continue
            try:
                prob = dc.market_probabilities(model.predict(match["home"], match["away"]))
            except Exception:
                continue
            output["evaluatedMatches"].append({
                "league": league, "date": match["date"].isoformat(),
                "home": match["home"], "away": match["away"],
                "fullTime": [match["hg"], match["ag"]], "pred": prob, "actual": labels(match),
                "predictedResult": max(("home_win", "draw", "away_win"), key=lambda k: prob[k]),
                "actualResult": "home_win" if match["hg"]>match["ag"] else "away_win" if match["hg"]<match["ag"] else "draw",
            })
            info["evaluated"] += 1
        info["status"] = "evaluated" if info["evaluated"] else "insufficient_team_history"
    matches = output["evaluatedMatches"]
    output["results"] = {
        "n": len(matches),
        "straight1x2HitRate": round(sum(r["predictedResult"] == r["actualResult"] for r in matches) / len(matches), 6) if matches else None,
        "multiclassBrier": round(sum(sum((r["pred"][k]-int(r["actual"][k]))**2 for k in ("home_win","draw","away_win")) for r in matches)/len(matches),6) if matches else None,
        "multiclassLogLoss": round(-sum(math.log(max(1e-9,r["pred"][r["actualResult"]])) for r in matches)/len(matches),6) if matches else None,
        "markets": {k: summary(matches, k) for k in ("home_win","draw","away_win","home_or_draw","away_or_draw","over_1_5","under_2_5","over_2_5","under_3_5","btts_yes","btts_no")},
        "supportedPreviousFootyEdgePicks": 0,
        "note": "October 5/6 official saved picks were UEFA/CONCACAF national teams, outside this club-only model. Do not fabricate side-by-side historical DC picks.",
    }
    return output

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--cutoff", default=DEFAULT_CUTOFF.isoformat())
    p.add_argument("--end", default=DEFAULT_END.isoformat())
    p.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args()
    output = build(date.fromisoformat(a.cutoff), date.fromisoformat(a.end))
    dest = a.repo / "data" / "model-backtests" / f"{a.cutoff}_{a.end}.json"
    if not a.dry_run:
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists():
            print("Historical holdout file already saved. Preserving first model version.")
        else:
            dest.write_text(json.dumps(output, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print("Holdout",a.cutoff,a.end, "n=",output["results"]["n"],
          "1x2_hit_rate=",output["results"]["straight1x2HitRate"],
          "brier=",output["results"]["multiclassBrier"],
          "logloss=",output["results"]["multiclassLogLoss"])
