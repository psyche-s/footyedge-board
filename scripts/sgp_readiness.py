#!/usr/bin/env python3
"""Read-only SGP readiness audit of an immutable FootyEdge board.

Research grades are NOT win probabilities. Never multiplies odds, invents EV,
marks an SGP bookable, or writes back to the immutable board.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path


def group(label):
    s = str(label or "").lower()
    if "both teams" in s or "btts" in s:
        return "btts"
    if "over " in s or "under " in s:
        return "goal_total" if "goal" in s or s.startswith(("over ", "under ")) else "other"
    if "double chance" in s or " or draw" in s or s in ("1x", "x2"):
        return "result_cover"
    if "1+ goal" in s or "to score" in s:
        return "team_goal"
    if "shot" in s or "sot" in s:
        return "player_shot"
    if "assist" in s:
        return "player_assist"
    return "other"


def overlap(markets):
    groups = [group(x) for x in markets]
    out = []
    if groups.count("goal_total") > 1:
        out.append("overlapping_total_lines")
    if "btts" in groups and "goal_total" in groups:
        out.append("btts_correlates_with_total_goals")
    if "team_goal" in groups and "goal_total" in groups:
        out.append("team_goal_correlates_with_match_total")
    if "team_goal" in groups and "btts" in groups:
        out.append("team_goal_implied_by_btts")
    if "result_cover" in groups and "team_goal" in groups:
        out.append("outcome_can_correlate_with_team_goal")
    return out


def analyze(board):
    games = board.get("games", [])
    report = {
        "schema": "footyedge-sgp-readiness-v1",
        "date": board.get("date"),
        "boardImmutable": board.get("immutable") is True,
        "mode": "research_only",
        "readyToPublish": False,
        "calibrated": False,
        "combinedOdds": None,
        "ev": None,
        "games": [],
    }
    for game in games:
        if not isinstance(game, dict) or not game.get("id"):
            continue
        # Top 3 ranked choices are potential RESEARCH angles, never an SGP price.
        picks = [p for p in (game.get("top3") or []) if isinstance(p, dict) and p.get("label")][:3]
        marked = []
        for pick in picks:
            verified = pick.get("verifiedPrice") is True and bool(pick.get("displayOdds"))
            marked.append({
                "market": pick["label"],
                "researchRating": pick.get("confidenceRating"),
                "researchOnly": True,
                "odds": pick.get("displayOdds") if verified else None,
                "provider": pick.get("provider") if verified else None,
                "probability": pick.get("calibratedProbability") if pick.get("probabilityCalibrated") is True else None,
            })
        labels = [x["market"] for x in marked]
        issues = overlap(labels)
        if len(marked) < 2:
            issues.append("not_enough_legs")
        if any(not x["odds"] for x in marked):
            issues.append("missing_verified_single_lines")
        if any(x["probability"] is None for x in marked):
            issues.append("missing_calibrated_probabilities")
        # A sportsbook-issued combined SGP quote is required even if every leg
        # has an independently verified single quote.
        issues.append("missing_bookmaker_combined_quote")
        report["games"].append({
            "id": str(game["id"]),
            "home": game.get("home"),
            "away": game.get("away"),
            "candidateLegs": marked,
            "overlapFlags": overlap(labels),
            "blockers": issues,
            "status": "research_candidates_only" if len(marked) >= 2 else "insufficient_candidates",
            "bookable": False,
        })
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--board", type=Path, required=True)
    parser.add_argument("--output", type=Path, help="Write a diagnostic, never the source board")
    args = parser.parse_args()
    src = json.loads(args.board.read_text(encoding="utf-8"))
    report = analyze(src)
    out = json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    if args.output:
        if args.output.resolve() == args.board.resolve():
            parser.error("--output must not replace the immutable board")
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(out, encoding="utf-8")
    else:
        print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
