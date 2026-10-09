# FootyEdge model evolution — research track

## Status (2026-10-09)
Version: dc-shadow-v0.5. **Experimental/shadow only.** Do not cite its output as a
validated percentage or use it to modify the live board, Top 3, Top 5 or archives.

## Why
The existing deterministic last-10 research signals trends; they are not a calibrated
match-goals distribution. Dixon-Coles estimates a score probability grid with a
low-score dependence adjustment (rho), enabling coherent 1X2, double chance, totals
and BTTS probabilities. Its superiority must be proven out of sample, not assumed.

## Architecture
- Existing Node research/scoreboard → dated fixture list (current Toronto date).
- Independent Python step → download OpenFootball public-domain men's top-flight
  league results (previous/current seasons), fit penaltyblog DixonColesGoalModel
  per league using exponential daily decay xi=0.001.
- Output → data/model-shadow/YYYY-MM-DD.json. It contains fixture IDs, statuses,
  supported market probabilities, expected-goal estimates, input coverage,
  source URLs, result freshness, version and exact as-of timestamp.
- No secret keys; zero calls to blocked API-Sports; no scraping of restricted
  bookmaker/FBref pages; no sportsbook odds inferred.
- GitHub Actions executes daily around 05:35 Toronto, in parallel with the
  normal research and before the 06:00 official board lock. Runs on model-code
  changes and can be triggered manually in the GitHub Actions interface.
- At the 06:00 Toronto official-publishing run, `archive-board.yml` fetches
  the latest remote main ref without modifying its board checkout and runs
  `scripts/audit-shadow-refresh.mjs --ref origin/main`. The GitHub Actions
  step summary records availability, date, model version, source coverage and
  whether the experimental forecast passed pre-match structure checks.
- This is a **non-blocking visibility check**: if research/model data arrives
  late, is stale or missing, the official publication still proceeds unchanged.
  Neither 06:00 board selection nor odds/Top 3/Top 5 use shadow probabilities.
  The model's original dated archive is immutable even after a later code
  upgrade; no late replacement or hindsight backfill is permitted.
- One daily shadow file is immutable when archived; reruns do not silently
  rewrite predictions. Git history also records the original source version.

## Current limited scope and fail-closed rules
- Eligible male top flights only: EPL, Bundesliga, La Liga, Serie A, Ligue 1,
  Eredivisie, Primeira Liga, English Championship and Turkish Süper Lig. Cup/international and women's fixtures are
  excluded from modeling; they are never relabeled as zero-probability games.
- Strict team-key normalization plus explicit aliases (no unreviewed fuzzy
  entity matching). v0.2 adds seven verified source-name aliases following the
  first 2026-10-09 coverage audit (1/6 eligible fixtures forecast). Original
  October 9 shadow output remains immutable. Unknown/promoted teams without
  four observations skip.
- At least 90 finished league matches and recent source results (<=30 days
  old) required. OpenFootball's upstream updates are not guaranteed; report
  stale or unavailable status instead of generating synthetic predictions.
- Only final scores with match date strictly before the as-of/fixture date
  are included. In-play or already-started fixtures are skipped.
- A single fixed xi is an initial baseline, NOT a tuned optimal value.
- No xG, PPDA, field tilt, injuries, rest or player-prop variables are yet
  incorporated; those require reliable, legal source access and validation.
- Public confidence >=85% is not derived from raw probabilities in this trial.
- Vercel, user-facing layout and all official daily-publishing logic are untouched.

## Reproduction
Run:
    python -m pip install -r requirements-shadow.txt
    python -m unittest discover -s tests -p test_shadow_model.py -v
    python scripts/shadow_dixon_coles.py
    python scripts/shadow_dixon_coles.py --dry-run
    node --test tests/audit-shadow-refresh.test.mjs
    node scripts/audit-shadow-refresh.mjs
