# FootyEdge project rules

## Latest owner publication rule — 2026-10-07 (supersedes rolling future-board publication)
- **October 7 only:** the owner explicitly instructed FootyEdge to publish and lock today's board immediately, before the normal morning lock. This one-time override is the official October 7 board and is immutable unless Shaif explicitly requests a correction.
- **Starting October 8:** publish only the **current Toronto calendar day's** picks. Start the board workflow at **06:00 America/Toronto**, build the current-day board, and lock it as the official board in the same run. Do not publish future-date picks early.
- Future schedule/research/odds snapshots may still be prepared in advance for readiness, but they are backend data only. They must not create a public pick board before that date's 06:00 run.
- Pricing is not required to publish a pick. Missing odds stay blank/null. If an exact native sportsbook price is available, preserve it exactly, apply the -400 floor, and never infer/convert a fake official price.
- At the moment the daily board is locked, every selection/rank/confidence/explanation becomes immutable. Automatic later news/price/model changes cannot rewrite it.
- The evolving-model loop remains mandatory: grade every saved Top-3 candidate at 85%+ after completion, separate outcome from process quality, verify red cards/penalties/VAR/injuries/late lineup changes before learning from them, maintain market-family diagnostics, ingest those diagnostics before the next research run, and make only small documented/versioned model changes supported by repeated verified evidence.
- Explanation-quality review remains part of the postmortem: check whether the original "Why this pick" used the strongest predictive evidence, missed opponent/team-news context, or made unsupported causal claims. Never rewrite the historical explanation after the fact.

## Rolling previews and official lock: owner rule, 2026-10-07
The owner's latest instruction supersedes the earlier first-publication freeze. FootyEdge publishes rolling preview boards for today plus the next four Toronto calendar dates. Preview picks may change during morning refreshes. The official board becomes immutable at **06:00 America/Toronto on the fixture date** and cannot change afterward unless Shaif explicitly overrides that date.

- Mutable public previews live in `data/board-drafts/YYYY-MM-DD.json`. They may be regenerated from current research, team news, model evidence and pricing until the 06:00 lock boundary.
- At/after 06:00 Toronto, the latest preview is promoted once into `data/boards/YYYY-MM-DD.json` as the official locked record. Public pages prefer the official board whenever it exists.
- Automatic refreshes must never change the current date's draft or official board after 06:00. Scores/status/settlements and later postmatch observations remain separate from the locked pre-match board.
- Explicit owner corrections after lock preserve the previous board in `data/board-revisions/` and append the existing audit trail before any change.
- Missing historical selections/explanations must remain explicitly unavailable. Never backfill them with a current model and call them original.
- Explicit owner corrections preserve the previous board in `data/board-revisions/` and append an audit entry with the exact instruction, before/after SHA256 and backup path. They must never erase prior records or silently improve the performance record.
- Before commit/deploy run `node scripts/validate-published-boards.mjs --base <main SHA before your changes>` and meaningful regression tests. Do not change a published board, historical odds or research to satisfy newer model validation.
- No UI redesign is authorized by model/data/publishing tasks. The owner explicitly requested the existing tracking panel display `Oct Tracking | 2026 Tracking`, a center divider and `Hit Rate` capitalization; use actual official monthly/YTD results only.

- Owner also explicitly requested accurate no-game states on Home and Picks: say no games and display the next confirmed game date. Distinguish unpublished picks and provider failures from an empty schedule. Check and prepare the next four days; never invent picks or odds to fill future dates.

- Owner's subsequent UI instruction: move the Picks tracking/previous-picks section to a dedicated Hit Rate page, with navigation Home / Today's Picks / Hit Rate / About. Retain Home's summary. Hit Rate uses the Home style, month/YTD first, then current-month daily Top 5 tables newest first with uppercase left-aligned dates, hit/miss marks and score-only text. The visible history resets by the Toronto calendar month; stored history is preserved.

- Owner's header instruction: Today’s Picks uses the same single-row header as Home/About/Hit Rate, with FootyEdge on the left and Home / Today's Picks / Hit Rate / About on the right. Remove the separate second branding/tagline row.

## Morning publication gates, 2026-10-07
- “Why this pick” belongs directly under Pick #1 and uses 1–3 strongest deterministic/model facts. Never rewrite archived explanations or evidence.
- Team-news model adjustments require current sourced status plus explicit role, importance, replacement quality and causal evidence. Uncertain news stays uncertain.
- ATGS, Score-or-Assist, assist and multi-goal player selections require credible expected-start and minutes evidence; material rotation/injury risk excludes the prop.
- Pricing is **not** a publication gate for rolling previews. A strong model selection may publish with odds pending. When an exact price exists, it must be verified/native, the normal -400 floor still applies, and safer adjacent-line optimization remains active. At 06:00 the board locks with the latest available verified price; missing prices remain blank rather than blocking the lock or being backfilled later.
- Postmatch learning grades saved Top-3 candidates at 85%+ separately from process quality. Never infer a red-card, injury, VAR or luck explanation from the score alone; verify it before learning from it.

