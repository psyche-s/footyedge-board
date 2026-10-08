# FootyEdge project rules

## Published picks: owner rule, 2026-10-07
Once any pick is published it cannot be altered unless Shaif explicitly asks for that specific change. This applies to every game's picks, Top 3, player props, alternatives and global/league Top 5, including order, market/line, confidence, published odds/EV and pre-match explanation/evidence.

- First publication freezes the complete board in `data/boards/YYYY-MM-DD.json` BEFORE public pages display picks. 06:00 Toronto is the target publication time, never permission to rewrite an earlier publication.
- Current and historical pages, Home, filters, expanded analysis and tracking must use that snapshot. Refreshes, news, lineup changes, model changes and deploys must not regenerate selections for published dates.
- Automatic updates may change scores/status/settlements and append later observations separately. Learning applies to future boards only.
- Missing historical selections/explanations must remain explicitly unavailable. Never backfill them with a current model and call them original.
- Explicit owner corrections preserve the previous board in `data/board-revisions/` and append an audit entry with the exact instruction, before/after SHA256 and backup path. They must never erase prior records or silently improve the performance record.
- Before commit/deploy run `node scripts/validate-published-boards.mjs --base <main SHA before your changes>` and meaningful regression tests. Do not change a published board, historical odds or research to satisfy newer model validation.
- No UI redesign is authorized by model/data/publishing tasks. The owner explicitly requested the existing tracking panel display `Oct Tracking | 2026 Tracking`, a center divider and `Hit Rate` capitalization; use actual official monthly/YTD results only.

- Owner also explicitly requested accurate no-game states on Home and Picks: say no games and display the next confirmed men's game date. Distinguish unpublished picks and provider failures from an empty schedule. Check the next four days for schedule awareness only; never research, price, model or publish future-date betting content.

## Men's soccer and today-only publication: owner rule, 2026-10-08
- Exclude every women's club and international fixture before schedule discovery, research, odds ingestion, model scoring, archives, tracking and UI rendering. Do not restore a women's event from a cache or fallback.
- Betting research, odds, Top 3, Top 5, player props, confidence and commentary are only for the current Toronto calendar date. Future dates are fixtures/schedule status only.
- Before each current-day selection run, review every saved frozen Top-3 pick from completed historical games, regardless of confidence. Preserve rank, line, odds, confidence and explanation; never reconstruct missing historical positions.
- Record result and process grade separately as GOOD, MIXED or BAD. Make only small, versioned model changes after repeated evidence across rolling diagnostics.

- Owner's subsequent UI instruction: move the Picks tracking/previous-picks section to a dedicated Hit Rate page, with navigation Home / Today's Picks / Hit Rate / About. Retain Home's summary. Hit Rate uses the Home style, month/YTD first, then current-month daily Top 5 tables newest first with uppercase left-aligned dates, hit/miss marks and score-only text. The visible history resets by the Toronto calendar month; stored history is preserved.

- Owner's header instruction: Today’s Picks uses the same single-row header as Home/About/Hit Rate, with FootyEdge on the left and Home / Today's Picks / Hit Rate / About on the right. Remove the separate second branding/tagline row.
