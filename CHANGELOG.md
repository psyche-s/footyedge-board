# FootyEdge Change Log

Canonical running history of FootyEdge releases, model/data changes, UI changes, tracking rules, deployments, and planned work.

**Status:** ✅ Live/complete · 🟡 Code ready/pending deploy · 🔵 Planned/queued · ⚙️ Process/model rule

> Earliest reconstructable FootyEdge history begins on **2026-10-03**. Earlier versions were not formally logged. From this file onward, append material changes without rewriting past entries.

---

## 2026-10-03 — Project foundation
**Status:** ✅ Complete

- FootyEdge established as a free soccer research/picks site combining stats, trends, form, H2H, model analysis and market context.
- Dark Football Whispers-inspired match-card direction established while keeping original FootyEdge branding.
- Core board direction: today's fixtures, Top Picks, confidence scores, expandable match analysis and major market types.
- Live-data/API direction established with Toronto-local date handling required.
- Early custom-domain work began.

## 2026-10-05 — First major live board build
**Status:** ✅ Complete

- Vercel preview deployed and FootyEdge became a working web app.
- Today's games became the default slate.
- Best Pick logic shifted toward the highest-confidence qualifying model market rather than a fixed market type.
- Top 5/high-confidence presentation and expandable match analysis added.
- League, status and market filtering added.
- Live scores/data-refresh direction incorporated.
- Visual direction changed from red accents to the current green FootyEdge theme.
- Team/country and player imagery incorporated where available.
- Match-card presentation refined toward the cleaner Football Whispers-style layout.
- Team news, injuries, suspensions and projected-lineup context added as research inputs.
- External current-preview research added as a cross-check layer rather than the statistical source of truth.

## 2026-10-06 — v46
**Status:** ✅ Live

- October 6 tracked UEFA/CONCACAF slate loaded.
- Toronto-date vs UTC handling corrected.
- Morning sportsbook odds frozen rather than continuously repriced.
- Missing verified lines left blank instead of inventing a price.
- Live form, predictions, injuries/news, lineups and scores incorporated.
- Same-day automatic repricing after the morning freeze disabled.

## 2026-10-06 — v48
**Status:** ✅ Live

- Redundant/nested Top-3 markets deduplicated.
- Match cards, team circles and stat boxes made more compact.
- Team-news display/filtering cleaned up.
- Official pending picks seeded for tracking.
- Football Whispers cross-checking remained active.
- Early historical sample treated as calibration context, not proof of future performance.

## 2026-10-06 — v57
**Status:** ✅ Latest confirmed production baseline

- v57 became the latest confirmed production build.
- Current UI/look-and-feel accepted as the design baseline to preserve.
- No broad redesign authorized for subsequent model/data improvements.

## 2026-10-06 — Official daily research/odds pipeline
**Status:** ⚙️ Process/model rule

- Deterministic daily research base established as the statistical source of truth.
- True all-competition last-10 became the primary form sample; last-5 and competition-only form are secondary lenses.
- Required evidence includes W-D-L, GF/GA, scoring/failed-to-score, clean sheets/conceding, BTTS, O/U, meaningful home/away splits, streaks and useful H2H.
- Football Whispers and Sportskeeda exact-fixture previews used as bounded external cross-checks when useful.
- External article claims cannot override conflicting deterministic stats.
- Official odds collected only after research.
- Only actual posted sportsbook prices qualify; synthetic, inferred, converted or model-fair prices are prohibited.
- Preferred pricing order: DraftKings, FanDuel, ESPN BET, then another reputable regulated source when needed.
- Qualifying parlay recommendations may not be worse than **-400**; -400 itself is allowed.
- Daily validation must pass before publication.
- 7:00 AM America/Toronto became the official daily freeze.
- Historical performance records must never be rewritten after the fact.

## 2026-10-06 — Tracking rule
**Status:** ⚙️ Process/model rule

- October tracking preserved as **4-1 (80%)** from the single official October 5 board.
- Discarded/non-official boards must not be restored into the tracker.
- Frozen historical picks, prices, confidence and outcomes remain immutable.

## 2026-10-06 — v64 code
**Status:** 🟡 Code ready / production retry scheduled

- Today’s Picks v64 UI bundle prepared.
- Fix prepared for Today’s Picks getting stuck on **Loading**.
- Home-page Top 5 loading/probe logic prepared so the landing page can show the current published Top 5.
- Status filter intended to default to **All Games**.
- Landing/navigation structure includes **Home · Today’s Picks · About**.
- Home page includes FootyEdge hero, free-use messaging, current tracked hit rate, live Top 5 snapshot and optional support link.
- v64 is a deployment/technical fix set; it does **not** change model logic, odds, research or historical tracking.
- One-time deployment retry scheduled after the Vercel quota reset; it must deploy v64 or later and never roll production backward.

