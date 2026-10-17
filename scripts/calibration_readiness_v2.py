#!/usr/bin/env python3
"""Conservative calibration-readiness audit of archived retrospective DC holdout.

No re-training, score fetching or immutable archive writes. A short retrospective
holdout cannot certify 85–90% pick confidence or profitable market EV.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
KEYS=("home_win","draw","away_win")


def evaluate(holdout, *, min_research_matches=400):
    if not isinstance(holdout, dict):
        raise ValueError("Missing holdout")
    fixtures=holdout.get("evaluatedMatches")
    if not isinstance(fixtures,list):
        raise ValueError("Missing verified evaluated matches")
    if holdout.get("mode") != "retrospective_holdout_not_original_footyedge_picks":
        raise ValueError("Unrecognized retrospective holdout provenance")
    bands=[{"low":0.0,"high":0.2,"n":0,"probabilitySum":0.0,"hits":0},
           {"low":0.2,"high":0.4,"n":0,"probabilitySum":0.0,"hits":0},
           {"low":0.4,"high":0.6,"n":0,"probabilitySum":0.0,"hits":0},
           {"low":0.6,"high":0.8,"n":0,"probabilitySum":0.0,"hits":0},
           {"low":0.8,"high":1.0000001,"n":0,"probabilitySum":0.0,"hits":0}]
    valid=0
    squared=0.0
    right=0
    bad=0
    for fixture in fixtures:
        try:
            pred=fixture["pred"]
            actual=fixture["actual"]
            probs=[float(pred[k]) for k in KEYS]
            labels=[int(bool(actual[k])) for k in KEYS]
            if (not all(math.isfinite(v) and 0<=v<=1 for v in probs)
                or abs(sum(probs)-1)>0.00001 or sum(labels)!=1):
                bad+=1
                continue
            idx=max(range(3),key=lambda i:probs[i])
            p=probs[idx]
            hit=int(labels[idx])
            band=next(b for b in bands if b["low"]<=p<b["high"])
            band["n"]+=1
            band["probabilitySum"]+=p
            band["hits"]+=hit
            squared+=sum((v-labels[i])**2 for i,v in enumerate(probs))
            right+=hit
            valid+=1
        except (KeyError,ValueError,TypeError,StopIteration):
            bad+=1
    reliability=[{"confidenceRange":[b["low"],min(b["high"],1.0)],
                  "n":b["n"],
                  "averageModelConfidence":round(b["probabilitySum"]/b["n"],4) if b["n"] else None,
                  "observedAccuracy":round(b["hits"]/b["n"],4) if b["n"] else None}
                 for b in bands]
    status=("not_evaluable" if valid==0 else "insufficient_sample_no_probability_certification"
            if valid<min_research_matches else "needs_independent_temporal_calibration")
    return {
      "schema":"footyedge-dc-calibration-readiness-v2",
      "modelMode":"retrospective_holdout_only",
      "scoredMatches":valid,
      "rejectedInvalidMatches":bad,
      "accuracyTop1":round(right/valid,6) if valid else None,
      "multiclassBrier":round(squared/valid,6) if valid else None,
      "bands":reliability,
      "status":status,
      "calibrated":False,
      "eligibleFor90PercentConfidenceDisplay":False,
      "eligibleForMarketEV":False,
      "minimumResearchSample":min_research_matches,
      "constraints":["Retrospective dataset does not prove source availability pre-match",
                     "Holdout is not original saved FootyEdge picks",
                     "Calibration and independent forward-time evaluation are required",
                     "Quoted sportsbook odds are required for EV, independent from probabilities"]
    }


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input",type=Path,default=ROOT/"data/model-backtests/2026-09-12_2026-09-21.json")
    p.add_argument("--output",type=Path)
    args=p.parse_args()
    result=evaluate(json.loads(args.input.read_text(encoding="utf-8")))
    payload=json.dumps(result,indent=2,sort_keys=True)+"\n"
    if args.output:
        if args.output.resolve().is_relative_to((ROOT/"data").resolve()):
            p.error("Diagnostic cannot replace archived backtests")
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(payload,encoding="utf-8")
    else:
        print(payload)


if __name__=="__main__":
    main()
