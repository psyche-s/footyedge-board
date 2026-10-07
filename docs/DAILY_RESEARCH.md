# FootyEdge Daily Research Layer

FootyEdge separates the statistical model from editorial research.

## Daily timing
- 06:15 America/Toronto: build `data/daily-insights-YYYY-MM-DD.json`.
- 07:00 America/Toronto: publish/freeze the daily odds snapshot.
- The research file must exist before the final board is considered ready.

## Research hierarchy
1. FootyEdge's own last-10 / home-away / competition form and H2H data.
2. Confirmed injuries, suspensions and lineups from API-Football.
3. Football Whispers exact-fixture preview/key stats.
4. Sportskeeda exact-fixture preview/key numbers when available.
5. Other reputable public sources only when they add a verifiable fact.

External previews are a cross-check, not the base model. Never copy article prose. Summarize only facts that can be tied back to the fixture.

## High-value facts
Prioritize facts that change how a pick is interpreted:
- H2H: recent meetings, result pattern, BTTS/total-goal pattern.
- Last 5 / last 10: wins, losses, unbeaten/winless runs.
- Scoring droughts: failed to score in N straight or N of last 10.
- Defensive trends: clean sheets, repeated concessions.
- Goal totals: repeated U2.5/U3.5/O1.5/O2.5 patterns.
- Home/away splits when materially different.
- Confirmed key absences/suspensions and likely effect.

Do not add trivia, player shot stats, historical facts with no current relevance, or generic prose.

## Output limits
For each fixture:
- max 5 facts
- each fact should normally be one sentence and under 22 words
- max 3 supportedMarkets
- max 3 source records
- sources stay internal; the UI displays the synthesized facts, not source branding

## JSON shape

```json
{
  "date": "YYYY-MM-DD",
  "generatedAt": "ISO timestamp",
  "fixtures": [
    {
      "home": "Home Team",
      "away": "Away Team",
      "facts": [
        {
          "text": "Away Team are winless in their last five away matches.",
          "tags": ["result", "form"]
        }
      ],
      "supportedMarkets": ["Home Team or Draw", "Under 3.5 Goals"],
      "sources": [
        {
          "name": "Football Whispers",
          "url": "https://...",
          "checkedAt": "ISO timestamp"
        }
      ]
    }
  ]
}
```

## Model guardrails
- Daily research can add only one bounded agreement signal; it cannot override the model.
- The total external cross-check contribution remains capped at the existing two-source weight.
- A supported market should be listed only when the underlying FootyEdge stats and at least one current external preview point the same way.
- Conflicting external opinions are recorded as context but must not be converted into a confidence boost.
- Historical daily files are immutable after publication. Factual corrections require Shaif's explicit instruction and a preserved before/after audit.


## Published-price gate
- A pick is not eligible for Top Picks unless FootyEdge has a verified actual sportsbook price for that exact market.
- Never use model-fair, inferred, synthetic, or derived prices to satisfy this requirement.
- Prices worse than -400 are excluded from Top Picks. -400 itself is allowed.
- Morning price discovery should try connected odds APIs first, then exact sportsbook market feeds, then reputable public web sources.
- Preferred sportsbook order remains DraftKings, FanDuel, ESPN BET when available; if none has the exact market, a reputable regulated sportsbook line may be used as a fallback.
- Record the sportsbook/source internally even when the UI does not display branding.
- If no exact verified line is found after reasonable checks, leave the market unranked rather than publishing it with a dash.


## Deterministic research base
- `scripts/build-research-base.mjs` runs before the morning editorial research.
- It writes `data/research-base-YYYY-MM-DD.json` from FootyEdge/ESPN schedule history only.
- This layer is deterministic and audit-friendly: each generated fact includes structured evidence describing the sample, numerator/denominator, streak length, split, or H2H record.
- The UI loads this file as a preferred statistical support layer. If it is unavailable, the client still computes the same style of trends from live schedule history.
- External sources never replace or rewrite deterministic evidence; they can only add current context or confirm a market direction.

## Pre-publish validation
Run `node scripts/validate-daily-board.mjs` before production publication.
The validator checks:
- date alignment across research, insights and odds;
- tracked-fixture matching;
- duplicate/overlong research facts;
- source URL validity;
- odds value validity and source metadata;
- missing event coverage warnings.

A failed validation means the board is not ready to publish.

## Published selections
All picks are locked at first publication, including every game and player prop, not just Top 5. Follow `AGENTS.md`. Publish a complete durable snapshot before displaying picks; scores and settlements update separately. Missing original history is unavailable, never regenerated.