---

# Planned / queued for 2026-10-07 morning refresh

## Balanced market selection
**Status:** 🔵 Planned

- BTTS Yes/No must be evaluated properly but **not privileged**.
- BTTS competes normally with ML, double chance, handicap/spread, totals, team totals and player markets.
- Evaluate both teams' scoring/conceding, BTTS, failed-to-score and clean-sheet rates, venue splits and meaningful H2H.
- Two-sided opponent compatibility should matter more than an isolated one-team trend.

## Safety-line optimization
**Status:** 🔵 Planned

- Compare strong totals candidates with legitimate safer adjacent lines when an exact verified price exists.
- Examples: U2.5 vs U3.5/U4.5; O2.5 vs O1.5.
- Choose the best risk-adjusted combination of hit probability and real price rather than automatically taking the narrowest/highest-paying line.
- Safer lines remain subject to the -400 qualifying floor.

## Attacking player markets
**Status:** 🔵 Planned

- Add **ATGS** and **Score-or-Assist** as genuine Top-3/global candidates when justified.
- Also evaluate **Assist** and **2+ Goals** when reliable data and exact verified sportsbook prices exist.
- Compare a player's available markets rather than assuming ATGS or SOA is always best.
- Model expected start/minutes, role, penalties/set pieces, recent goals/assists, shots/SOT, xG/xA/chance involvement where reliable, team scoring expectation, opponent defensive/positional matchup, rotation/injury risk and game script.
- Poor lineup/minutes confidence should downgrade or exclude a player prop.
- No new player-prop UI/filter; these markets stay inside the existing Top-3/model structure.

## Top 3 and Top 5 ranking
**Status:** 🔵 Planned

- Produce up to three genuinely distinct angles per game when supported; never force three weak picks.
- Nested versions of the same thesis should not occupy multiple Top-3 slots.
- Global Top 5 should prioritize **risk-adjusted confidence**, not raw model edge alone.
- Penalize tiny samples, one-team trends, fragile narrow lines and uncertain player minutes.

## Post-match learning loop
**Status:** 🔵 Planned

- Freeze every game's pre-match Top 3 before kickoff.
- Grade **every Top-3 candidate at 85%+ confidence** after settlement, not only the global Top 5.
- Preserve pre-match market, player/team, confidence, exact odds, model probability, evidence and model version.
- Separate official result from process quality: good process/good result; good process/unlucky result; weak process/lucky result; weak process/bad result.
- Investigate verified red cards, penalties, VAR reversals, early injuries, late lineup changes, rotation and major tactical/game-state shifts.
- Do not automatically excuse a loss because a disruption occurred.
- Flag lucky wins so weak reasoning is not reinforced.
- Review whether a safer adjacent line would have been the better pre-match choice.
- Maintain rolling diagnostics/calibration by market family.
- Model evolution must be gradual, bounded, documented and versioned.

## “Why this pick” reasoning
**Status:** 🔵 Planned

- Move **Why this pick** directly beneath **Pick #1** in expanded match analysis.
- FootyEdge should increasingly generate the explanation from its own structured stats/model evidence.
- External previews may inform/cross-check analysis but their prose must not be copied.
- Use only the strongest 1-3 relevant facts: form, scoring/conceding, BTTS/O-U pattern, venue split, useful H2H, opponent compatibility, player role/production, safety-line choice or material team-news impact.
- Reasoning must be directionally consistent with the selected market.
- Post-match reviews should also assess whether the pre-match explanation emphasized the truly predictive evidence.

## Team news and impact analysis
**Status:** 🔵 Planned

- Verify injuries, suspensions, illness, omissions, doubtful status, returns, rest/rotation, goalkeeper changes and projected/confirmed lineups across reliable sources.
- Prefer official club/national-team squad/availability information first.
- Do not merely list missing players; assess the actual football impact of material news.
- Consider goal threat, chance creation, progression/width, midfield control, penalties/set pieces, defensive structure, aerial defense, pace, goalkeeper quality, bench depth, replacement quality and likely game script.
- Weight absences by starter/reserve status, usual minutes/role, production, replacement quality and clustered absences.
- Avoid simplistic rules such as “missing striker = Under” or “missing defender = Over.”
- Uncertain news remains uncertain and should reduce confidence rather than be treated as confirmed.
- Player props require credible expected-start/minutes evidence.

## Game search
**Status:** 🔵 Planned — only authorized UI addition

- Add a compact **🔍 game search** at the top of the current board.
- Search today's fixtures by home team, away team, national team/country and recognizable fixture text.
- Case-insensitive; clearing search restores the normal slate.
- Must work alongside existing filters and reuse existing FootyEdge styling.
- **No other redesign, layout, card, spacing, color/theme or filter changes are authorized.**

