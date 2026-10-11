# Optional advanced-data adapters

Install these in an **isolated Python research environment**, not in Vercel:

```bash
pip install -r requirements-advanced.txt
python scripts/advanced_adapter.py --provider statsbomb --competition-id <open-competition-id> --season-id <open-season-id> --match-id <verified-open-match-id>
python scripts/advanced_adapter.py --provider understat --league ENG-Premier League --season 2025/2026 --match-id <verified-understat-match-id>
```

StatsBomb's published open data covers a *subset* of historical matches. The
collector first checks competition, season and fixture membership, then saves
only shot events with valid xG and coordinates to the local SQLite cache.
Understat uses soccerdata's real `read_shot_events` method. No odds or
probabilities are computed and no current match board is modified.

FBref season stats, WhoScored event pages, and SofaScore/FotMob updates are
further source adapters after access/terms and fixture identity checks. Do not
use stealth mode, misleading user agents, proxy rotation, or endpoint
interception to defeat a site's access restrictions.

Never claim an event belongs to an upcoming match unless verified IDs align.
