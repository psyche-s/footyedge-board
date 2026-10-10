# FootyEdge research-model reset (specification, not deployed)

Status: replacement model NOT yet implemented or validated. Keep the existing site and historical Hit Rate records intact until a new model passes tests.

Inputs: verified last-10 and last-5 all-competition form; home/away splits; goals for/against; BTTS; totals; league strength; dated H2H scores; xG/xGA and shooting where accessible; squad news, rest, travel and tactical matchups only when confirmed. Never fill missing statistics with guesses.

Independent research cross-checks: Forebet, eScored, PredictZ, TheDatabetics, Action Network, OLBG, Sports Mole, Football Whispers, FBref, WhoScored, Soccerment Xvalue and independently verified expert analysis. Respect access restrictions. Record source URLs, timestamps and conflicting predictions internally. These sources must NOT appear in public FootyEdge explanations; never copy their writing.

Model: independently fit time-decayed league/team goal strengths using Poisson/Dixon-Coles, derive coherent 1X2/DC/BTTS/totals probabilities, and calibrate out-of-sample by league and market. Cross-check with independent sources and lower confidence for contradictions. Confidence must be calibrated and not artificially pushed to 85. Publish up to five qualifying picks at 85+ with individually verified bookmaker odds no worse than -500. If fewer qualify, publish fewer. Fiorentina X2 requires its own verified double-chance price; do not reuse ML odds.

Writing: explain recent W/D/L and scoring trends, opponent weaknesses, actual H2H outcomes, and verified squad/tactical considerations in short original natural-language paragraphs. Explicitly flag contradictory evidence. No jargon, no model mechanics, no third-party brand names on the public site.

Rollout: implement accessible source adapters and provenance; backtest and calibrate; shadow-run the full men's slate; validate each pick, its odds and reasoning; switch builder only after successful checks; preserve UI, prior board snapshots, 7 AM freeze, and immutable settlement. Existing static builder remains legacy until these gates pass.