---

# Change-log rule going forward

Every material FootyEdge update must append a dated entry containing:

- **Date**
- **Version** when applicable
- **Status:** planned / code ready / deployed / verified
- **What changed**
- **Why it changed**
- **Model/data impact**
- **UI impact**
- **Tracking/history impact**
- **Deployment result/blocker** when applicable

Do **not** rewrite older entries to make history look cleaner. Corrections must be appended as new dated notes explaining the correction.


## 2026-10-06 — Logo consistency fixes queued
**Status:** 🔵 Planned for next morning refresh

- Club/team crests in Top Picks, standard match cards and expanded matchup views should no longer be forced into circular frames/crops.
- Club crests should use a consistent bounding box with contain-style sizing so both teams' logos appear balanced at the same maximum visual size while preserving each crest's natural shape and transparency.
- National-team/country imagery should keep the current circular treatment and continue filling the circle cleanly.
- League-filter icons should use the correct competition logo instead of generic soccer-ball placeholders where assets are available; specifically fix Serie A, Bundesliga and Ligue 1 and extend the same treatment to other supported filters.
- League logos inside match-card/header rows must stay within the existing header height. Serie A's tall logo currently bleeds outside the header and must be constrained/centered without increasing header height.
- These are targeted visual consistency fixes only. No redesign, card/layout/theme/spacing changes are authorized beyond the already planned game-search control and these logo fixes.

## 2026-10-07 — v65 published-pick protection and tracking
**Status:** 🟡 Code ready / deployment pending

- Owner rule: every published pick is immutable unless Shaif explicitly requests the specific correction. Covers all game picks, Top 3, player props, alternatives, global/league rankings, published confidence/prices/EV and pre-match explanations.
- Same-day and historical pages now render saved boards before any model computation. Filters use saved alternatives. Unpublished dates wait for a durable complete board instead of exposing live recalculations. Scores/status and separate settlements still update.
- Publication captures reviewed checkout code and dated inputs, validates completeness and exclusively creates the board file. Repeated captures cannot overwrite an existing record. Tracker reads original archive selections rather than scraping current DOM rankings.
- Added AGENTS.md, integrity validation, CI checks and preserved correction backups/audit. Integrity validation rejects changed published boards, odds/research, correction history and altered tracking selections.
- October 6 restored to the owner's screenshot: Switzerland U3.5, Kazakhstan U2.5, Albania U4.5, Scotland U2.5, Estonia +0.5; original ranks, odds, confidence and displayed EV retained. Overwritten five-game archive preserved in data/board-revisions/2026-10-06.
- Recovery limit: no complete first-published October 6 board was saved. Unverified original selections, additional Top-3 slots and explanations remain unavailable; they were not replaced with fresh model outputs. This is a partial historical restoration, not a recovered full board.
- Original October 6 Top 5 graded 3-2 from completed scoreboard results; combined official tracked record is 7-3 (70%) across October 5–6. Prior October 5 record remains unchanged.
- Owner-requested tracking panel implemented on Home and Picks: month tracking on left, 2026/YTD on right, center divider, `Hit Rate` capitalization. YTD counts only saved official picks for the current calendar year. No example 24-11/35-pick totals were invented.
- Model/data impact: future research and model changes affect future boards; no model scoring formula redesigned here. UI impact limited to the explicitly requested tracking panel and accurate unavailable-history states.
- Validation: nine regression checks plus daily-board validation, published-history integrity and JavaScript syntax checks. Browser QA could not run because the environment lacks a browser executable; production source/deployment verification remains required.

## 2026-10-07 — v65 deployed and verified
**Status:** 🟢 Deployed / verified

- Production deployment dpl_6wgQMHQmiqQScVPX62CvVcQ4wP36 reached READY from commit f570a06 and was assigned footyedge-board.vercel.app. Cloud browser verification confirmed the Home/Picks month/YTD records and October 6's screenshot-restored Top 5, prices, ranks and confidence.
- Complete October 6 recovery remains unavailable; no missing original picks or explanations were invented. Production review also identified missing historical GF/GA being shown as zero; v66 displays unavailable values as dashes.

## 2026-10-07 — v66 schedule availability and advance-board readiness
**Status:** 🟡 Code ready / deployment pending