A dry run computes current forecasts but does not alter stored original output.
Pull-request CI always performs a dry run, even if today is already archived.
For deterministic local investigation, specify --date YYYY-MM-DD and --as-of
UTC_ISO_TIMESTAMP (same day or future only). Do not backfill forecasts after
matches have been played and misrepresent them as contemporaneous predictions.

## October 9 pilot and original result comparison
- The original October 5/6 FootyEdge boards are national-team matches,
  outside Dixon-Coles' *domestic-league-only* training scope. Their real
  outcomes are graded in `data/model-backtests/archived-originals-2026-10-05_06.json`
  without pretending a new-model prediction existed.
- `scripts/backtest_shadow.py` makes a separate **domestic-league historical
  holdout**: fit solely to pre-2026-09-12 results and score actual final matches
  through 2026-09-20. Scores are retrospectively sourced from OpenFootball;
  their availability at the old clock time cannot be independently verified.
  This is an initial sample, not proof of calibration or betting profitability.
- Today's original `data/model-shadow/2026-10-09.json` v0.1 is **immutable**.
  v0.3 saves an independent, time-stamped pre-kickoff
  `data/model-candidates/2026-10-09.json`, with the research-input SHA256.
  NEVER overwrite the original or backfill the new candidate after kickoff.
- `scripts/review-shadow.mjs` grades original and candidate forecasts only
  against authoritative completed scores; compares market-level outcomes
  with original published selections without changing those picks.
  Unfinished games stay pending, process-quality conclusions stay unreviewed.
- The 05:05 Toronto research workflow ingests any completed previous-day
  model review **before** refreshing its statistics; the model is still
  independent and its weights are not automatically changed on a one-day sample.
- Odds remain exact-native sportsbook quotations only. Where the sportsbook
  lacks a verified market/line, do not invent a new price or label one
  available merely because Dixon-Coles estimates its probability.

## Exact sportsbook total lines (sideboard v2)
- The dated ESPN scoreboard snapshot retains native DraftKings
  goal-total lines with exact posted American odds (2.5, 3.5, 4.5).
  The updated model sideboard `data/model-boards-v3/YYYY-MM-DD.json`
  uses those quoted *specific* lines in addition to the morning
  verified moneyline snapshot. It does **not** derive adjacent lines.
- If the Dixon-Coles pre-match candidate lacks that precise modeled
  total (for example 4.5), the exact posted price may still display
  but **model probability and EV are unavailable**, not fabricated.
- Existing v1 sideboard remains as historical source evidence.
  The expanded analysis prefers the versioned v3 sideboard when
  present, preserving the existing UI layout and locked Top 3/Top 5.
- The feed uses both `provider.name` and `provider.displayName` depending on
  the event; version 3 handles either verified DraftKings identifier and
  leaves the earlier incomplete v2 research artifact unchanged.

## Current board's independently labeled model analysis
- A separate `data/model-boards/YYYY-MM-DD.json` is generated after a
  genuine time-stamped pre-match candidate and saved verified native odds
  become available. It contains dated model-only 1X2 probabilities,
  corresponding *exact* American sportsbook ML quotations, model-vs-quote
  EV and unavailable statuses for unquoted lines.
- The existing full-match analysis optionally shows this under
  **DIXON–COLES MODEL CHECK · EXPERIMENTAL**, without changing its
  published Top 3, Top 5, price, confidence, historical ranking or
  settled performance. No other visual layout change is intended.
- Domestic holdout (Sep 12–20, 2026): 118 supported matches, DC
  1X2 argmax correct in 50.0%, multiclass Brier 0.590688 and
  log-loss 0.992190. This small sample does not establish
  calibration/ROI or justify automatically increasing scores.
- The model report can disagree with official published scores or
  prices; those disagreements are part of the morning research and
  next-day post-match review, not hidden by refitting past games.
