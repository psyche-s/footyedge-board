#!/usr/bin/env python3
"""Read-only, pre-match Dixon-Coles shadow forecasts. Never feeds the public board."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

VERSION = "dc-shadow-v0.3"
SOURCE_ROOT = "https://raw.githubusercontent.com/openfootball/football.json/master"
# Explicit men's top-flight scope. International/cup and women's matches are NOT modeled.
LEAGUES = {
    "eng.1": "en.1", "ger.1": "de.1", "esp.1": "es.1",
    "ita.1": "it.1", "fra.1": "fr.1", "ned.1": "nl.1",
    "por.1": "pt.1",
}
MIN_TRAIN_MATCHES = 90
MIN_TEAM_MATCHES = 4
MAX_SOURCE_AGE_DAYS = 30
DECAY_XI = 0.001  # experimental baseline; NOT optimized or calibrated
TORONTO = ZoneInfo("America/Toronto")
# Auditable exact aliases only; avoid fuzzy mismatches across teams.
ALIASES = {
    "man city": "manchester city",
    "man utd": "manchester united",
    "man united": "manchester united",
    "psg": "paris saint germain",
    "psv eindhoven": "psv",
    "inter milan": "internazionale",
    "bayern munich": "bayern munchen",
    "bayern munchen": "bayern munchen",
    "borussia monchengladbach": "borussia monchengladbach",
    # Official source labels verified against OpenFootball 2026-27 club lists.
    "espanyol": "rcd espanyol de barcelona",
    "lens": "racing club de lens",
    "lyon": "olympique lyonnais",
    "werder bremen": "sv werder bremen",
    "heerenveen": "sc heerenveen",
    "braga": "sporting clube de braga",
    "sporting cp": "sporting clube de portugal",
}

def key(name: str) -> str:
    name = unicodedata.normalize("NFKD", str(name)).encode("ascii", "ignore").decode().lower()
    name = name.replace("&", "and").replace("st.", "saint")
    name = re.sub(r"[^a-z0-9 ]+", " ", name)
    parts = [p for p in name.split() if p]
    # Only remove known organizational suffixes, not distinctive team names.
    while parts and parts[-1] in ("fc", "afc", "cf", "sc"):
        parts.pop()
    normalized = " ".join(parts)
    return ALIASES.get(normalized, normalized)

def season_codes(day: date) -> list[str]:
    start_year = day.year if day.month >= 7 else day.year - 1
    return [f"{start_year - 1}-{str(start_year)[-2:]}",
            f"{start_year}-{str(start_year + 1)[-2:]}"]

def completed_matches(payload: dict, cutoff: date) -> list[dict]:
    """Only games with known full-time scores strictly BEFORE cutoff."""
    result = []
    for item in payload.get("matches", []):
        try:
            played = date.fromisoformat(item["date"])
            if played >= cutoff:
                continue
            score = item.get("score")
            ft = score.get("ft") if isinstance(score, dict) else score
            if not isinstance(ft, list) or len(ft) != 2:
                continue
            h, a = ft
            if type(h) is not int or type(a) is not int or min(h, a) < 0 or max(h, a) > 20:
                continue
            home, away = key(item["team1"]), key(item["team2"])
            if not home or not away or home == away:
                continue
            result.append({"date": played, "home": home, "away": away, "hg": h, "ag": a})
        except (KeyError, TypeError, ValueError):
            continue
    return result

def fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "FootyEdgeResearch/0.1",
                                               "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=25) as response:
        return json.load(response)

def get_league_data(league: str, cutoff: date, fetch=fetch_json) -> tuple[list[dict], list[str], list[str]]:
    matches, fetched, errors = [], [], []
    for season in season_codes(cutoff):
        url = f"{SOURCE_ROOT}/{season}/{LEAGUES[league]}.json"
        try:
            payload = fetch(url)
            matches.extend(completed_matches(payload, cutoff))
            fetched.append(url)
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError, OSError) as exc:
            errors.append(f"{season}: {type(exc).__name__}")
    # Avoid duplicate match rows within the same league (source revisions and overlaps).
    uniq = {(x["date"], x["home"], x["away"]): x for x in matches}
    return sorted(uniq.values(), key=lambda x: (x["date"], x["home"], x["away"])), fetched, errors

def fit_model(matches: list[dict], cutoff: date):
    """Fit official penaltyblog Dixon-Coles with explicit exponential recency weights."""
    import penaltyblog as pb
    weights = [math.exp(-DECAY_XI * (cutoff - x["date"]).days) for x in matches]
    model = pb.models.DixonColesGoalModel(
        [x["hg"] for x in matches],
        [x["ag"] for x in matches],
        [x["home"] for x in matches],
        [x["away"] for x in matches],
        weights=weights,
    )
    model.fit(use_gradient=True, minimizer_options={"maxiter": 1500})
    if not model.fitted:
        raise RuntimeError("Dixon-Coles optimizer did not converge")
    return model

def market_probabilities(pred) -> dict:
    h, d, a = map(float, pred.home_draw_away)
    u15, _, o15 = pred.totals(1.5)
    u25, _, o25 = pred.totals(2.5)
    u35, _, o35 = pred.totals(3.5)
    probs = {
        "home_win": h, "draw": d, "away_win": a,
        "home_or_draw": h + d, "away_or_draw": a + d,
        "over_1_5": float(o15), "under_2_5": float(u25),
        "over_2_5": float(o25), "under_3_5": float(u35),
        "btts_yes": float(pred.btts_yes), "btts_no": float(pred.btts_no),
    }
    if not all(math.isfinite(v) and 0 <= v <= 1 for v in probs.values()):
        raise ValueError("Non-finite or out-of-range model probability")
    if abs(h + d + a - 1) > 1e-6 or abs(probs["btts_yes"] + probs["btts_no"] - 1) > 1e-6:
        raise ValueError("Model normalization failed")
    if abs(float(u15) + float(o15) - 1) > 1e-6 or abs(float(u35) + float(o35) - 1) > 1e-6:
        raise ValueError("Totals normalization failed")
    return {k: round(v, 6) for k, v in probs.items()}

def forecast_day(root: Path, day: date, asof: datetime, fetch=fetch_json, fitter=fit_model) -> dict:
    path = root / "data" / f"research-base-{day.isoformat()}.json"
    output = {
        "date": day.isoformat(), "asOf": asof.isoformat(), "modelVersion": VERSION,
        "mode": "shadow_only", "promotedToPicks": False,
        "assumptions": {"decayXiPerDay": DECAY_XI, "minTrainingMatches": MIN_TRAIN_MATCHES,
                        "minTeamMatches": MIN_TEAM_MATCHES, "maxDataAgeDays": MAX_SOURCE_AGE_DAYS},
        "source": "OpenFootball public-domain match results (not xG or live odds)",
        "fixtures": [], "leagueDiagnostics": {},
    }
    if not path.exists():
        output["status"] = "missing_research_base"
        return output
    research_bytes = path.read_bytes()
    slate = json.loads(research_bytes.decode("utf-8"))
    output["researchInputSha256"] = hashlib.sha256(research_bytes).hexdigest()
    output["researchGeneratedAt"] = slate.get("generatedAt")
    stamp = slate.get("generatedAt")
    if stamp:
        try:
            parsed = datetime.fromisoformat(str(stamp).replace("Z", "+00:00"))
            if parsed.tzinfo is None or parsed > asof + timedelta(minutes=5):
                output["status"] = "research_timestamp_invalid"
                return output
            output["researchAgeHours"] = round((asof - parsed).total_seconds() / 3600, 3)
            if output["researchAgeHours"] > 36:
                output["status"] = "stale_research_base"
                return output
        except (ValueError, TypeError):
            output["status"] = "research_timestamp_invalid"
            return output
    if slate.get("date") != day.isoformat():
        raise ValueError("Research base date does not match requested date")
    games = slate.get("fixtures", [])
    eligible = [g for g in games if g.get("league") in LEAGUES
                and not any("(w)" in str(g.get(x, {}).get("name", "")).lower() for x in ("home", "away"))]
    output["status"] = "completed"
    output["unmodeledFixtureCount"] = len(games) - len(eligible)
    for league in sorted({g["league"] for g in eligible}):
        games_here = [g for g in eligible if g["league"] == league]
        # Source is static match-result data. A pre-match prediction must not use results
        # from the fixture's calendar date, nor results beyond the as-of date.
        first_cutoff = min(day, asof.date())
        rows, urls, errors = get_league_data(league, first_cutoff, fetch)
        count = Counter(t for x in rows for t in (x["home"], x["away"]))
        recent = max((x["date"] for x in rows), default=None)
        age = (first_cutoff - recent).days if recent else None
        quality = (len(rows) >= MIN_TRAIN_MATCHES
                   and age is not None and age <= MAX_SOURCE_AGE_DAYS)
        info = {"trainingMatches": len(rows), "latestResultDate": recent.isoformat() if recent else None,
                "resultAgeDays": age, "sourceUrls": urls, "sourceErrors": errors,
                "status": "ready" if quality else "insufficient_or_stale_data"}
        output["leagueDiagnostics"][league] = info
        model = None
        if quality:
            try:
                model = fitter(rows, first_cutoff)
            except Exception as exc:
                info["status"] = "fit_failed"
                info["error"] = f"{type(exc).__name__}: {str(exc)[:120]}"
        for g in games_here:
            h, a = key(g["home"]["name"]), key(g["away"]["name"])
            entry = {"fixtureId": str(g["id"]), "league": league, "kickoff": g.get("date"),
                     "home": g["home"]["name"], "away": g["away"]["name"]}
            kickoff = None
            try:
                kickoff = datetime.fromisoformat(str(g["date"]).replace("Z", "+00:00"))
            except (KeyError, TypeError, ValueError):
                pass
            if kickoff is None or kickoff.tzinfo is None:
                entry["status"] = "invalid_kickoff"
            elif kickoff <= asof:
                entry["status"] = "already_started"
            elif model is None:
                entry["status"] = info["status"]
            elif count[h] < MIN_TEAM_MATCHES or count[a] < MIN_TEAM_MATCHES:
                entry["status"] = "unknown_or_undersampled_team"
                entry["teamKeys"] = [h, a]
            else:
                try:
                    pred = model.predict(h, a)
                    entry["status"] = "shadow_prediction"
                    entry["probabilities"] = market_probabilities(pred)
                    entry["expectedGoals"] = {"home": round(float(pred.home_goal_expectation), 4),
                                              "away": round(float(pred.away_goal_expectation), 4)}
                    entry["trainingMatches"] = len(rows)
                except Exception as exc:
                    entry["status"] = "prediction_error"
                    entry["error"] = f"{type(exc).__name__}: {str(exc)[:120]}"
            output["fixtures"].append(entry)
    output["coverage"] = {"inputFixtures": len(games), "eligibleLeagueFixtures": len(eligible),
                          "predicted": sum(g["status"] == "shadow_prediction" for g in output["fixtures"])}
    return output

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", help="Toronto YYYY-MM-DD; default today")
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--as-of", help="UTC ISO-8601 time (for reproducible tests)")
    parser.add_argument("--dry-run", action="store_true", help="Compute from sources without modifying immutable archives")
    parser.add_argument("--capture-candidate", action="store_true", help="Archive separate pre-match v0.3 candidate for future scoring")
    args = parser.parse_args()
    asof = (datetime.fromisoformat(args.as_of.replace("Z", "+00:00"))
            if args.as_of else datetime.now(timezone.utc))
    if asof.tzinfo is None:
        parser.error("--as-of must contain a timezone")
    day = date.fromisoformat(args.date) if args.date else asof.astimezone(TORONTO).date()
    if day < asof.astimezone(TORONTO).date():
        parser.error("Historical dates must not be backfilled as original pre-match forecasts")
    dest = args.repo / "data" / "model-shadow" / f"{day.isoformat()}.json"
    candidate = args.repo / "data" / "model-candidates" / f"{day.isoformat()}.json"
    if args.dry_run:
        result = forecast_day(args.repo, day, asof)
        print(f"Shadow dry run: {day} status={result['status']} "
              f"coverage={result.get('coverage')}")
        return 0
    need_original = not dest.exists()
    need_candidate = args.capture_candidate and not candidate.exists()
    if not need_original and not need_candidate:
        print(f"Immutable original and candidate unchanged: {day}")
        return 0
    result = forecast_day(args.repo, day, asof)
    if result["status"] != "completed":
        print(f"Research incomplete; no original or candidate archived: {result['status']}")
        return 0
    if need_original:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        print(f"Original shadow archived: {dest}")
    if need_candidate:
        candidate.parent.mkdir(parents=True, exist_ok=True)
        candidate.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        print(f"Separate pre-match candidate archived: {candidate}")
    print(f"Shadow: {day} coverage={result.get('coverage')} status={result['status']}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
