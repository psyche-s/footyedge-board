# FootyEdge project rules

## Published picks: owner rule, 2026-10-07
Once any pick is published it cannot be altered unless Shaif explicitly asks for that specific change. This applies to every game's picks, Top 3, player props, alternatives and global/league Top 5, including order, market/line, confidence, published odds/EV and pre-match explanation/evidence.

- First publication freezes the complete board in `data/boards/YYYY-MM-DD.json` BEFORE public pages display picks. 07:00 Toronto is the target publication time, never permission to rewrite an earlier publication.
- Current and historical pages, Home, filters, expanded analysis and tracking must use that snapshot. Refreshes, news, lineup changes, model changes and deploys must not regenerate selections for published dates.
- Automatic updates may change scores/status/settlements and append later observations separately. Learning applies to future boards only.
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
- Exact native sportsbook prices are mandatory for every published selection/alternative; no synthetic or display-only pick may be frozen.
- Postmatch learning grades saved Top-3 candidates at 85%+ separately from process quality. Never infer a red-card, injury, VAR or luck explanation from the score alone; verify it before learning from it.

## Live data horizon, 2026-10-07
- Every morning/data refresh must push dated schedule/fixture/odds snapshots for the Toronto current date plus the next 3 calendar dates. `latest-*` remains an alias for the current Toronto date only.
- Deterministic research bases are also rebuilt for today + next 3 days. Future research/data may refresh freely until publication.
- Future PICKS are different from future DATA: never publish/freeze future picks merely because schedule, research, fixtures or odds snapshots exist. A date's selections publish only after its full verification gates pass, then become immutable.
- Mobile date navigation must keep Previous / date / Today / Search / Next on one horizontal row. League-filter logos must use a transparent icon footprint; unknown competitions use the transparent SVG football fallback, never a boxed emoji.

## Future-board publication clarification, 2026-10-07
- The owner wants usable picks visible for today plus the next 3 Toronto dates whenever those future dates already satisfy the same publication gates. Do NOT wait until the calendar reaches that date merely because it is in the future.
- Future boards may therefore publish early after complete research, current team-news review, qualifying exact native sportsbook prices and validation. The instant a future board is first exposed publicly, its full picks/odds/confidence/explanations freeze under the same immutable rule.
- If a future date has fixtures and prices but its research/news review is incomplete, show "Picks have not been published yet" for that date; do not synthesize or downgrade the gates.
