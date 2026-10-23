# FootyEdge V3 — isolated design preview

**Status:** preview concept only. Do not merge into \`main\` without explicit user approval. Original FootyEdge production, daily data refresh and FootyEdge V2 remain untouched.

## Intent
- Shorter, broadcast-style **match cards**, retaining the existing verified score, team colours/crests, form, standings, lineups, match analysis and tabs.
- Balanced **three-column grid**: left team / protected centre score or kickoff / right team. Team names remain inside their columns and badges remain aligned.
- A calmer, premium dark slate/forest palette with a subtle embossed club texture and lower-saturation overlays.
- More legible matchday navigation: date switcher, status tabs, league picker and search.
- Two-column board on desktop; one-column cards on mobile.
- No sportsbook odds or EV introduced on fixture cards.

## Reference patterns (inspiration, not copied layouts or assets)
- FotMob match detail hierarchy and pre-match kickoff clarity.
- OneFootball date-based match navigation.
- Modern dark sports dashboard layouts with modular hierarchy.

## Scope / safety
Only \`ui/part1.html\` (top-level presentation), \`picks.html\` (cache bust), \`assets/footyedge-v3-preview.css\`, and a regression test were changed. The data model, all predictor logic, API, fixture source files and detailed match modal code remain identical to original production. The preview is accessed through a Vercel preview deployment built from this branch.
