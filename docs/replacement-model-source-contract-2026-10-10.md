# FootyEdge replacement model — source and publication contract

This supersedes Dixon–Coles and earlier home-grown prediction engines **for future official selections**. Historical frozen boards remain immutable for audit and hit-rate grading.

## Research inputs (internal only)
- Forebet: match probabilities, predicted score, goal totals, where publicly accessible
- eScored: published probabilities, Poisson/XGBoost context and EV where accessible
- PredictZ: form, standings, score prediction
- TheDatabetics: model forecasts and context where accessible
- Football Whispers: match previews, attacking player picks and relevant matchup analysis
- Action Network Soccer: public market and line-movement context
- OLBG: independently tracked football tips with documented sample size
- Sports Mole: injuries, lineups, rotation, tactics and match previews
- Doc's Sports / Arun Shiva and WagerTalk / Carmine Bianco: independently verifiable published previews, not assumed endorsements
- FBref, WhoScored, Soccerment xvalue.ai: independently checkable xG, shot creation, team/player metrics, where available
- ESPN/official league feeds and licensed odds feeds: fixture identity, final results and exact price verification

Do not claim every provider was consulted when access was denied, paywalled, stale, missing, or blocked. Log provider, timestamp, URL, fixture mapping and exact supported facts internally. Never scrape around access restrictions.

## Selection rules
1. Men's fixtures for the current Toronto date only; future dates for fixture research only.
2. Check identity, kickoff, competition, lineups, injuries and latest available last-10 / last-5 / H2H samples; report actual sample sizes.
3. Normalize independent data into form, chance quality, tactical matchup, personnel and market context. Separate original evidence from correlated prediction-site opinions.
4. Use a transparent scoring rule with documented source availability and penalties for missing/contradictory evidence. Never assign arbitrary 90%+ outcome probabilities; calibrate on held-out historical predictions before labeling scores as probabilities.
5. Compare ML, double chance, handicap, goals, BTTS and eligible player markets. Only show exact verified sportsbook odds; use the configured -500 minimum price floor. No fabricated lines or odds.
6. Write original, concise match-specific 'why this pick' explanations based on numerical evidence and verified situational context. Do not copy previews or mention research-source names on the public UI.
7. Rank Top 3 per fixture and up to five distinct strongest global selections; fewer than five is acceptable when fewer qualify. Store ranking criteria, conflicts and abstentions.
8. Freeze original official board snapshots. Publish revised selections only as timestamped, versioned corrections with audit history, never silently overwrite the original.
9. Validate source provenance, fixture coverage, score calibration, write-up support, odds freshness, UI integrity and deployment before announcing live status.

## Implementation gate
This policy alone does not implement the new engine. The prior Dixon–Coles shadow model and evidence-conviction score must **not** be advertised as this replacement. Production promotion requires a working source adapter, tests, evaluated predictions and an audited new revision.