- Until a longer direct head-to-head is available, the DC forecast is
  a real **second-opinion input**, not an untested replacement
  for saved original selections or an invented 85%-confidence source.

## 2026-10-10 refresh: verified final-score supplement
- OpenFootball's public results can lag the slate. Starting with v0.4,
  `scripts/shadow_dixon_coles.py` also reads prior seven days of
  **genuinely completed** men-only games from the repo's *dated ESPN
  scoreboard snapshots*, gated by the original official fixture ID and
  supported league code.
- This is training input only from **prior Toronto dates**. Today's
  scores, in-progress states, no-score entries, missing archived boards
  and women's games are excluded. The source reports fixture IDs and
  any conflicting full-time scores; original source rows are preserved.
- Tomorrow's model therefore can learn from October 9 results **if**
  complete trusted scoreboard rows are available. If any are missing,
  it does not manufacture results or force a coefficient adjustment.
- The independent post-match process/incident review remains separate;
  one day's hit or miss is not enough to adjust market weighting.

## Added competition expansion — October 9
- Added ESPN male competition uid 3914 (`eng.2`, Championship) and uid
  3946 (`tur.1`, Turkish Süper Lig) to tracked fixture schedules and
  all-competition deterministic last-10 research.
- OpenFootball `en.2` 2025–26 and 2026–27 match-result feeds exist.
  OpenFootball `tr.1` 2025–26 exists but the 2026–27 file is
  **not available**. This is a documented source gap, NOT permission
  to fabricate current-season results or label stale odds as current.
- Model forecasts for Turkish fixtures must fail closed until sufficient
  recent, permission-safe completed league scores are available.
- The newly expanded pre-match candidate is stored separately under
  `data/model-candidates-expanded/YYYY-MM-DD.json` and may only be
  archived if both new leagues are in the daily research file and
  both fixtures are still pre-kickoff. The original October 9
  model-v0.3 forecast is preserved.
- The deterministic research refresh is invoked on this league-scope
  change. Its successful completion triggers a new model refresh,
  avoiding the former six-game source mismatch.

## Acceptance gates before ANY public influence
1. Check coverage/source freshness and expand legally available league history.
2. Walk-forward historical replay with time-appropriate training data, genuine
   historical odds where permitted, and strict train/test date separation.
3. Compare Dixon-Coles vs independent Poisson and existing FootyEdge predictions:
   multiclass log loss, Brier score, calibration plots, breakdown by league,
   totals, BTTS and DC; quantify variance and missing-data selection bias.
4. Tune xi and other covariates ONLY inside training folds and evaluate on
   untouched holdouts. Prevent team aliases, substitutions and source updates
   leaking results. Validate uncertainty, sample counts and reliability bins
   (including whether stated 85% picks hit approximately 85%).
5. Compare selections at exact verified sportsbook odds, apply the established
   -400 floor and safer-line tests, track no-vig prices, closing-line value,
   push rules, model EV and risk-adjusted ROI with realistic availability.
6. Require documented, repeatable out-of-sample improvement before adjusting
   published confidence/selection weights; version each change, never modify
   original locked history or write hindsight explanations.
7. Live in-play modeling is a separate, later, licensed-data experiment.
   Never run a one-minute scraper on GitHub Actions or disclose API credentials
   in clients; no live probability updates to frozen morning picks.

## Proposed next milestones (NOT IMPLEMENTED)
- Historical canonical team ID mapping and stable league source checks.
- Expanded rolling-origin holdout evaluation and monthly calibration dashboard.
- Licensed xG/shot quality, field tilt and PPDA when permitted, with
  opponent-adjusted matchups and verified team-news modifiers.
- Calibrated model/blend only after statistically meaningful validation.
- Separate live game-state model after identifying affordable licensed events.

References:
- https://penaltyblog.readthedocs.io/en/latest/models/example.html
- https://github.com/openfootball/football.json
- https://github.com/openfootball/football.json/blob/master/LICENSE.md