- Explicit owner request: both Home and Picks explain a verified empty slate with no games and the next confirmed game date. A shared schedule helper checks Toronto calendar dates up to 14 days ahead. Provider failures and scheduled-but-unpublished picks have distinct messages. Filtered-out games still use the existing filter-empty message.
- Fixed supported league detection before odds are posted. Actual ESPN competition IDs identify Premier League, LaLiga, Bundesliga, Ligue 1, Eredivisie, Primeira Liga and international friendlies without relying on sportsbook metadata. Applied consistently to board display, deterministic research and provider fallback.
- API-Football nonempty errors/status failures now use the existing ESPN fallback, rather than accepting a provider restriction as an empty successful response. No pricing or model guardrail weakened.
- Checked October 8–11 fixtures and odds readiness. Fixtures exist; no future board is published. API-Football returned a suspended-account error for October 8 and free-plan date restrictions for October 9–11. The ESPN fallback has native posted sportsbook prices for October 9–11; October 8 has none. Deterministic research was prepared for all 97 supported fixtures across the four dates with zero fetch errors; readiness is recorded in data/board-readiness.json. Editorial/team-news checks, exact-market frozen odds and complete board capture remain pending. No selections, prices or future tracking results were invented. The morning automation now checks/prepares the next four days and reports readiness gaps.
- Advance publication supports an explicit future board_date through the archive workflow after all normal validation passes; historical generation remains prohibited and existing future boards cannot be overwritten. Research generation exits if the date already has a published board. Automatic pushes no longer force out-of-window publication.
- Model/data impact: fixture visibility fixed, scoring unchanged. UI impact: requested empty-state wording and accurate missing-history dashes only. Tracking/history impact: preserved every published selection and previous correction audit.
- Validation: all 16 regression tests passed, including empty schedules, next-game dates, missing odds, provider failure, Toronto midnight boundaries and immutable same-day/history boards. Published-history integrity passed against f570a06. Production verification pending for v66.

## 2026-10-07 — v66 deployed and API fallback verified
**Status:** 🟢 Deployed / API verified

- Deployment dpl_2oCqmae3xyAggYCXdGDnNtzqK4VB reached READY from f6aa23d and was assigned footyedge-board.vercel.app. Production API checks confirmed restricted October 8 fixtures and October 9 odds use ESPN fallback without provider errors.
- The subsequent owner instruction moves the tracking/previous-picks section to a dedicated Hit Rate page; see v67 below.

## 2026-10-07 — v67 dedicated Hit Rate page
**Status:** 🟡 Code ready / deployment pending

- Explicit owner request: add Hit Rate before About in navigation on all pages. Move the tracking and previous-picks section from Today’s Picks to this page; retain the Home summary.
- New page uses the Home dark green card style, starting with month/YTD records and Hit Rate labels. Below, each tracked day has a left-aligned uppercase green date and five vertical table rows. Latest day first; hit/miss marks, original pick rank/selection, matchup once and numeric score only. Pending/push outcomes are represented accurately.
- History covers the full current Toronto calendar month, rather than only the seven-day recentDays window. Month rollover hides prior-month rows and starts the new monthly record; full stored history and YTD remain intact. Home labels also handle stale summary data at a calendar rollover.
- Tracker summary now exports full monthDays. Saved selections, confidence, odds, grade/history data and correction audits are unchanged. No scoring/model changes.
- Validation: 21 tests pass, covering monthly ordering, month/midnight rollover, complete month history, score-only rendering, navigation placement and published-pick integrity. Integrity verified against f6aa23d. Production UI verification pending.

## 2026-10-07 — v68 matching header and early morning run
**Status:** 🟡 Code ready / deployment pending

- Owner's second header screenshot is the reference: Today’s Picks now has the same single-row FootyEdge-left / navigation-right header as Home, Hit Rate and About, with the active-link underline. Removed the extra branding/tagline row. No game-card or model changes.
- Owner requested the October 7 morning automation run immediately and skip its normal 7 AM occurrence. Recurring schedule moved to DTSTART October 8 at 7 AM America/Toronto, retaining daily runs. Early run submission follows this header deployment so it uses current main.
- Hit Rate deployment dpl_A4PPBGUeiMjG5QzK6AfUjXN7Hrqh reached READY on production from fc25c0a. Full live-page verification follows the matching header deployment. Published history remains preserved.

## 2026-10-07 — v67/v68 production verification and early-run request
**Status:** 🟢 UI deployed / verified; morning run requested asynchronously

- Production dpl_9xEjEpU4UuG6FzXtz3wgL7ED3JTk reached READY from d5c4a26 and was assigned footyedge-board.vercel.app. Live browser verification confirmed the single-row Picks header, navigation with Hit Rate before About and removal of the old tracking strip from Picks.
- Live Hit Rate page verified: real October/YTD 7-3 and 70% from 10 official picks; October 6 then October 5, five vertical rows each, correct hit/miss marks and numeric-only scores. Month rollover and full-month history checks pass. Preview captured from production.
- All 22 regression tests and published-history integrity passed; GitHub Published board integrity CI succeeded. Existing published boards, selections, prices and historical grade files remain unchanged by these UI changes.
- Immediate morning automation run was requested successfully at the owner's instruction. Execution/delivery are asynchronous; this log does not claim the board run has completed. The recurring Codex task now starts October 8 at 07:00 America/Toronto and therefore skips October 7's 07:00 occurrence. Its prompt includes the current header, Hit Rate layout, immutability and four-day readiness rules plus force flags for the authorized early run.

