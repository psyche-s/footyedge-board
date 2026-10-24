# FootyEdge Original — Projections, 10K model, slips and 00:05 Toronto refresh

Updated: 2026-10-24. Scope: **psyche-s/footyedge-board only**. Do **not** enable FootyEdgeV2 scheduled jobs.

## 1. Visual specification — Projections tab

The supplied Statz.ai reference PDF was used as **information architecture** only, not copied imagery, branded elements or forecast numbers.

- Preserve existing match header, kit background, team badges, tabs, overall site design and original segmented home-win/draw/away-win bar.
- Retain predicted **exact score** and **projected goals** summary boxes from the FootyEdge experimental design.
- Show the two clubs on opposite sides of a compact stat-comparison grid. Place home value on left, the metric label centered and away value on right, with paired bars below. Only display numeric fields backed by actual match-history input.
- Beneath this, show **Match Totals** for Goals, Corners, Shots, Shots on Target, Yellow Cards, Fouls, Tackles and Passes when verified. Each card shows the simulated combined mean and three threshold probabilities; absent families do not receive guessed projections.
- Show a two-sided portrait formation pitch using the existing lineup renderer. The top team faces downward toward the center and the lower team upward; actual formation badges are taken from sourced XIs. Predicted XIs must say **PREDICTED · NOT CONFIRMED**.
- Individual fouls tables (player, role, projected fouls, 1+, 2+) require verified player last-five match records and a sourced XI; do not infer player odds or copy the screenshot's numbers.
- Add concise model factors and **unavailable factor** notes. Player portraits remain clickable to existing profiles. Site copy uses original analysis with no names/links to outside sources.

CSS: `assets/footyedge-match-v3.css`; display logic: `ui/part2.html`. No new page is required. The separate experimental page should prefer v3 and fall back to v2.

## 2. Model and input hierarchy

**Primary records:** dated `data/research-base-YYYY-MM-DD.json` with up to ten completed matches per team, including opponent identifiers, date, venue and verified final score. Date-filter every observation to **before the fixture being predicted**. Prior results are never inferred from scheduled matches.

**Opponent quality:** verified current-season standings with actual PPG, goals for/against per match, sufficient matches and exact club ID join. Correct measured attacking and defensive strengths with shrinkage; do not apply an opposition adjustment without the join.

**Similar opponents:** compare the previous opponent's PPG and defensive goals allowed with the upcoming opponent. Consider at most the last ten, require at least two meaningfully similar observed matches per side, exponentially downweight less recent matches and limit the resulting adjustment.

**Recency and venue:** take the last ten results; weight recent games more and use actual home/away splits only if at least three observations in each relevant sample.

**H2H:** consider direct meetings in the last **366 days** and cap the additional adjustment. H2H is supporting context, not a substitute for current form or player availability.

**Attack vs defense / shots allowed:** blend verified historical shots, shots on target and opponent shot allowance when BOTH comparable team samples exist. If the feed contains only own shot volume but not allowance, label the projection as own-volume based. Goal expectations are bounded and are not called xG unless real verified xG exists.

**Passes, tackles, fouls won/committed, corners, yellow cards, formation/style:** include only if records from a rights-approved, dated provider exist and the market/field has adequate observations; do not assign fictional team ratings or pretend missing measurements are 0. Store the per-field validation result in forecast coverage. The optional approved-feed adapter `scripts/sync-style-matchups.mjs` strictly derives aggregates from prior completed match records with an event ID, opponent, sample and source.

**Lineups / injuries / suspensions:** source XI and absences from club, league or correctly licensed preview data and distinguish projected versus confirmed. A quantitative expected-goals adjustment needs actual player last-five/last-ten evidence, stated sample and source; the name of a missing star does not alone justify a fixed invented goal modifier. Player fouls outputs require five verified past appearances and actual observed foul counts.

**Monte Carlo:** exactly 10,000 goal draws per fixture in v3, returning normalized home/draw/away %, three most common scores and exact-score percentages, BTTS, goal totals, then supported event-count probabilities. Higher-volume count events use a numerically stable approximation. Never represent an uncalibrated simulation frequency as a guaranteed hit rate.

