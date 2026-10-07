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