## 2026-10-07 — v69 early morning board run / publication gates
**Status:** 🟡 Code ready · today’s board intentionally blocked by validation

- Owner-triggered morning workflow ran before 7:00 AM Toronto; the scheduled October 7 run remains skipped and normal 7:00 AM scheduling resumes October 8.
- October 7 review found Jordan vs Armenia in the women’s international schedule. No FootyEdge pick was published because a publication-grade all-competition last-10 and exact native qualifying sportsbook price were not both verified. The site must show the scheduled/unpublished state rather than inventing a pick.
- “Why this pick” now sits directly inside Pick #1 and prioritizes deterministic FootyEdge research over preview prose while preserving archived explanations/evidence unchanged.
- Team news is gated to current sourced structured items; model impact requires confirmed role/importance/replacement/evidence. Uncertain news is not promoted to confirmed.
- Player props require expected-start, 60+ expected minutes, current sources and no material rotation/injury flag.
- Complete archive capture excludes unpriced/display-only alternatives so frozen selections cannot bypass the exact-price rule.
- Research now uses current plus prior-season all-competition schedules, excludes unfinished fixtures and stores last-10/last-5 evidence. Postmatch diagnostics are ingested without automatic recalibration.
- Added dated postmatch diagnostics. Historical missing Top-3 selections are not reconstructed; result grading remains separate from process-quality review.
- Approved UI-only changes: visible compact game search, club crest contain sizing, circular country imagery preserved, Bundesliga/Ligue 1/Serie A and other supported league marks normalized, and league-header logos constrained against overflow.
- October 8–11 research inventory remains prepared; no future board is published until current team-news, price and validation gates pass.
- Tracking/history impact: October 5–6 immutable selections and results are unchanged. No October 7 tracking denominator is created because no board was published.
- Deployment result: pending this commit’s Vercel production verification.

## 2026-10-07 — v69 deployed and verified
**Status:** 🟢 Deployed / verified

- Commit `dc47dbf93b1fc773d1ff14ab69b06b4108618d03` deployed to Vercel production as `dpl_G2N3dSgfcgRpcg74kAmrqLRnKDrN` and reached READY.
- Production alias `footyedge-board.vercel.app` is assigned to the deployment.
- GitHub Published board integrity passed, including immutable-history enforcement and the complete regression test suite.
- The archive workflow completed without creating an October 7 board. This is intentional: the publication gates remain blocked by incomplete verified last-10 inputs and the absence of a verified exact native sportsbook price for the tracked fixture.
- October 5–6 published selections remain byte-preserved by the integrity guard. No October 7 tracking denominator was added.

## 2026-10-07 — v70 mobile navigation, league filters, 4-day live-data horizon
**Status:** 🟡 Code ready / deployment pending

- Fixed the Picks date bar regression introduced by adding Today + Search: all five controls now occupy one row on mobile instead of wrapping the Next arrow below Previous.
- Restored/expanded competition-logo mappings in league filters, including FIFA friendlies and Europa League coverage, while retaining the existing major-league marks.
- Replaced the emoji football fallback with a fully transparent inline SVG football so unknown competitions never render an opaque/boxed emoji background.
- League logos remain contain-sized and transparent; failed/unknown competition artwork falls back cleanly.
- Morning deterministic research now rebuilds and pushes the Toronto current date plus the next 3 calendar dates.
- Hourly live snapshots now push dated scoreboard/fixtures/odds data for today + next 3 dates; `latest-*` continues to represent today only.
- Future data/research does NOT publish future picks. Picks still require all verification gates and become immutable only on first publication.
- No historical pick, confidence, odds, explanation or tracking record was modified.

## 2026-10-07 — v70 deployed / verified
**Status:** 🟢 Deployed and integrity-verified

- Commit `bfe9107e9caff6007f851db691b48ffebb48899e` deployed to Vercel production and reached READY on the production aliases.
- Published board integrity completed successfully; October 5–6 immutable board history remains unchanged.
- Mobile date controls, transparent league fallback, restored league mappings, and the today + next-3-days live-data/research horizon are now on main.

## 2026-10-07 — v71 future-board publication horizon
**Status:** 🟡 Code/data update in progress

