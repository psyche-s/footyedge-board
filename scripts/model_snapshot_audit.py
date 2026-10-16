#!/usr/bin/env python3
"""Read-only validator for archived FootyEdge Dixon–Coles shadow snapshots.

A GitHub Actions job marked 'success' or a snapshot marked 'completed' does
NOT imply a valid, timely or calibrated prediction.
"""
from __future__ import annotations
import argparse
import json
from datetime import datetime, time, timezone, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
TORONTO=ZoneInfo("America/Toronto")


def inspect_snapshot(snapshot: dict):
    date=datetime.strptime(snapshot["date"], "%Y-%m-%d").date()
    freeze=datetime.combine(date, time(0,30),tzinfo=TORONTO)
    blockers=[]
    stamp=snapshot.get("asOf")
    try:
        asof=datetime.fromisoformat(stamp.replace("Z","+00:00"))
        if asof.tzinfo is None:
            raise ValueError("missing timezone")
        asof=asof.astimezone(timezone.utc)
        if asof > freeze.astimezone(timezone.utc):
            blockers.append("forecast_generated_after_official_freeze")
    except (AttributeError,ValueError,TypeError):
        asof=None
        blockers.append("invalid_as_of")
    coverage=snapshot.get("coverage") or {}
    predicted=int(coverage.get("predicted",0))
    eligible=int(coverage.get("eligibleLeagueFixtures",0))
    observed=sum(1 for x in snapshot.get("fixtures",[]) if x.get("status")=="predicted")
    if predicted<=0 or observed<=0:
        blockers.append("no_actual_forecasts")
    if predicted!=observed:
        blockers.append("coverage_prediction_count_mismatch")
    if predicted<eligible:
        blockers.append("incomplete_eligible_fixture_coverage")
    if snapshot.get("promotedToPicks") is not False:
        blockers.append("unsafe_promotion_flag")
    diagnostics=snapshot.get("leagueDiagnostics") or {}
    fails=sorted({x.get("error","unknown") for x in diagnostics.values()
                  if isinstance(x,dict) and x.get("status")=="fit_failed"})
    if fails:
        blockers.append("one_or_more_leagues_failed_model_fit")
    status="no_forecasts" if predicted==0 else "partial_or_unvalidated" if blockers else "model_execution_only"
    return {
        "schema":"footyedge-shadow-snapshot-audit-v1",
        "fixtureDateToronto":snapshot.get("date"),
        "snapshotWorkflowStatus":snapshot.get("status"),
        "actualForecastStatus":status,
        "forecastAsOfUTC":asof.isoformat() if asof else None,
        "officialFreezeToronto":freeze.isoformat(),
        "eligibleFixtures":eligible,
        "predictedFixtures":predicted,
        "failedFitMessages":fails[:10],
        "blockers":blockers,
        "calibrated":False,
        "eligibleForPublication":False,
        "originalSnapshotUnchanged":True,
    }


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--snapshot",type=Path,required=True)
    p.add_argument("--out",type=Path)
    a=p.parse_args()
    value=inspect_snapshot(json.loads(a.snapshot.read_text(encoding="utf8")))
    data=json.dumps(value,indent=2,allow_nan=False)+"\n"
    if a.out:
        if a.out.resolve().is_relative_to((ROOT/"data").resolve()):
            p.error("write report outside data/ to preserve historical snapshots")
        a.out.parent.mkdir(parents=True,exist_ok=True)
        a.out.write_text(data,encoding="utf8")
    else:
        print(data)


if __name__=="__main__":
    main()
