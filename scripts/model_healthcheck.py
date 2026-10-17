#!/usr/bin/env python3
"""Offline Dixon-Coles dependency smoke test. No production data is read or written.

Prevents a failed package import / incompatible prediction API from being
misreported as a successfully completed daily forecast. This is NOT calibration.
"""
from __future__ import annotations
import argparse
import importlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path


def check(package=None):
    result = {
        "schema": "footyedge-model-health-v1",
        "status": "failed",
        "mode": "dependency_and_api_smoke_only",
        "calibrated": False,
        "promotedToPicks": False,
        "checks": {},
    }
    try:
        pb = package if package is not None else importlib.import_module("penaltyblog")
        result["packageVersion"] = str(getattr(pb, "__version__", "unknown"))
        goal_model = pb.models.DixonColesGoalModel
        result["checks"]["import_and_class"] = "passed"
        # A small deterministic, balanced synthetic sample checks the installed
        # binary optimizer and the prediction API. It is NEVER training data.
        clubs = ("Atlas", "Boreal", "Cedar", "Delta")
        home, away, hgoals, agoals = [], [], [], []
        for round_number in range(12):
            for i in range(4):
                for j in range(4):
                    if i == j:
                        continue
                    home.append(clubs[i])
                    away.append(clubs[j])
                    hgoals.append((i + round_number * 2 + j) % 4)
                    agoals.append((j + round_number + i * 2) % 3)
        model = goal_model(hgoals, agoals, home, away, weights=[1.0] * len(home))
        model.fit(use_gradient=True, minimizer_options={"maxiter": 700})
        if not bool(model.fitted):
            raise RuntimeError("Optimizer did not report fitted=True")
        result["checks"]["synthetic_fit"] = "passed"
        pred = model.predict("Atlas", "Boreal")
        vals = [float(x) for x in pred.home_draw_away]
        if not all(math.isfinite(v) and 0 <= v <= 1 for v in vals):
            raise ValueError("Outcome probabilities are not finite in [0,1]")
        if not math.isclose(sum(vals), 1, abs_tol=1e-6):
            raise ValueError("1X2 probabilities do not sum to one")
        if not (math.isfinite(float(pred.home_goal_expectation)) and
                math.isfinite(float(pred.away_goal_expectation))):
            raise ValueError("Expected goals not finite")
        result["checks"]["prediction_api"] = "passed"
        result["status"] = "ready"
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {str(exc)[:250]}"
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Optional CI diagnostic JSON (not an official forecast)")
    args = parser.parse_args()
    result = check()
    result["checkedAtUTC"] = datetime.now(timezone.utc).isoformat()
    out = json.dumps(result, indent=2, allow_nan=False)
    print(out)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(out + "\n", encoding="utf-8")
    return 0 if result["status"] == "ready" else 1


if __name__ == "__main__":
    raise SystemExit(main())
