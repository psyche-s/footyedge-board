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
- Historical daily files are immutable after publication except for factual corrections.