**Guardrails:** retain historical original picks and grades; do not overwrite locked boards. Record current-date provider coverage, unavailable factors, pre-kickoff status and model version. Every future change requires regression tests and walk-forward evaluation, not a mere increase in confidence numbers.

Implementation: `scripts/simulate-matchups-v3.mjs` reads the source-aligned research, H2H, standings, analytics, permitted style-matchups and team intelligence; archives `data/experimental-simulations/YYYY-MM-DD-v3.json`.

## 3. Best SGPs and cross-game ACCA

- Use dated reviewed picks and **observed exact-market** price references for the same game/line. Never invent an alternate line, quote or combined SGP price. US sportsbook prices reported by an aggregator are **not** verified bet365 Ontario quotes.
- At most one SGP per eligible league and one best overall SGP, each with three genuinely distinct researched market families and per-leg reasons/grades. Exclude J1, K1 and unsupported leagues from SGP/ACCA selection under the user's policy.
- Separate cross-game ACCA of typically 4–7 fixtures, one leg per match, with major risks flagged and same-game overlap minimized; no multiply-and-pretend combined quote.
- The reference sportsbook line is **screening data**, not an execution commitment. An unpriced leg remains HOLD/research-only, never falsely quoted as playable.
- SGP and ACCA show per-leg confidence grade, overall research grade (not parlay success probability), match and cutoff. Prices belong in the slip context only when exact provider/market/observation is verified. No sportsbook odds/EV on fixture cards.
- Capture price metadata into `data/slip-market-snapshots/YYYY-MM-DD.json`, model-ranked slips into `data/slips-reviewed/YYYY-MM-DD.json`, display via `top-picks.html`.
- Do not force unsupported player fouls, shots or scorer props when minutes, lineup or stat histories cannot be verified.

## 4. 12:05 AM America/Toronto — single nightly publisher

Workflow: `.github/workflows/archive-board.yml` with one timezone-aware 00:05 cron, manual dispatch for repairs, single concurrency group and frozen-board gate. A separate ChatGPT task verifies the GitHub run/report and must **not** blindly duplicate it.

Sequence:
1. Collect eligible men's fixture date horizon, including J1/K1, official scores and the licensed/CC0 history hub; identify next fixture date if no matches.
2. Validate standings, historical samples, home/away splits, last-year H2H, comparable teams, lineup/injury/referee coverage, photos and player last-five/ten; run only approved source adapters.
3. Capture permitted analytics and style/event stats, document missing inputs, run old baseline and improved 10,000-per-game v3 experiment.
4. Rank nonredundant top-three per match and global Top Five, with supported original reasoning and confidence grade; no source names/links in public copy.
5. Examine available reference sportsbook odds and verify precise market/price/date/provider. Build qualifying major-league SGPs, best overall SGP and cross-game ACCA; mark unresolved Ontario prices and correlated markets.
6. Grade previously settled Top Five and *whole slips*, update rolling monthly hit rates and post-match learning while preserving immutable archival results.
7. Run test suites, audit coverage, publish source-reviewed frozen board and supplemental results, verify GitHub Pages and Vercel production commit; report quota or feed blockers rather than claim success.

Don't change existing kit backgrounds, core fixture-card layout, typography or theme during a data refresh. No V2 automatic refreshes.

## 5. Current limitations to monitor

As of the initial October 24 archive: 66 simulated fixtures, 47 with comparable opponents on both sides, 47 with past-year H2H, 12 with matched advanced stats, and zero quantified player-lineup rate adjustments. This is a **coverage report**, not proof every provider in `docs/RESEARCH_SOURCES.md` was individually checked. Rights/licensed feeds must be connected to improve the missing shots-allowed, tackles, passes and player-prop fields.

Price context is currently ESPN-reported sportsbook information, not a native bet365 Ontario SGP quote. In the current reviewed slip snapshot, only two cross-game legs had acceptable matched reference quotes; all others are research-only until verified.
