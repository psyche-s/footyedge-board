#!/usr/bin/env python3
"""Produce a static, source-aware FootyEdge dashboard JSON.

Source: football-data.co.uk season CSVs (goals, shots, cards, results).
Optional local verified pre-match xG CSV: league,date,home,away,home_xg,away_xg
Optional verified shot-line CSV: league,date,home,away,metric,line,projected,as_of,provider
Optional curated lineups/SGPs JSON. No automatic scraping of FBref pages or odds.
Unverified probabilities, lines, player xT, predicted XIs and quotes remain null.
Run in GitHub Actions / a data job, NOT on Vercel's request path.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re
import unicodedata
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import requests
from forecast_model import forecast_goals

LOG = logging.getLogger("footyedge")
LEAGUES = {
    "E0": ("EPL", "English Premier League", "#3d195b", "#00ff87", "Europe/London"),
    "SP1": ("LaLiga", "La Liga", "#000000", "#ef4444", "Europe/Madrid"),
    "I1": ("SerieA", "Serie A", "#002f6c", "#0093cc", "Europe/Rome"),
    "D1": ("Bundesliga", "Bundesliga", "#d3010c", "#ffffff", "Europe/Berlin"),
    "F1": ("Ligue1", "French Ligue 1", "#dae025", "#111827", "Europe/Paris"),
    "T1": ("SuperLig", "Turkish Süper Lig", "#ff3b00", "#002a54", "Europe/Istanbul"),
    "N1": ("Eredivisie", "Dutch Eredivisie", "#1a365d", "#f6ad55", "Europe/Amsterdam"),
    "P1": ("PrimeiraLiga", "Portuguese Primeira Liga", "#004b23", "#fbc02d", "Europe/Lisbon"),
}
ALIASES = {
    "man united": "manchester united", "man utd": "manchester united",
    "man city": "manchester city", "wolves": "wolverhampton wanderers",
    "spurs": "tottenham", "nottm forest": "nottingham forest",
    "inter": "inter milan", "ac milan": "milan",
    "psg": "paris saint germain", "ath madrid": "atletico madrid",
    "ath bilbao": "athletic club", "b munich": "bayern munich",
    "b dortmund": "borussia dortmund",
}
EXTRA_COLUMNS = ["Date", "Time", "HomeTeam", "AwayTeam", "FTHG", "FTAG", "FTR",
                 "HS", "AS", "HST", "AST", "HC", "AC", "HF", "AF"]


def canonical(name: object) -> str:
    text = unicodedata.normalize("NFKD", str(name or ""))
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()
    return ALIASES.get(text, text)


def stable_id(*items: object) -> str:
    return hashlib.sha1("|".join(str(x) for x in items).encode("utf-8")).hexdigest()[:12]


def to_number(value: object) -> float | None:
    result = pd.to_numeric(value, errors="coerce")
    try:
        n = float(result)
        return round(n, 3) if np.isfinite(n) else None
    except (TypeError, ValueError):
        return None


def safe_mean(values: pd.Series) -> float | None:
    numeric = pd.to_numeric(values, errors="coerce").dropna()
    return round(float(numeric.mean()), 2) if len(numeric) else None


def read_csv(uri: str, timeout: int = 25) -> pd.DataFrame:
    if re.match(r"^https?://", uri):
        if not uri.startswith("https://www.football-data.co.uk/"):
            raise ValueError("Only official football-data.co.uk URLs are accepted automatically")
        response = requests.get(uri, timeout=timeout, headers={"User-Agent": "FootyEdge-StaticPipeline/1.0"})
        response.raise_for_status()
        from io import BytesIO
        return pd.read_csv(BytesIO(response.content), on_bad_lines="skip", encoding="latin-1", low_memory=False)
    return pd.read_csv(uri, on_bad_lines="skip", low_memory=False)


def parse_datetime(date: object, tm: object, zone: str) -> datetime | None:
    if pd.isna(date):
        return None
    raw_date = str(date).strip()
    raw_time = "12:00" if pd.isna(tm) or not str(tm).strip() else str(tm).strip()
    stamp = pd.to_datetime(raw_date + " " + raw_time, dayfirst=True, errors="coerce")
    if pd.isna(stamp):
        return None
    try:
        if stamp.tzinfo is None:
            stamp = stamp.tz_localize(ZoneInfo(zone), ambiguous="NaT", nonexistent="shift_forward")
        if pd.isna(stamp):
            return None
        return stamp.tz_convert("UTC").to_pydatetime()
    except (ValueError, TypeError):
        return None


def normalize(raw: pd.DataFrame, league_code: str) -> pd.DataFrame:
    """Drop malformed records; keep upcoming fixtures with blank full-time score."""
    if league_code not in LEAGUES:
        raise ValueError("Unsupported football-data league: " + league_code)
    data = raw.copy()
    data.columns = [str(c).strip() for c in data.columns]
    for c in EXTRA_COLUMNS:
        if c not in data:
            data[c] = np.nan
    data["homeKey"] = data["HomeTeam"].map(canonical)
    data["awayKey"] = data["AwayTeam"].map(canonical)
    data["kickoff"] = [parse_datetime(row.Date, row.Time, LEAGUES[league_code][4])
                       for row in data[["Date", "Time"]].itertuples(index=False)]
    data["leagueCode"] = league_code
    data = data[data["kickoff"].notna() & data["homeKey"].ne("") & data["awayKey"].ne("")]
    data = data[data["homeKey"].ne(data["awayKey"])]
    for c in ["FTHG", "FTAG", "HS", "AS", "HST", "AST", "HC", "AC", "HF", "AF"]:
        data[c] = pd.to_numeric(data[c], errors="coerce")
        data.loc[data[c] < 0, c] = np.nan
    data["played"] = data["FTHG"].notna() & data["FTAG"].notna()
    data["key"] = data.apply(lambda r: stable_id(r["leagueCode"], r["kickoff"].date().isoformat(), r["homeKey"], r["awayKey"]), axis=1)
    # Prefer latest loaded season/fixture feed when duplicates exist.
    data = data.drop_duplicates(subset=["key"], keep="last")
    return data.sort_values("kickoff").reset_index(drop=True)


def team_history(history: pd.DataFrame, club: str, cutoff: datetime, count: int = 10) -> pd.DataFrame:
    frame = history[(history["kickoff"] < cutoff) & history["played"] &
                    ((history["homeKey"] == club) | (history["awayKey"] == club))]
    return frame.sort_values("kickoff", ascending=False).head(count)


def summarize_team(history: pd.DataFrame, club: str, kickoff: datetime) -> dict[str, Any]:
    records = team_history(history, club, kickoff)
    recent_form: list[str] = []
    scored, conceded, shots, shots_against = [], [], [], []
    for item in records.itertuples(index=False):
        home = item.homeKey == club
        gf, ga = (item.FTHG, item.FTAG) if home else (item.FTAG, item.FTHG)
        scored.append(gf)
        conceded.append(ga)
        shots.append(item.HS if home else item.AS)
        shots_against.append(item.AS if home else item.HS)
        recent_form.append("W" if gf > ga else "D" if gf == ga else "L")
    return {
        "name": next((str(r.HomeTeam if r.homeKey == club else r.AwayTeam) for r in records.itertuples(index=False)), club),
        "color": "#34d399",
        "form": recent_form[:5],
        "goalsFor": safe_mean(pd.Series(scored)),
        "goalsAgainst": safe_mean(pd.Series(conceded)),
        "shotsFor": safe_mean(pd.Series(shots)),
        "shotsAgainst": safe_mean(pd.Series(shots_against)),
        "sample": len(records),
    }


def head_to_head(history: pd.DataFrame, home: str, away: str, kickoff: datetime) -> list[dict[str, str]]:
    matches = history[(history["kickoff"] < kickoff) & history["played"] &
                      (((history["homeKey"] == home) & (history["awayKey"] == away)) |
                       ((history["homeKey"] == away) & (history["awayKey"] == home)))]
    entries = []
    for record in matches.sort_values("kickoff", ascending=False).head(5).itertuples(index=False):
        entries.append({
            "date": record.kickoff.date().isoformat(),
            "home": str(record.HomeTeam),
            "away": str(record.AwayTeam),
            "score": str(int(record.FTHG)) + "–" + str(int(record.FTAG))
        })
    return entries


def keyed_optional_csv(path: str | None) -> dict[tuple[str, str, str, str], dict[str, Any]]:
    if not path:
        return {}
    df = pd.read_csv(path)
    required = {"league", "date", "home", "away"}
    if not required.issubset(df.columns):
        raise ValueError(path + " requires columns " + ", ".join(sorted(required)))
    out = {}
    for entry in df.to_dict(orient="records"):
        stamp = pd.to_datetime(entry["date"], errors="coerce")
        if pd.isna(stamp):
            continue
        key = (str(entry["league"]), stamp.date().isoformat(), canonical(entry["home"]), canonical(entry["away"]))
        out[key] = entry
    return out


def optional_json(path: str | None) -> dict[str, Any]:
    if not path:
        return {}
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Curated data must be a match-keyed JSON object")
    return data


def generate(
    fixture_history: pd.DataFrame,
    as_of: datetime,
    horizon_days: int = 14,
    xg: dict | None = None,
    quotes: dict | None = None,
    curated: dict | None = None,
) -> dict[str, Any]:
    xg, quotes, curated = xg or {}, quotes or {}, curated or {}
    end = as_of + timedelta(days=horizon_days)
    # Historical matches cannot be advertised as future. Only fixtures starting at or after as_of.
    fixtures = fixture_history[(fixture_history["kickoff"] >= as_of) &
                               (fixture_history["kickoff"] < end) &
                               (~fixture_history["played"])].copy()
    records: list[dict[str, Any]] = []
    for row in fixtures.itertuples(index=False):
        league, title, primary, accent, _ = LEAGUES[row.leagueCode]
        h = summarize_team(fixture_history[fixture_history["leagueCode"] == row.leagueCode], row.homeKey, row.kickoff)
        a = summarize_team(fixture_history[fixture_history["leagueCode"] == row.leagueCode], row.awayKey, row.kickoff)
        h["name"], a["name"] = str(row.HomeTeam), str(row.AwayTeam)
        h["color"] = accent if accent != "#ffffff" else "#34d399"
        a["color"] = "#a1a1aa"
        match_key = (row.leagueCode, row.kickoff.date().isoformat(), row.homeKey, row.awayKey)
        external_xg = xg.get(match_key, {})
        home_xg, away_xg = to_number(external_xg.get("home_xg")), to_number(external_xg.get("away_xg"))
        home_xg = home_xg if home_xg is not None and home_xg >= 0 else None
        away_xg = away_xg if away_xg is not None and away_xg >= 0 else None
        line = quotes.get(match_key, {})
        value = None
        quoted = to_number(line.get("line"))
        predicted = to_number(line.get("projected"))
        if quoted is not None and quoted > 0 and predicted is not None and predicted >= 0 and line.get("provider") and line.get("as_of"):
            value = {"metric": str(line.get("metric", "Team shots")), "line": quoted,
                     "projected": predicted, "edge": None, "provider": str(line["provider"]), "asOf": str(line["as_of"])}
        # Forecast is based on historical completed games only; NOT measured xG.
        model_forecast = forecast_goals(fixture_history, row.leagueCode, row.homeKey, row.awayKey, row.kickoff)
        manual = curated.get(row.key, {})
        legs = manual.get("sgp", {}).get("legs", []) if isinstance(manual, dict) else []
        valid_legs = isinstance(legs, list) and len(legs) == 3 and all(isinstance(l, dict) and l.get("label") for l in legs)
        sgp = manual.get("sgp") if valid_legs and manual.get("sgp", {}).get("verified") is True else None
        xi = manual.get("lineup") if isinstance(manual, dict) else None
        if not isinstance(xi, dict) or len(xi.get("players", [])) != 11:
            xi = None
        records.append({
            "id": row.key, "league": league, "leagueName": title,
            "kickoff": row.kickoff.isoformat().replace("+00:00", "Z"),
            "status": "scheduled", "minute": None, "score": {"home": None, "away": None},
            "homeTeam": h, "awayTeam": a,
            "rating": None, "homeXG": home_xg, "awayXG": away_xg,
            "modelForecast": model_forecast,
            "projectedShots": value, "sgp": sgp,
            "h2h": head_to_head(fixture_history[fixture_history["leagueCode"] == row.leagueCode], row.homeKey, row.awayKey, row.kickoff),
            "analysis": manual.get("analysis", []) if isinstance(manual, dict) else [],
            "lineup": xi,
            "source": "football-data.co.uk + optional verified feeds"
        })
    return {
        "date": as_of.date().isoformat(),
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "Football-Data.co.uk; optional verified xG, line and curated inputs",
        "matches": records,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seasons", default="2526,2627", help="Football-data two-year season folder codes")
    parser.add_argument("--leagues", default=",".join(LEAGUES.keys()))
    parser.add_argument("--fixture-csv", action="append", default=[], help="Additional downloaded CSV (with league code via --fixture-league)")
    parser.add_argument("--fixture-league", default="E0", choices=LEAGUES)
    parser.add_argument("--xg-csv", default=None, help="Optional VERIFIED pre-match projections only")
    parser.add_argument("--shot-lines-csv", default=None, help="Optional timestamped quoted line and model projections")
    parser.add_argument("--curated-json", default=None, help="Optional match-keyed confirmed lineups/approved SGPs")
    parser.add_argument("--as-of", default=datetime.now(timezone.utc).date().isoformat(), help="YYYY-MM-DD UTC anchor")
    parser.add_argument("--days", type=int, default=14)
    parser.add_argument("--output", default="src/data/dashboard.json")
    parser.add_argument("--max-fixtures", type=int, default=120)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    codes = [x.strip() for x in args.leagues.split(",") if x.strip()]
    if not codes or any(code not in LEAGUES for code in codes):
        parser.error("Unknown league code")
    if args.days < 1 or args.max_fixtures < 1:
        parser.error("days and max-fixtures must be positive")
    frames = []
    for season in [x.strip() for x in args.seasons.split(",") if x.strip()]:
        if not re.fullmatch(r"\d{4}", season):
            parser.error("Invalid season folder")
        for code in codes:
            url = "https://www.football-data.co.uk/mmz4281/" + season + "/" + code + ".csv"
            try:
                source = normalize(read_csv(url), code)
                frames.append(source)
                LOG.info("%s %s: %d valid matches/fixtures", season, code, len(source))
            except (requests.RequestException, ValueError, pd.errors.ParserError, OSError) as exc:
                LOG.warning("Skipped %s %s: %s", season, code, exc)
    for filename in args.fixture_csv:
        frames.append(normalize(read_csv(filename), args.fixture_league))
    if not frames:
        raise SystemExit("No usable source files. Output was left untouched.")
    all_matches = pd.concat(frames, ignore_index=True)
    all_matches = all_matches.drop_duplicates("key", keep="last").sort_values("kickoff")
    day = pd.Timestamp(args.as_of)
    if pd.isna(day):
        parser.error("--as-of must be YYYY-MM-DD")
    result = generate(
        all_matches, day.to_pydatetime().replace(tzinfo=timezone.utc),
        horizon_days=args.days,
        xg=keyed_optional_csv(args.xg_csv),
        quotes=keyed_optional_csv(args.shot_lines_csv),
        curated=optional_json(args.curated_json),
    )
    result["matches"] = result["matches"][:args.max_fixtures]
    if not result["matches"]:
        raise SystemExit("No verified upcoming fixtures in these CSVs. No empty board written.")
    dest = Path(args.output)
    dest.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(result, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    temp = dest.with_suffix(".json.tmp")
    temp.write_text(text + "\n", encoding="utf-8")
    temp.replace(dest)
    LOG.info("Wrote %d matches to %s (%d bytes)", len(result["matches"]), dest, len(text.encode("utf-8")))


if __name__ == "__main__":
    main()
