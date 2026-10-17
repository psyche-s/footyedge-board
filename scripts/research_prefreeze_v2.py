#!/usr/bin/env python3
"""Pre-freeze provenance gate for FootyEdge model research.

Purely read-only, no network access. A 'completed' GitHub workflow is NOT a
proven pre-match prediction, and current matches cannot be inferred from old
CC0 season files or a stale results source. Never edits archived research.
"""
from __future__ import annotations
import argparse
import json
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

TORONTO=ZoneInfo("America/Toronto")
LEAGUES={"eng.1","eng.2","ger.1","esp.1","ita.1","fra.1",
         "ned.1","por.1","tur.1","ksa.1","cze.1"}
ROOT=Path(__file__).resolve().parents[1]


def utc_timestamp(value):
    ts=datetime.fromisoformat(str(value).replace("Z","+00:00"))
    if ts.tzinfo is None:
        raise ValueError("Timestamp requires timezone")
    return ts.astimezone(timezone.utc)


def assess(day: date, model_time: datetime, research: dict | None,
           max_age_minutes=180) -> dict:
    if model_time.tzinfo is None:
        raise ValueError("Model time requires timezone")
    asof=model_time.astimezone(timezone.utc)
    freeze=datetime.combine(day,time(0,30),TZ)
    freeze_utc=freeze.astimezone(timezone.utc)
    blockers=[]
    coverage=[]
    if asof > freeze_utc:
        blockers.append("model_run_started_after_freeze")
    if asof.astimezone(TORONTO).date() != day:
        blockers.append("forecast_target_date_mismatch")
    if not isinstance(research,dict) or research.get("date") != day.isoformat():
        blockers.append("missing_or_wrong_date_research")
    else:
        try:
            generated=utc_timestamp(research.get("generatedAt"))
            if generated > freeze_utc:
                blockers.append("research_generated_after_freeze")
            if generated > asof:
                blockers.append("research_created_after_model_time")
            if (asof-generated).total_seconds() > max_age_minutes*60:
                blockers.append("stale_research_for_model")
        except (ValueError,TypeError):
            generated=None
            blockers.append("research_timestamp_unverified")
        fixtures=research.get("fixtures")
        if not isinstance(fixtures,list):
            blockers.append("research_fixtures_invalid")
            fixtures=[]
        unique=set()
        eligible_count=0
        for fixture in fixtures:
            if not isinstance(fixture,dict):
                blockers.append("invalid_fixture_record")
                continue
            league=fixture.get("league")
            if league not in LEAGUES:
                # Unmodeled competitions remain visible in the research base,
                # but they are not proof that our domestic DC model covers them.
                continue
            eligible_count+=1
            match_id=str(fixture.get("id") or "")
            if not match_id or (league,match_id) in unique:
                blockers.append("duplicate_or_missing_fixture_identity")
                continue
            unique.add((league,match_id))
            try:
                kickoff=utc_timestamp(fixture["date"])
                if kickoff <= asof:
                    coverage.append({"fixtureId":match_id,"league":league,
                                     "status":"not_prematch_at_model_time"})
                else:
                    coverage.append({"fixtureId":match_id,"league":league,
                                     "status":"prematch_window_candidate"})
            except (KeyError,ValueError,TypeError):
                coverage.append({"fixtureId":match_id,"league":league,
                                 "status":"invalid_kickoff"})
        if eligible_count == 0:
            blockers.append("no_supported_model_fixtures")
        elif not any(x["status"]=="prematch_window_candidate" for x in coverage):
            blockers.append("zero_prematch_eligible_fixtures")
    blockers=sorted(set(blockers))
    return {
        "schema":"footyedge-research-prefreeze-v1",
        "dateToronto":day.isoformat(),"freezeToronto":freeze.isoformat(),
        "modelAsOfUTC":asof.isoformat(),"blockers":blockers,
        "prematchEligibleFixtureCount":sum(x["status"]=="prematch_window_candidate" for x in coverage),
        "researchCandidateCount":len(coverage),
        "status":"eligible_for_shadow_training" if not blockers else "not_ready",
        "researchOnly":True,"calibrated":False,"publishPicks":False,
        "fixtureDiagnostics":coverage
    }


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--date",required=True)
    p.add_argument("--as-of",required=True)
    p.add_argument("--research",type=Path,required=True)
    p.add_argument("--output",type=Path)
    args=p.parse_args()
    day=date.fromisoformat(args.date)
    asof=utc_timestamp(args.as_of)
    try:
        research=json.loads(args.research.read_text(encoding="utf8"))
    except (OSError,ValueError):
        research=None
    result=assess(day,asof,research)
    text=json.dumps(result,indent=2,sort_keys=True)+"\n"
    if args.output:
        if args.output.resolve().is_relative_to((ROOT/"data").resolve()):
            p.error("Diagnostic report cannot overwrite canonical archived data")
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(text,encoding="utf8")
    else:
        print(text)
    return 0 if result["status"]=="eligible_for_shadow_training" else 2


if __name__=="__main__":
    raise SystemExit(main())
