# FootyEdge Original: SGP evidence and odds acceptance standard

Effective for future research and non-destructive same-day overlays from **2026-11-05**. This is a review standard, not evidence that any quoted market is available in Ontario. The historical frozen board is not rewritten.

## 1. Eligible market families
- Player **fouls won** and **fouls committed** are separate statistics. Never substitute one for the other.
- Player **shots** and **shots on target** are separate but overlapping outcomes. Same-player SOT and shots are not independent SGP legs.
- Match/team corners and booked cards require separately sourced event frequencies and explicit settlement rules.
- Full-match goal O/U, team goals, BTTS, 1X2 ML and double chance need matching model distributions and opponent-adjusted historical results. Asian integer lines have push rules; do not silently present them as half-lines.
- Prefer data-rich markets; a published market/price does **not** establish a positive trend or successful projection.

## 2. Required per-leg research
Before a leg is labeled researched or recommended, preserve the fixture ID, market type, player/team ID if relevant, exact line/side/period/unit, settlement rules, verified historical provider, timestamp and a football-specific rationale. Screen *pre-kickoff* last-five and last-ten form, home/away role, matchup strength, opponent event allowances, probable starting XI, expected minutes and rotation. Event props need **at least five verified applicable matches for the selected team/player AND five opponent allowance observations**; prefer 8–10 or more and downgrade small or mismatched samples. Unknown means unknown, never zero. Player props also need explicit player identity and a confirmed or attributed predicted role with believable minutes, not just a guessed name.

Example rejection: "Under 9.5 corners because the bookmaker posted the line" lacks corner data. "Over 3.5 bookings; referee needs checking" lacks referee/booking evidence. Neither belongs in a best SGP. Do not substitute a goal model for a shots/fouls/corners model or create confidence percentages without event evidence.

## 3. Price, value and correlation discipline
1. Match quoted odds to the **same fixture, selection, market line, settlement rule, sportsbook, country and observation time**. ESPN-reported DraftKings/Pinnacle/other foreign quotes are **reference prices**, not bet365 Ontario confirmed availability.
2. Individual quoted SGP legs **cannot** be multiplied to obtain an executable same-game return. Only a direct, time-stamped Ontario bet-builder quote confirms the combined price. With no verified combined quote, label **HOLD / PRICE PENDING**, not "qualified +150".
3. Compare model frequency with implied break-even and evidence coverage before considering a leg. Significant contrary signals require a review; do not label model-below-breakeven selections as safe or best value by default. **No empirical positive EV claim without walk-forward calibration**. A theoretical experimental difference must be labeled as such.
4. Treat 1X2 + goals, BTTS + goal totals, shots + SOT, and teammate/team event legs as potentially correlated. Suppress redundant or contradictory legs; use actual joint simulation when sufficiently validated, not multiplied single-leg probabilities.
5. League SGPs target +150 and the cross-game parlay +300 **only with validated executable prices**. Strong two-leg research beats a contrived five-leg ticket. Unavailable evidence becomes PASS; unconfirmed price becomes HOLD.

## 4. Publication and QA
- Per SGP publish selected fixture, exact market/line, verified sample and opponent allowance, concise original football-specific WHY, research grade (not calibrated win probability), source provenance privately, full price status, and correlation caveat. No generic boilerplate, invented quotes, implied certainty or bookmaker names in public match explanations.
- Screen every candidate against recent match evidence, the dated experimental model and the same-day verified odds snapshot. Each unsupported leg must be removed or marked explicitly **PASS** instead of silently filling the basket.
- Do not alter existing frozen picks/history. Do not publish started games as pre-match advice. Keep English Championship `eng.2`, J1 and K1 out of SGP/ACCA while retaining other eligible major men's competitions.
- Changes to this standard require repeatable unit tests and a human-readable missing-market coverage audit. No production deployment without the owner's deployment authorization.