- Corrected the future-date odds gate: exact native sportsbook lookup now permits the Toronto current date plus the next 3 dates instead of returning `live_date_only`.
- Added International Friendlies resolution hints for the exact-odds provider.
- Clarified the owner rule: future boards SHOULD publish early when their complete research, current team-news, qualifying exact-price and validation gates already pass. They do not have to wait until game day.
- Future published boards become immutable immediately at first publication, exactly like same-day boards.
- October 9 currently has scheduled fixtures and DraftKings market data, but no saved publication-grade daily insights/team-news review and no frozen board yet; this is why the UI correctly shows "Picks have not been published yet."

## 2026-10-07 — v72 five-date horizon / October 11 readiness
**Status:** 🟡 Data verified · latest production verification pending

- Corrected the morning/data horizon to today plus the next four Toronto calendar dates (five dates total).
- Saved October 11 scoreboard/fixtures/market snapshots and verified 25 exact native-American sportsbook events after filtering strictly to the October 11 Toronto calendar date.
- Added a hard Toronto-date filter to the exact-odds endpoint so adjacent UTC-date events cannot leak into a requested board.
- October 11 picks remain unpublished because current publication-grade research/team-news validation is not yet complete; no gate was weakened.
- No previously published selection, price, confidence, explanation or tracking record changed.


## 2026-10-07 — v73 rolling previews / 06:00 official lock
**Status:** 🟡 Code ready · immediate preview publication triggered by main push

- Owner rule changed: FootyEdge now publishes rolling model boards for today plus the next four Toronto dates without waiting for sportsbook pricing.
- Future/current pre-lock boards live separately in `data/board-drafts/` and may change on each morning refresh as research, team news, confidence, pricing and adjacent-line choices update.
- Missing odds no longer block a preview pick. If an exact price is already posted, it must still satisfy the existing -400 floor; an unavailable price displays as pending/blank rather than being invented.
- The fixture-date board hard-locks at 06:00 America/Toronto. The latest preview is promoted to the immutable official `data/boards/` record and no automatic selection, rank, confidence, price or explanation can change afterward.
- Post-lock changes remain owner-only and continue to require the existing backup/audit process. Tracking continues to use official locked boards only; preview boards never enter the hit-rate denominator.
- Deterministic research was moved to the Toronto 05:00 hour so the final morning re-run happens before the 06:00 lock. Rolling preview capture is scheduled around 05:35 with 06:05 + fallback lock checks.
- UI impact: no redesign. Picks pages simply load the rolling preview when no locked board exists and prefer the official board once locked.
- Deployment result: pending Git/Vercel and preview-workflow verification.


## 2026-10-07 — v74 league artwork / international flag coverage
**Status:** 🟡 Code ready / production deployment pending

- Replaced the generic/ESPN league-filter artwork for MLS, Bundesliga and Ligue 1 with recognizable Wikimedia-hosted marks matching the owner-provided visual references. Existing Premier League, LaLiga and Serie A mappings remain unchanged.
- Extended the national-team flag map for the currently researched international slate (including Bolivia, El Salvador, Haiti, India, Indonesia, Jamaica, Jordan, Malaysia, New Zealand, Panama, Philippines, Russia and Saudi Arabia) plus common adjacent international teams.
- Country images retain the existing circular treatment; club crests remain natural-shape contain images. No card/layout/theme redesign.
- Added regression coverage for the three requested league marks and current-slate country flags.
- Tracking/model impact: none. Published historical boards remain unchanged.
- Deployment result: pending.


## 2026-10-07 — v73 preview pricing safety follow-up
**Status:** 🟡 Code ready / preview refresh queued

- Mutable previews now prefer saved exact native-American daily sportsbook snapshots when available, while still publishing picks when no exact price exists.
- Converted/generic feed prices may inform model context but are scrubbed from the saved preview and can never become the official recorded price at the 06:00 lock.
- The exact 06:00 Toronto lock schedule replaces the earlier 06:05 wording. A fallback lock check remains.
- Board-publish concurrency now queues rather than cancels an in-progress pre-lock refresh, so the 06:00 lock cannot interrupt the final morning preview build.


## 2026-10-07 — v75 owner lock-now / daily 06:00 publication
**Status:** 🟢 October 7 board prepared for immediate immutable publication · recurring rule updated

