# FootyEdge research source registry

Updated: 2026-10-23

This is the research/reference source inventory for the **original FootyEdge**. It supplements existing football-data sources. It is **not** a claim that any source has a live API integration or approved automated scraping access. Select the right evidence for each market and use only licensed, permitted, or publicly reusable data in automated pipelines.

## 1. Statistics, events, and historical trends

| Source | Primary use | Operational note |
|---|---|---|
| [StatsBomb](https://statsbomb.com/) | Event data, shot quality, advanced metrics, tactical analysis | Professional datasets are licensed; use [StatsBomb open data](https://github.com/statsbomb/open-data) where relevant and permitted |
| [Wyscout](https://wyscout.com/) | Scouting, player events, tactical indicators | Commercial access/licensing required for most data |
| [FBref](https://fbref.com/) | Player/team seasonal statistics, match logs and history | Confirm each metric remains available; avoid assuming prior advanced-data coverage |
| [Understat](https://understat.com/) | xG/xGA/xA, shot quality, finishing and defensive trends | League/season coverage varies |
| [FootyStats](https://footystats.org/) | Goals, BTTS, clean sheets, home/away trends, corners and cards when covered | Check data access rules and sample sizes |
| [StatBunker](https://www.statbunker.com/) | Historical player, team, referee and competition statistics | Verify season, competition and data definitions |
| [Soccerbase](https://www.soccerbase.com/) | Historical fixtures, results, lineups and form | Mainly useful where its league coverage is strong |
| [WhoScored](https://www.whoscored.com/) | Player statistics, role/position, team tendencies and match ratings | Research reference; do not assume public API access |
| [The Analyst](https://theanalyst.com/) | Opta-powered analysis, predictions, advanced statistical context | Editorial/research reference; licensed underlying data |
| [StatsZone](https://www.fourfourtwo.com/) | Historical positional/visual match analysis where available | **Provider/product identity and current data availability must be verified** before integration |
| [AIstats](https://aistats.com/) | AI-assisted football analytics cross-check | Treat outputs as secondary hypotheses, not verified primary statistics |
| [FotMob](https://www.fotmob.com/) | Match/team/player stats, shot maps, xG and lineups | Useful for checking current fixtures, including J1/K1 where covered |
| [Flashscore](https://www.flashscore.com/) | Live/final results, H2H, form, match events and lineups | Reference verification only unless permitted feed is obtained |
| [ESPN](https://www.espn.com/soccer/) | Fixtures, lineups, team statistics, player details and match reports | Coverage varies by league |
| [OneFootball](https://onefootball.com/) | Fixtures, scores, team and player news, match information | Deduplicated from user input (listed twice) |

## 2. Team news, absences and scouting

| Source | Primary use |
|---|---|
| [Transfermarkt](https://www.transfermarkt.com/) | Injuries, suspensions, transfers, squad information, minutes and positions |
| [Premier Injuries](https://www.premierinjuries.com/) | Premier League injury/availability news; confirm current status with club reports |
| [The Athletic](https://www.nytimes.com/athletic/football/) | Reported team news, tactics, player roles and managerial context |
| [Bleacher Report](https://bleacherreport.com/world-football) | Broad team/news reporting; verify material claims against stronger sources |
| Official club, league, UEFA and national-team sites | Highest-priority source for confirmed XIs, suspensions, squad announcements and official match status |
| FotMob, Flashscore, ESPN, OneFootball | Secondary lineup/team-news cross-checks; label projected vs confirmed |

## 3. Prediction and market-context cross-checks

| Source | Primary use |
|---|---|
| [Football Whispers](https://footballwhispers.com/) | Match previews, projected outcomes and selection reasoning |
| [Sports Mole](https://www.sportsmole.co.uk/) | Previews, probable teams and injuries |
| [Sportskeeda](https://www.sportskeeda.com/football) | Match previews and tactical context |
| [Forza Football](https://forzafootball.com/) | Fixture/team-news context and coverage when available |
| [Forebet](https://www.forebet.com/) | Model projections; sanity-check against current team news |
| [WinDrawWin](https://www.windrawwin.com/) | Form and statistical prediction cross-checks |
| [Betfair Stats Centre](https://www.betfair.com/) | Conditional reference for betting-market/statistical context; verify the precise stats-centre product and permitted access before relying on it |
| AIstats, FootyStats, The Analyst | Additional independent forecast/statistical perspectives |

## 4. Existing underlying data and reference stack — retain

- [Football-Data.co.uk](https://www.football-data.co.uk/) and [OpenFootball](https://github.com/openfootball) — structured historical results.
- [football-data.org](https://www.football-data.org/) and API-Football — where authenticated API access and per-competition coverage permit.
- [ClubElo](http://clubelo.com/) — relative team strength where covered.
- [TheSportsDB](https://www.thesportsdb.com/) — reference imagery/metadata subject to usage rights.
- Other existing feeds and the private football-data-hub remain in place; this registry adds sources rather than replacing a functioning data pipeline.

## 5. Source-selection rules for each daily slate

1. **Fixtures / status / score:** prioritize official feeds and licensed structured APIs; cross-check when discrepancies matter.
2. **Probable XI / injuries / suspensions:** club/league confirmation first; reputable reporters and lineup services second. Clearly distinguish **projected** from **confirmed** XIs (confirmed typically around matchday release). Do not invent unavailable information.
3. **Picks / reasoning:** compare Football Whispers, Sports Mole, Sportskeeda, Forebet, Forza, WinDrawWin and other applicable opinions against primary quantitative evidence (home/away form, opponent allowances, xG/xGA, goals, shots/SOT, corners, fouls/cards, availability, schedule and venue). Avoid copying copyrighted wording.
4. **Player props:** validate projected minutes/role, individual last-five/last-ten sample, position-specific opponent allowance, team style and referee where applicable; don't infer confidence from an isolated trend.
5. **Top three / Top five:** select distinct, nonredundant picks; order by evidence-based confidence, not by odds. Don't force a pick where a market or lineup cannot be supported.
6. **J1 League and K League 1:** include fixture, team news, statistics and match picks when supported; **exclude** these leagues from SGP/ACCA slips under existing policy.
7. **Display:** fixture/match cards show percentages and original, concise reasoning. Do **not** display bookmaker odds/EV or name/link sources in site copy. Existing SGP-slip-specific bet365 request is a separate exception.
8. **Data rights:** a reference website is not automatically a legal data feed. Respect robots/ToS, rate limits, copyrights, licensing and provider requirements; no speculative scraping or paid-data bypasses.
9. **Missing source/data:** fall back to other credible evidence and explicitly track gaps internally; do not label a source as checked when it wasn't accessed.

### Squawka — supplementary football analytics
- **Website:** https://www.squawka.com/
- **Use:** Player and team comparisons, match statistics, role and form context, and editorial tactical analysis where publicly available.
- **Priority:** Cross-check against primary match feeds and official lineup information; distinguish editorial claims from verified numerical data.
- **Availability:** Research reference only. No Squawka API, scraper, licensed feed, or automated integration is enabled by this entry. Follow access and reuse terms.

## 6. Integration boundaries

- This is a **research inventory and operational guidance**, not an enabled scraper or refresh workflow.
- No UI, fixture layout, or automated schedule change is made by this document.
- Original FootyEdge's daily 12:05 AM America/Toronto refresh rule remains unchanged.
- FootyEdge V2's automatic refreshes remain disabled (manual-only) until explicitly requested otherwise.
