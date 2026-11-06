# Optional BigBallsData EPL source corroboration

This is for **FootyEdge Original** only. It does not change the site's UI, picks,
published lineups, odds, confidence ratings, historical boards, or the 00:05
America/Toronto schedule.

## Credentials

1. Rotate any live key pasted into a chat or committed elsewhere at
   https://bigballsdata.com/dashboard/keys.
2. In the original GitHub repository, open **Settings → Secrets and variables →
   Actions → New repository secret**, name it `BBS_API_KEY`, and paste the
   replacement key.
3. The existing sole daily workflow `.github/workflows/archive-board.yml`
   runs the optional SDK collector *only if the secret is configured*.
   No additional schedule or V2 refresh is enabled.

The workflow installs pinned `@bigballsdata/sdk@0.1.1` at run time rather than
adding a site/runtime dependency. The source uses the SDK's
`client.matches.list({sport:'football',league:'epl',date,limit:100})`.
In the absence of a key or service response, original provider data is retained
and the publication continues; failures are visibly flagged in Actions logs.

## Exact-match and publication limits

- EPL / `eng.1` only until each other league key and coverage are independently
  verified with the provider.
- A corroboration requires unambiguous normalized home and away identities,
  matching kickoffs within 60 minutes, and a date-matched research file.
- No provider match ID, raw score, odds, XI, player stat, or entire provider
  response is copied into committed/public `data` files. Only
  `providerCorroboration` and aggregate `providerCrosschecks` flags are added.
- A provider miss means **unknown**, not a bad fixture. No unsupported Top 3,
  scorer, shot, foul, or SGP selections are created from a metadata-only fetch.
- Temporary provider evidence is held in `.cache/footyedge/` on the Actions
  runner. This directory is not included in any `git add` or deploy output.
- The provider's `meta.confidence` is *data quality confidence*, not an
  independently calibrated bet outcome probability.

Reference: https://bigballsdata.com/docs/quickstart and
https://bigballsdata.com/legal/terms. The terms allow internal
cache/model usage but not republishing a raw data feed or downloadable raw field
export. Display or additional data-source use requires a separate approved
implementation respecting those limits.

## Verification

Run `node --test tests/bigballsdata-research.test.mjs` in the original repo.
These unit tests use a fake SDK client and consume **no** API quota. End-to-end
live validation requires a newly rotated key in GitHub Actions.