- Owner superseded the rolling future-board publication rule. October 7 is a one-time early owner override: publish today's board now and lock it immediately.
- Starting October 8, only the current Toronto calendar date is published. The board workflow starts at 06:00 America/Toronto, builds today's board only, validates it, locks it, and commits the official immutable board. Future-date picks are no longer exposed early.
- Future schedule/research/odds files may continue to be prepared as backend readiness data, but they do not create public selections.
- October 7 pricing gate is waived per owner instruction. No price was invented: unavailable odds remain null.
- October 7 deterministic evidence was refreshed from current Jordan/Armenia women's last-10 and venue aggregate records; player props remain excluded because expected-start/minutes evidence was not publication-grade.
- Postmatch/model-evolution workflow fixed so both performance tracking and postmatch learning actually run and persist. Saved Top-3 candidates at 85%+ are graded, market-family diagnostics are regenerated, and those diagnostics are ingested before later research. Numerical model changes remain small/versioned and require repeated verified evidence.
- No October 5–6 historical pick, odds, confidence, explanation or result was modified.


## 2026-10-07 — v76 odds / EV / market + Team News correction
**Status:** 🟡 Data published on main · UI deployment subject to Vercel quota

- Explicit owner correction to the locked October 7 board: keep the selections/ranks/confidences unchanged, but publish current exact sportsbook pricing, implied market probability and EV where the exact market can be verified.
- Paddy Power current market page verified Jordan or Draw at **1/10** and Over 1.5 Goals at **1/7**. FootyEdge stores the sportsbook’s native fractional prices without converting them. Market probability and EV are derived from those exact prices and the already-saved model probability.
- No exact native price for the exact **Jordan 1+ Goal** team-total selection was verified in the current review, so its price/market/EV remain explicitly unavailable rather than inferred.
- Added explicit Team News review content to the October 7 archive. No role-specific confirmed absence/return with replacement evidence met the threshold for a confidence adjustment; player props remain excluded without expected-start/minutes evidence.
- UI code changes “Why this pick” to **WHY THIS PICK**, keeps TEAM NEWS visible even when the verified review is a no-adjustment result, and displays EV for exact native display prices.
- Historical correction backup and SHA256 audit were appended; October 7 selection/rank/confidence/explanation were not changed.


## 2026-10-07 — v77 restore two-team Team News + form display
**Status:** 🟡 Code/data ready · deployment verification pending

- Restored the previous expanded-analysis Team News layout: separate Jordan and Armenia cards instead of the single generic fallback box.
- Jordan's official federation update says all 24 named squad players took part in the final Aqaba session; this is shown as a continuity/availability note, not an artificial confidence boost.
- Armenia keeps its own card; no late withdrawal, suspension or confirmed key omission met the verification threshold, so the card explicitly records no model adjustment.
- Fixed the October 7 archive's missing form display. Jordan recent form is saved as W-W-L-W-W and Armenia as L-D-L-L-D from current women's-team results sources.
- Corrected display GF/GA fields from raw totals (22/16 and 14/24) to per-match averages (2.20/1.60 and 1.40/2.40), while preserving totals separately.
- No locked pick, rank, confidence, price, EV, market percentage or explanation changed. A second correction backup and SHA256 audit were appended.


## 2026-10-07 — v78 American odds + no-UI-change correction
**Status:** 🟡 Data/code on main · production UI unchanged until normal deploy availability

- Owner clarified that FootyEdge must display odds in American format and that data corrections must not alter the existing UI.
- October 7 exact source prices are now displayed as **-1000** for Jordan or Draw (native source quote 1/10) and **-700** for Over 1.5 Goals (native source quote 1/7). Native fractional quotes remain stored separately for audit/source fidelity.
- Jordan 1+ Goal remains N/A because an exact sportsbook price for that exact market was not verified.
- Reaffirmed the verified archived form fields used by the existing modal: Jordan W-W-L-W-W; Armenia L-D-L-L-D. Per-match GF/GA remains 2.20/1.60 and 1.40/2.40.
- Restored Team News rendering code on main to the pre-change team-card structure; no new layout/fallback presentation is introduced.
- No pick, rank, confidence, Market %, EV, explanation or tracking record changed. Correction backup/audit appended.


## 2026-10-07 — v79 American-odds renderer + expanded-only Team News
**Status:** 🟡 Code ready · deployment verification pending

- Removed Team News from collapsed match cards; Team News remains only in the expanded matchup drawer using the existing two-team card layout.
- Hardened odds rendering so any verified exact price is displayed in American format derived from the stored exact decimal price, preventing fractional notation from leaking into the visible UI.
- No pick, confidence, EV, market probability, reasoning, form, tracking record, or card layout changed.


## 2026-10-07 — v80 live odds refresh + expanded-only Team News compatibility
**Status:** 🟢 Data ready on main · works through live GitHub-backed board loader

