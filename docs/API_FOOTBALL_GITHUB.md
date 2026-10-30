# API-Football through GitHub Actions — FootyEdge ORIGINAL

**Purpose:** Use the existing GitHub Actions repository secret \`FSAPI\` without placing the new credential in Vercel. V2 is not touched.

## Data flow

1. GitHub Actions reads \`secrets.FSAPI\` (GitHub secret names are case-insensitive).
2. \`scripts/build-github-api-football.mjs\` checks \`/status\` (quota-free), then asks for \`/fixtures?date=...\`.
3. It joins providers to **existing Original board games** only by unambiguous home/away names and kickoff time. If the board is missing, if a provider call fails, or if no match can be verified, it does not publish a substitute board.
4. Near kickoff, it requests at most five sets of \`/fixtures/lineups\` per run. A confirmed XI is accepted only when exactly 11 distinct identified starters belong to the source-matched team.
5. It writes a bounded factual snapshot to \`data/github-api-football/YYYY-MM-DD.json\`. The public file includes only match identities, kickoff, league labels, source status, and confirmed lineup identities. **No raw full-feed mirror, odds, photos, injuries, predictions, key, token, or quota-account information**.
6. The Original Fixtures Lineups tab can display a verified XI from the snapshot where there is a unique fixture match. Every other aspect of the card, especially the ranked Top 3 picks, remains unchanged. API-Football player IDs are **not** passed to the ESPN player-profile ID endpoint.

## Triggers

\`.github/workflows/sync-api-football.yml\` supports:
- a manual **Run workflow** action (optional date);
- a one-time source-only trigger when the pipeline code or workflow is pushed to \`main\`;
- daily source-only collection at approximately **12:36 a.m., 11:36 a.m., and 3:36 p.m. America/Toronto**, with a timezone-aware hour guard to avoid running the DST duplicate.

These source checks **do not schedule, publish, refresh, or overwrite Top 3 selections, same-day frozen picks, slips, or model forecasts**. The scheduled checks can be delayed by GitHub. Every published JSON snapshot may trigger a normal Vercel Git deployment.

## Rate and reliability guardrails

- 1 quotas-free status call + 1 fixtures request + up to 5 lineup calls per run.
- If the status endpoint reports fewer than 9 daily calls remaining, the job stops before requesting fixtures.
- Never exceed five lineup queries per run. All API calls are time-bounded and category-only errors are logged.
- Existing verified XIs are retained on a partial subsequent provider outage. No unverified XI becomes an official selection.
- The workflow requires \`contents:write\` only to commit this one dated snapshot. It does not alter other data.
- If \`FSAPI\` is inaccessible to GitHub Actions, the workflow fails safely. Only repository or organization secrets available to this workflow are read.

## Provider data rights

API-Football states that it provides an API for building sites/apps but **does not grant a blanket license to publish third-party sports data or logos/images**. Check the applicable league/federation rights before broader publication. This integration publishes a tightly limited factual XI snapshot for the existing Original fixtures, not a rehosted data feed. It deliberately omits provider logos and player images; FootyEdge continues to use its separately verified portrait references.

## Files

- Workflow: \`.github/workflows/sync-api-football.yml\`
- Ingestion: \`scripts/build-github-api-football.mjs\`
- Tests: \`tests/github-api-football.test.mjs\`
- Data: \`data/github-api-football/YYYY-MM-DD.json\`
- UI: \`ui/part2.html\`

The existing Vercel \`FOOTBALL\` variable is separate; this design does **not** copy GitHub secrets to Vercel and does **not** claim that the original Vercel API-Football proxy is authenticated.