## Live data horizon, 2026-10-07
- Every morning/data refresh must push dated schedule/fixture/odds snapshots for the Toronto current date plus the next 4 calendar dates. `latest-*` remains an alias for the current Toronto date only.
- Deterministic research bases are also rebuilt for today + next 4 days. Future research/data may refresh freely until publication.
- Future picks are published as rolling previews whenever tracked fixtures/model research are available; missing prices do not block preview publication. Future previews remain mutable until their own fixture date reaches 06:00 Toronto.
- Mobile date navigation must keep Previous / date / Today / Search / Next on one horizontal row. League-filter logos must use a transparent icon footprint; unknown competitions use the transparent SVG football fallback, never a boxed emoji.

## Future-board rolling-preview clarification, 2026-10-07
- Show usable model boards for today plus the next 4 Toronto dates as soon as the slate/model can be built; do not wait for sportsbook pricing.
- Re-run the rolling previews every morning after research/data refresh. Pricing, team news, confidence and pick ordering may change on those preview dates.
- At 06:00 Toronto on the fixture date, promote the latest preview to the immutable official board. No automatic pick/price/confidence/explanation changes are allowed after that boundary. Shaif may explicitly override a locked date through the audited correction process.


## Odds / EV / Market display rule — owner instruction 2026-10-07
- For every published Top 3 selection, actively search for the exact selected market at a current reputable sportsbook before lock. When verified, publish the exact native price, its implied market probability, and EV computed from the saved FootyEdge model probability and that exact price.
- Never infer, synthesize or convert an unavailable official price merely to fill the UI. When the exact selected market cannot be verified, show it explicitly as N/A/unavailable rather than pretending a price exists.
- Preserve the established -400 qualifying floor for normal selection optimization. If the owner has already locked/overridden a selection before a later price is added, do not silently replace the pick; record the price-floor conflict and preserve the audit.
- “WHY THIS PICK” is always uppercase in expanded analysis.
- “TEAM NEWS” must always be visible in expanded analysis. If there is material verified news, show the concise football/market impact. If no material item meets the verification threshold, explicitly say so and state that no model adjustment was made.


## Expanded Team News / form presentation rule — owner instruction 2026-10-07
- Keep the established expanded-analysis Team News presentation as two team-specific cards, one for each side. Do not collapse it into a single generic research box.
- Each team card should show the highest-value verified news/availability note and its model/market impact. If no material item is verified, keep that team's card and explicitly say no material verified update/no model adjustment.
- Published/archive payloads must populate the recent-form string expected by the UI (for example: W D L W W) whenever verified results are available.
- GF/GA display fields are per-match averages, not raw goal totals. Preserve raw totals separately if needed for evidence/audit.


## Display-format preservation rule — owner instruction 2026-10-07
- FootyEdge displays sportsbook odds in **American format**. If a source publishes fractional/decimal odds, preserve that native source quote separately for audit, but convert only the display notation to its exact American equivalent.
- Do not redesign or reformat the UI when the owner asks for data, odds, form, Team News, model, research or publishing corrections. Preserve the existing visual components and layout unless the owner explicitly requests a UI change.
- For archived/current boards, verified form must populate the exact model fields consumed by the existing UI; do not replace verified form with dashes when the result sequence is available.


## Team News visibility rule — owner instruction 2026-10-07
- Team News appears **only inside expanded/full match analysis**. Do not render Team News on collapsed match cards, Top Picks rows, Home summaries, or other compact views unless the owner explicitly asks for it.
- Preserve the existing two-team expanded Team News card layout.


## Editorial writing standard — owner instruction 2026-10-07
- Read and follow `EDITORIAL_STYLE.md` before generating any reader-facing summary, Team News, WHY THIS PICK, Pick #2/#3 commentary or player-prop explanation.
- Current Football Whispers previews are an editorial reference for clarity and structure only: short key stats, simple form language, concise team news and an easy-to-follow reason for the pick. Never copy source prose.
- Reader-facing copy must sound like a football preview written for a person, not a model report.
- Do not mention FootyEdge, the model, Poisson calculations, internal scoring, venue-rate blends, risk-adjusted fit, probability-edge jargon or internal process language in normal write-ups. Keep those calculations internal or in dedicated numeric UI fields.
- WHY THIS PICK should normally be 2-4 short sentences or up to three compact evidence bullets. Lead with the football reason, then the strongest supporting stat(s), then a plain conclusion.
- Team News should name the important player/status first, then explain the likely football effect in ordinary language. If no material news is verified, say so simply.
- Pick #2/#3 notes should be shorter than Pick #1 and should not repeat the full argument.
- Any reader-facing women's team name must include `(W)` after the team name. Keep raw provider/team IDs unchanged internally.
- This is a writing/data-label change only. Do not redesign the UI to implement it.

## Logo source-of-truth rule — owner instruction 2026-10-07
- Use `football-logos.cc` as the upstream source for reusable competition and club/team logos.
- Store cached copies in this repository under `assets/logos/`; production should prefer the repo-local asset instead of external hotlinks.
- `data/logo-sources.json` is the canonical upstream source list. `scripts/sync-football-logos.mjs` refreshes the cache and records source URLs in the generated manifest/registry.
- Preserve the approved national-team/country display treatment: national sides continue to show circular flags unless the owner explicitly changes that rule.
- External/API team logos are fallback-only when a matching local cached club logo is unavailable.
- Keep football-logos.cc attribution/source metadata in the repo as requested by the upstream site.
