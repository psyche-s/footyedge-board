# Original FootyEdge — single daily refresh

**Owner requirement (updated November 2, 2026).** Exactly one scheduled data-publication entry point for the original FootyEdge repository:
`.github/workflows/archive-board.yml` at **00:15 America/Toronto** daily.
Do not alter `ui/`, page HTML, layout or styling as part of this refresh.
This agreement does not re-enable FootyEdge V2, and does not affect unrelated SportsLab schedules.

## One-writer execution and duplicate prevention

- One GitHub Actions `schedule` across the original repository, using an explicit timezone. Other prior schedules (snapshots, research, scouting, editorial slip desk, performance, model, logos, photos, history) are manual-only.
- Never reintroduce a `workflow_run` fan-out to the shadow-model refresh; no post-publication research job should independently overwrite or duplicate the daily data.
- `concurrency.group: footyedge-original-sole-daily-refresh`, `cancel-in-progress: false`; write-once published-board guard. A rerun for an already published local date must not alter that board.
- The connected upstream Football Data Hub's former 23:15 local scheduled ingest is manual-only. The original workflow can refresh public CC0 history directly. V2 automatic tasks remain disabled.
- UI syntax, integrity checks and GitHub Pages builds are independent CI/build activities, not additional pick-data refreshes.

## Daily research/publish order

1. Verify Toronto-local calendar date, previously published board state and schedule gate. Settle prior Top 5 and SGP **as complete tickets**, without reconstructing historical picks. Preserve unresolved player markets as pending.
2. Refresh source-backed men's fixture horizon and score/history caches, with last-verified fallback on provider outages. Match by stable fixture ID, date, competition and teams.
3. Ingest approved regional data, assemble **today's** last-10 form and home/away splits, last-five H2H, team rankings, match market checks, source freshness and optional read-only Dixon–Coles shadow analysis. No absent-stat invented zeros.
4. Import approved dated predicted XIs, injuries, doubts and suspensions. Predicted != confirmed; no fabricated starting status. Preserve provider IDs and provenance. Enrich reliable player photos as a separate postpublication cache phase.
5. Rank each game's three **independently justified** match choices, if evidence exists. Include ML/DC/handicap, totals, BTTS/team totals and player-event angles only where supported. Write original compact 'Why this pick' reasoning from measurable facts, preserve source links privately in data.
6. Personally review the permitted match-specific sources and compare them with the dated 10,000-draw forecasts. Publish three distinct supported picks per fixture with original reasons. Select the strongest researched SGP for each playing major league, using as many supported legs as necessary to target +150 or above (decimal 2.50). Publish one cross-game parlay targeting +300 or above (decimal 4.00), with one leg per fixture. Verify the actual combined SGP quote; do not multiply correlated singles. If only reference prices or no combined quote are available, keep the researched selections visible and label their price status accurately.
7. Validate and publish current-day Top 3/Top 5 and editorial slips **once**. Prior days remain immutable; frozen current-day source files cannot be silently rewritten. Publish first; optional portraits/tomorrow-only research must never block today's board release.
8. Archive whole-ticket hit rate, match results and postmortem model evidence in separate date-stamped stores. Track Top 5 individual-pick hit rate separately. Record `hit`, `miss`, `push` and `pending` and avoid duplicate slip counting.
9. Write only data and allowed photo-reference assets. Run tests for board integrity, source coverage, no duplicate schedules, player matching and shot/foul verification. Never overwrite a correct score with unavailable/stale data.

## Coverage checks and unresolved dependencies

- Men's scope includes Europe, domestic leagues, Champions/Europa/conference, national competitions, J1/K League 1, Saudi Pro League, Czech First League, EFL Championship and U.S. league fixtures where verified sources actually supply games. No women's fixtures.
- Player fouls won/committed, shots/SOT, cards and referee/position-allowed matchups require event-level records; a team-level historical score cannot verify them. Show `PASS`/`unavailable` if player/source/market is not verified.
- Sportsbook odds are optional and must be a current, exact sportsbook market quote if used. Never synthesize quotes from preview sites, old screenshots, adjacent goal lines or confidence percentages.
- Third-party match previews are a research cross-check only with permission and rights respected. A source being mentioned in older project instructions does not guarantee a licensed, configured nightly feed.
- A nightly `00:15` **start** does not mean all steps or late official lineups are available at that time. Some late full-time settlements may remain pending until next midnight because all separate scheduled checks were removed at the owner's direction.
- Current Hit Rate page is the existing Top 5 interface: the new complete-slip statistics live in `data/performance/slips` and `data/performance/summary.json.slips` until a separately authorized UI change.
- Fail closed if providers do not return reliable completed fixtures, accepted licensed previews or player event stats; retain previously verified snapshots. Monitor GitHub Actions outcome and actual live site's dated data independently.

## ChatGPT research handoff

The daily ChatGPT task is scheduled for 00:15 America/Toronto. It researches the sources, completes dated owner-reviews, lineups/news and slips, validates, pushes Original main and verifies Vercel production. The existing GitHub publisher uses the same local start time as the one-writer pipeline; it never replaces a completed archive. Manual same-day continuation is allowed for non-destructive research overlays. API-Football ingestion is inside the publisher; the separate source-sync and reviewed-pick recovery workflows are manual-only to avoid duplicate refresh writers. Source references remain internal, and late official XIs remain predicted until verified.
