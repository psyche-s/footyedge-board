# FootyEdge Original — Projections and 10K Simulation Contract

**Scope:** Original `psyche-s/footyedge-board`; **V2 remains manual-only**.

## User-visible Projections layout

The existing expanded match's **Projections** tab uses FootyEdge's dark green theme:

1. Experimental model label, source/coverage honesty, and **most likely exact score** tile with that exact score's simulation frequency.
2. Projected **home and away goals**.
3. The unchanged three-segment **Home Win | Draw | Away Win** bar; its percentages must sum to 100.
4. BTTS and goal-total probability tiles.
5. **Projected Team Stats** mirrored home/away: goals, corners, shots, SOT, yellow cards, fouls, tackles and passes *only when sampled from verified, source-matched data*; otherwise the category is absent.
6. **Match Totals**: estimated event totals and supported over-line frequencies; do not render unavailable event families as zeros.
7. **Formation Matchup**: home/away projected/confirmed XI on a pitch, appropriately labelled, with player headshots where permitted. No invented XI.
8. **Player Foul Projections** from independently sourced, five *completed, pre-kickoff* match logs, and **Matchup Research** notes. Show an explicit evidence-gap message when unsupported.

The published `ui/part2.html` loads the date-matched `data/experimental-simulations/YYYY-MM-DD-v3.json`, falling back to v2 and v1, and uses the original `assets/footyedge-match-v3.css` W/D/L styling.

## Forecast inputs and actual coefficients

The code of record is `scripts/simulate-fixtures.mjs` (baseline) followed by `scripts/simulate-matchups-v3.mjs`. These are **research-only, uncalibrated** forecasts, not official picks, not fair odds and not validated bets.

### Baseline V2

- Look at **up to 10 verified completed pre-kickoff matches** per team. Matches 1–5 receive a weight of **1.4**, older 6–10 a weight of **1.0**; home matches get a **1.07** multiplier in the baseline history summary.
- For missing/short histories, the prior is the league historical goals-per-team-match baseline (clamped **1.05–1.9**, default **1.4**), shrunk with **five prior equivalent matches**: `(observed_rate*n + league_baseline*5)/(n+5)`.
- Starting expected-goal rates: `sqrt(home_attack*away_conceded)*1.10`, `sqrt(away_attack*home_conceded)*0.94`; capped to defensible finite ranges.
- Verified current-season standing strength: **0.23 × PPG differential**, plus **0.08 × per-match goal-difference differential** if present, damped by `min(played)/(min(played)+9)`, capped to a **±0.22 goal log-rate** difference.
- Verified matched shots-on-target modifier, when samples ≥8: power **0.08**, capped to **0.95–1.05** multiplier.
- Verified xG, when available: **85%** baseline expected goals and **15%** measured xG. Never infer xG from ordinary goals.
- Prior direct meetings: **3% blend** if at least three verified meetings. This is a baseline input; V3 applies an additional capped *recent-year* modifier when eligible.

### V3 opponent-conditioned refinements

- **Strength-of-opposition normalization:** each opponent's goals conceded per game is shrunk with **eight prior equivalent matches**, recency weighting `exp(-i/7)`. Require **≥3** verified opponent records. Apply differential log-goal adjustment with **0.065 sensitivity**, bounded before application.
- **Similar opposition:** match past opponents against the upcoming opponent's **points per game and goals allowed**, with distance `abs(PPG_delta)+0.25*abs(against_delta)` and usable distance **≤0.80**. Weight comparables by `exp(-distance/0.48)*exp(-i/8)`. Require ≥2 comparables each side. Each team's adjustment has **0.10 sensitivity** after capping relative goal change.
- **Venue:** when at least three relevant home and three away observations exist, each side's attack adjustment has **0.09 sensitivity** after normalization and capping.
- **Prior 12-month H2H:** at most the two most recent prior meetings within **366 days**. Add **1.5%** blend to adjusted goal rates. Larger H2H history remains part of the baseline only.
- **Verified SOT strength:** **0.035 log sensitivity**, capped at ±0.05.
- **Verified opponent shots allowed:** **0.045 log sensitivity**, capped at ±0.05.
- **Lineup availability:** require dated projected/confirmed 11s **and** an independently sourced quantitative player impact with ≥5 verified observations. Each side's log goal-rate modifier capped at **±0.08**. A name-only injury or speculative formation **does not** justify a numerical modifier.
- **Fouls, cards, passes, tackles, corners, shots:** verified sample averages feed **separate team/event distributions** and total-event probabilities. For the event's expected team rate, use **65% own attack/volume and 35% opposing allowance** *only if opponent allowances exist*; otherwise use only the verified own volume. These event families are **not asserted to have calibrated goal-scoring influence**. Missing data produces `not_verified`, never zero.
- Final goals and supported non-goal event totals are simulated with **10,000 seeded draws per fixture**, producing exact-score histogram, W/D/L %, projected team goals, BTTS and over/unders. No multiplication of independent SGP leg probabilities to imply a correlated joint price.

**Limitations:** Current source coverage can be sparse. Heuristic coefficients are not automatically statistically valid; run time-ordered out-of-sample backtests and calibration before using derived scores as win probabilities for execution. Similar-opponent strength proxy does not fully identify formations, pressing or tactical systems. Red cards, referee impacts, real-time confirmed XIs and quantitative foul/pass/tackle interactions with goals require broader, legally permitted datasets.

## Slip research and prices

`data/slips-reviewed/YYYY-MM-DD.json` publishes the best supported research SGP, up to one per eligible league and one cross-game slip. The page shows graded research rationale, and **only displays observed individual-market reference odds when a real quote exists**; any such price is explicitly identified as **non-Ontario** and not a bet365 execution quote. A combined SGP price is **unknown** unless the exact correlated three-leg combination is returned by a book. Never infer a combined SGP price by multiplying independent leg prices. No sportsbook odds or EV appear on normal fixture cards.

Excluded from league SGP/ACCA generation: J1 (`jpn.1`) and K League 1 (`kor.1`); the current review also excludes Saudi Pro League (`ksa.1`). Do not invent lines for insufficiently covered player fouls, tackles, shots, assists or goal contributions. Mark HOLD/PASS when necessary. If two legs are redundant (e.g. BTTS Yes and Over 1.5) prefer a different independently justified family or fewer legs, not filler.

## Daily operating rule

The single original GitHub workflow `.github/workflows/archive-board.yml` has a **12:05 AM America/Toronto** timezone-aware schedule and a write-once daily board guard. A separate visible ChatGPT scheduled task checks publication and escalates missing data/retries; it must **not** create duplicate official boards. Preserve last-seven-day tracking, historical archives, published picks and V2's disabled schedules. Update the source registry and evidence provenance as integrations become licensed or verified.

## Verification for each release

1. GitHub CI: syntax and published-board integrity.
2. Deployment: latest `main` SHA is `READY` and aliased to the Original domain.
3. Live `/data/experimental-simulations/YYYY-MM-DD-v3.json` yields status 200 and 10,000 draws per fixture.
4. Live `/data/slips-reviewed/YYYY-MM-DD.json` yields status 200; supported SGP/ACCA legs display in Top Picks with caveats.
5. Projections keep W/D/L visual layout, show evidence-based fields only and distinguish 0 from unavailable.
6. External sportsbook execution/combined bet-builder prices must be directly checked; no offline claim of verification.