- Refreshed October 7 exact current prices from PokerStars Sports: Jordan or Draw **1.08** (display **-1250 American**) and Over 1.5 Goals **1.17** (display **-588 American**).
- Updated implied Market % and EV from those exact current prices while keeping the locked selections/ranks/confidences unchanged.
- Jordan 1+ Goal remains N/A because the exact team-total price still is not verified.
- Added a temporary archive-data compatibility sentinel so the currently deployed legacy renderer suppresses Team News on collapsed match cards while preserving both Jordan and Armenia team-news cards inside expanded analysis.
- Permanent expanded-only Team News code is already on main; once Vercel's free deployment quota clears, the compatibility sentinel can be removed.


## 2026-10-07 — v81 Jordan ML owner override / final lock
**Status:** 🟡 Locked on GitHub main · deployment attempt required

- Explicit owner override changed only Pick #1 for Jordan vs Armenia from **Jordan or Draw** to **Jordan ML** after a fresh risk/price review.
- PokerStars Sports currently lists Jordan Match Result at **1.50 / -200**, which clears the normal -400 floor. FootyEdge's venue-rate Poisson estimate gives Jordan about **78.5%** win probability versus **66.7%** implied by -200, for approximately **+17.8% EV**.
- Rationale: Jordan are **4-2-0 at home** (16-6), Armenia are **0-1-4 away** (4-16), and the model projection remains about **2.93-0.90**.
- Pick #2 and Pick #3 were left unchanged because the owner asked specifically about Jordan ML.
- Team News remains data-populated for both teams but is intended to display only inside expanded analysis. No collapsed-card Team News UI is authorized.
- Board correction backup and audit preserved before the override.


## 2026-10-07 — v82 editorial rewrite standard + women’s-team labels
**Status:** 🟡 Code/rules ready for next morning board

- Added `EDITORIAL_STYLE.md` as the canonical reader-facing writing guide.
- Future WHY THIS PICK, match summaries, Team News, supporting picks and player-prop notes now follow a plain-English football-preview style inspired by current Football Whispers structure without copying its prose.
- Removed model-report wording from the deterministic commentary generator. Reader-facing copy should no longer use phrases such as venue-rate blend, Poisson translation, risk-adjusted fit, positive availability/continuity signal, or FootyEdge/model self-reference.
- Team News impact text no longer adds a mechanical `Impact:` prefix; the sentence should read naturally.
- Women’s fixtures now display `(W)` after team names at the presentation layer, including fixture names, team headers and visible pick labels, without changing provider IDs or odds-matching keys.
- No card layout, theme, spacing or component redesign is part of this change.
- Historical locked explanations remain unchanged unless the owner explicitly asks to rewrite a specific historical board.


## 2026-10-07 — v83 compact Top 3 / stat-box spacing
**Status:** 🟡 Code ready · deployment verification pending

- Owner-requested spacing-only cleanup to the existing game card; no redesign.
- Top 3 selection labels now stay on one line whenever the available card width allows it. The odds/confidence column keeps a fixed compact footprint so text cannot overlap it; genuinely overlong labels truncate rather than creating unnecessary multi-line height.
- Removed unnecessary minimum height / bottom whitespace from the three Top 3 pick boxes and reduced their vertical padding.
- Trimmed the five lower stat boxes vertically while keeping the value and label centered with even spacing.
- Mobile receives the same proportional tightening without changing card structure, colors, typography hierarchy or data.
- No model, pick, odds, confidence, write-up, tracking or historical data changed.


## 2026-10-07 — v84 expanded modal metric / VS alignment
**Status:** 🟡 Code ready · deployment verification pending

- Owner-requested alignment-only cleanup in expanded analysis; no redesign.
- Centered the VS marker vertically between the two flag circles by giving the middle column the same visual height as the flags.
- Tightened the four form/GF-GA tiles and centered each label/value pair as one unit.
- Removed inherited form margin/min-height inside those tiles so W/D/L chips align consistently with the numeric GF/GA row.
- Mobile uses the same alignment with proportional 58px flag/VS height and more compact metric tiles.
- No picks, odds, write-ups, Team News content, model logic, tracking or historical data changed.


## 2026-10-07 — v85 equal expanded metric tiles
**Status:** 🟡 Code ready · deployment verification pending

- Made the four expanded-analysis metric boxes exactly equal in width and height as a uniform 2×2 grid.
- Desktop/tablet tiles are fixed to the same 42px row height; mobile tiles use the same 36px row height.
- No content, data, picks, odds, model logic, Team News, or other layout elements changed.


## 2026-10-07 — v86 Home women’s-team labels
**Status:** 🟡 Code ready · deployment verification pending

- Fixed the Home “Today’s Top 5 Picks” renderer so women’s fixtures use the same `(W)` display convention as Today’s Picks.
- Example: `Jordan (W) vs Armenia (W)` and `Jordan (W) ML`.
- This is display-layer only; raw team names, provider IDs, odds matching, locked picks and historical data remain unchanged.
