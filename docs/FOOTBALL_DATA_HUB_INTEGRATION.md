# Football Data Hub → original FootyEdge

This integration is for the **original** public \`psyche-s/footyedge-board\`, not FootyEdge V2.

## What is already live

- The public static page reads \`data/football-hub/<league>.json\` for completed results and dated H2H; \`assets/football-hub-history.js\` normalizes reviewed aliases.
- The private hub \`psyche-s/football-data-hub\` collects OpenFootball CC0 historical results and separate, review-only identity/logo metadata.
- \`.github/workflows/sync-football-data-hub.yml\` runs at 08:13 UTC, after the hub's own update at 07:23 UTC.
- A read-only server-side token is optional; without it, the importer pulls the same CC0 source directly and preserves existing results. Manual **full** mode imports all available seasons from 2015 onward; daily mode adds a missing older season and refreshes the current two.
- \`scripts/shadow_dixon_coles.py\` can use the per-league history mirror without touching public picks. Existing source-specific APIs remain separate.

## Authentication for the exact private GitHub archive

In **footyedge-board → Settings → Secrets and variables → Actions**, set:
\`FOOTBALL_DATA_HUB_READ_TOKEN\` to a fine-grained GitHub token with **Contents: Read-only** access **only** to the private \`psyche-s/football-data-hub\` repository.

This secret is **never** committed and never shipped to browsers. Workflow access to another private repository does not come automatically with \`GITHUB_TOKEN\`. Until the token is installed, \`syncMode\` correctly shows \`public-openfootball-incremental\` or \`public-openfootball-full-backfill\`; it is wrong to claim a direct private-hub read.

## Source registry

\`config/source-registry.json\` lists OpenFootball, Wikidata, football-logos.cc, ESPN soccer, API-Football, The Odds API, ESPN odds, Football Whispers, Czech fixtures, StatsBomb Open Data, optional Understat and football-data.co.uk legacy shadow input; editorial-only research links are separate. \`scripts/audit-data-sources.mjs\` writes metadata-only \`data/football-hub/source-health.json\`.

The status \`adapterPresent\` means **file exists**, not that a provider account, API key, paid plan, license or fresh quote is available. No guessing credential status.

### Strict boundaries

- Only dated **completed CC0 OpenFootball results** may be mirrored publicly.
- **No** paid/private hub mappings, images, logo files, player data, scraped third-party material or bookmaker prices are copied via the history sync.
- Existing \`api/football.js\`, \`api/the-odds.js\`, \`api/live-odds.js\`, \`api/whispers.js\`, ESPN snapshot jobs, optional research scripts and model jobs remain independent. Their usage and licenses are not broadened by adding a source registry.
- Historical corrections may update the CC0 mirror. A source update **must never** rewrite \`data/boards/\`, published odds, daily picks, EV/confidence or the frontend layout.
- If private API access or a source fails, retain the prior verified archive. Missing status means unavailable, not zero.
- Logo catalogue page URLs are metadata and *not* publication permission.

## Manual verification

\`\`\`sh
node --test tests/football-hub.test.mjs tests/h2h-archive.test.mjs tests/source-registry.test.mjs
python -m unittest discover -s tests -p 'test_football_hub_model.py' -v
node scripts/sync-football-data-hub.mjs
node scripts/audit-data-sources.mjs
node scripts/validate-published-boards.mjs
\`\`\`

Use GitHub Actions "Sync public-domain history from Football Data Hub" → Run workflow → choose \`full\` for initial complete CC0 backfill; normal daily runs use \`daily\`. Check \`data/football-hub/manifest.json\` and source-health \`history.mode\` and \`warehouseRevision\`.

**No change to FootyEdgeV2.** No new public endpoints or UI required.
