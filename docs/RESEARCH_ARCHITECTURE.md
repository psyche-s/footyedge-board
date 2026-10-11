# FootyEdge — Research Pipeline

## Operating contract

The published 12:30 AM Toronto board is immutable. New research and live scores do not edit locked selections.

1. **Score service:** `/api/live-scores?date=YYYY-MM-DD` uses a current ESPN result feed and a 25-second CDN cache. The client polls independently from prediction publishing (45 seconds live, 90 seconds near kickoff, slower otherwise). Czech and any other uncovered leagues show unverified rather than fake LIVE.
2. **Historical scouting:** GitHub Actions runs `scripts/analytics_pipeline.py` separately at roughly 00:12 Toronto. Football-Data's current/prior season match CSVs are cached in SQLite, keyed by exact league, club, kickoff and source. The dated `data/analytics/*.json` file is a **shadow overlay**, not a model probability or published pick. A league with missing data is absent, never auto-filled.
3. **Advanced statistics:** Use optional audited `soccerdata` / `ScraperFC` adapters to read FBref defensive/attacking profiles and Understat `read_shot_events` (not `read_shot_location`); StatsBomb's `statsbombpy` for **licensed open-data seasons only**. Keep original event coordinates, shot xG, model version, provider timestamps, sample size and club IDs. Never infer xG, PPDA, field tilt or lineups from scores. Do not force heavy Python dependencies onto Vercel.
4. **Pre-match context:** Evaluate lineups, injuries, rotation, rest and tactical matchup from independent reviewed coverage. Keep research URL/evidence in internal records and publish original plain-language reasoning without naming individual news/preview sites.
5. **Probabilities and odds:** Fit/backtest time-decay Dixon–Coles chronologically before promoting new calibrated probabilities. Separate observed past hit rates (e.g. 8/10) from predicted match probabilities. Calculate EV only from **bookmaker-specific, timestamped, exact market** prices. Odds aggregators and OddsHarvester are experimental, not unlimited sources of verified sportsbook odds. No anti-bot evasion or impersonation; respect access rules and rate limits.
6. **Logo source:** The requested `Leo4815162342/football-logos` GitHub repository contains competition/country overview images, not individual club logo files. Keep the existing verified single-team registry, exact alias mapping, and neutral initials for genuinely missing crests rather than a wrong badge.

## Review gates
- No women's fixtures.
- Last-5 and last-10 sample denominators from completed pre-kickoff matches.
- H2H only for exact teams and verified match dates.
- No silently substituted cross-league/other-season events.
- Source availability, raw coverage, provider timestamp and extraction errors recorded.
- Locked board byte-identical through UI/source research updates; live scores update independently.
- Zero verified sportsbook prices ⇒ no displayed odds/EV, and no claim of 90% model confidence based on a trend rate.

## Release status
Live score polling and club-name aliases are deployed. Football-Data/SQLite scouting is a separate shadow data job. Current broader advanced adapters require data-access checks and holdout testing before promotion to production rankings.
