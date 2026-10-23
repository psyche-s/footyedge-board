"""Deterministic, historical-results goal forecast for FootyEdge previews.

Does NOT manufacture measured xG, calibrated win probabilities, sportsbook prices or picks.
Uses home/away venue splits, exponential recency weights and Bayesian-style shrinkage.
Only emits when sufficient prior results exist. All numerical outputs are model ESTIMATES.
"""
from __future__ import annotations

from datetime import datetime
from math import exp, factorial, log
from typing import Any

import numpy as np
import pandas as pd

MODEL_VERSION = "goals-poisson-shrinkage-v1"
MIN_LEAGUE_GAMES = 40
MIN_TEAM_VENUE_GAMES = 5
HALF_LIFE_DAYS = 210.0
PRIOR_WEIGHT_GAMES = 7.0


def _weighted_mean(values: pd.Series, dates: pd.Series, cutoff: datetime, fallback: float) -> float:
    """Recency-weighted average that ignores NaN and never sees games at/after kickoff."""
    numeric = pd.to_numeric(values, errors="coerce")
    timestamps = pd.to_datetime(dates, utc=True, errors="coerce")
    age = (pd.Timestamp(cutoff).tz_convert("UTC") - timestamps).dt.total_seconds() / 86400
    valid = numeric.notna() & age.notna() & (age > 0) & (numeric >= 0)
    if not valid.any():
        return float(fallback)
    weights = np.exp(-log(2.0) * age.loc[valid].to_numpy(dtype=float) / HALF_LIFE_DAYS)
    return float(np.average(numeric.loc[valid].to_numpy(dtype=float), weights=weights))


def _shrunken_mean(values: pd.Series, dates: pd.Series, cutoff: datetime, prior: float) -> float:
    numeric = pd.to_numeric(values, errors="coerce")
    timestamps = pd.to_datetime(dates, utc=True, errors="coerce")
    age = (pd.Timestamp(cutoff).tz_convert("UTC") - timestamps).dt.total_seconds() / 86400
    valid = numeric.notna() & age.notna() & (age > 0) & (numeric >= 0)
    if not valid.any():
        return float(prior)
    weights = np.exp(-log(2.0) * age.loc[valid].to_numpy(dtype=float) / HALF_LIFE_DAYS)
    effective = float(weights.sum())
    weighted_total = float(np.dot(weights, numeric.loc[valid].to_numpy(dtype=float)))
    return (weighted_total + PRIOR_WEIGHT_GAMES * prior) / (effective + PRIOR_WEIGHT_GAMES)


def _poisson_pmf(lam: float, maximum: int = 12) -> np.ndarray:
    """Truncated score grid, normalized so all outcome probabilities sum to 1."""
    k = np.arange(maximum + 1)
    probabilities = np.array([exp(-lam) * lam ** int(n) / factorial(int(n)) for n in k])
    return probabilities / probabilities.sum()


def forecast_goals(
    history: pd.DataFrame, league: str, home_key: str, away_key: str, kickoff: datetime
) -> dict[str, Any] | None:
    """Return an *uncalibrated* baseline only after prior-date, venue-specific sample checks.

    Note: independent Poisson goals ignore red cards, rotation, injuries, correlation,
    lineups and schedule context. Do not treat the output as betting confidence.
    """
    if kickoff.tzinfo is None:
        raise ValueError("kickoff must be timezone-aware")
    prior = history[
        (history["leagueCode"] == league) &
        history["played"].eq(True) &
        (history["kickoff"] < kickoff)
    ].copy()
    prior = prior.dropna(subset=["FTHG", "FTAG", "kickoff"])
    if len(prior) < MIN_LEAGUE_GAMES:
        return None
    home_games = prior[prior["homeKey"] == home_key]
    away_games = prior[prior["awayKey"] == away_key]
    if len(home_games) < MIN_TEAM_VENUE_GAMES or len(away_games) < MIN_TEAM_VENUE_GAMES:
        return None
    league_home = _weighted_mean(prior["FTHG"], prior["kickoff"], kickoff, 1.4)
    league_away = _weighted_mean(prior["FTAG"], prior["kickoff"], kickoff, 1.1)
    if league_home <= 0.1 or league_away <= 0.1:
        return None
    home_attack = _shrunken_mean(home_games["FTHG"], home_games["kickoff"], kickoff, league_home) / league_home
    away_defense = _shrunken_mean(away_games["FTHG"], away_games["kickoff"], kickoff, league_home) / league_home
    away_attack = _shrunken_mean(away_games["FTAG"], away_games["kickoff"], kickoff, league_away) / league_away
    home_defense = _shrunken_mean(home_games["FTAG"], home_games["kickoff"], kickoff, league_away) / league_away

    home_lambda = float(np.clip(league_home * home_attack * away_defense, 0.25, 3.25))
    away_lambda = float(np.clip(league_away * away_attack * home_defense, 0.25, 3.25))
    home_pmf, away_pmf = _poisson_pmf(home_lambda), _poisson_pmf(away_lambda)
    grid = np.outer(home_pmf, away_pmf)
    p_home = float(np.tril(grid, k=-1).sum())  # row = home goals; lower triangle = home > away
    p_away = float(np.triu(grid, k=1).sum())
    p_draw = float(np.trace(grid))
    total_lambda = home_lambda + away_lambda
    p_over25 = 1.0 - exp(-total_lambda) * (1.0 + total_lambda + 0.5 * total_lambda ** 2)

    return {
        "homeLambda": round(home_lambda, 2),
        "awayLambda": round(away_lambda, 2),
        "homeWin": round(p_home * 100, 1),
        "draw": round(p_draw * 100, 1),
        "awayWin": round(p_away * 100, 1),
        "over25": round(p_over25 * 100, 1),
        "sample": {
            "league": int(len(prior)),
            "homeVenue": int(len(home_games)),
            "awayVenue": int(len(away_games))
        },
        "version": MODEL_VERSION,
        "calibrated": False,
        "kind": "historical-results-model-estimate"
    }


def two_way_no_vig_implied(decimal_for: float, decimal_against: float) -> float | None:
    """Return no-vig implied probability in [0, 1] for verified two-way quotes.

    This is arithmetic, not a model calibration or recommendation.
    """
    if (not np.isfinite(decimal_for) or not np.isfinite(decimal_against) or
            decimal_for <= 1.0 or decimal_against <= 1.0):
        return None
    raw_for = 1.0 / decimal_for
    raw_against = 1.0 / decimal_against
    return raw_for / (raw_for + raw_against)


def model_edge_pp(model_probability_percent: float, no_vig_market_probability: float) -> float | None:
    """Probability difference in percentage points, NOT ROI or a guarantee of value."""
    if (not np.isfinite(model_probability_percent) or
            not np.isfinite(no_vig_market_probability) or
            not 0 <= model_probability_percent <= 100 or
            not 0 <= no_vig_market_probability <= 1):
        return None
    return round(model_probability_percent - 100.0 * no_vig_market_probability, 2)
