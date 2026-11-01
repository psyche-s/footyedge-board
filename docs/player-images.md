# Player images

Original uses one checked portrait catalogue for lineup avatars and player profiles.
`assets/player-photo-registry.js` provides team-scoped browser lookup, while
`data/player-photo-index.json` provides the same references to the profile,
lineup-headshot and match-update functions. Function bundles explicitly include
that index in `vercel.json`.

Image references come from ESPN, API-Football, FotMob, the Premier League's public
FPL roster and official Czech club/league rosters. The repository retains URLs,
checksums and identity evidence, rather than copying third-party image files.
An HTTP success alone is insufficient: known default images, repeated placeholder
digests and mismatched identities are excluded. The browser and API share the same
restricted image URL patterns.

Official Liverpool and Real Madrid player-page references are reviewed in
`config/official-player-portraits.json`, joined by exact athlete name, ESPN ID
and current roster club. Their original images are checked before selection.
PNG, JPEG and WebP dimensions are read from the image bytes. The collector keeps
the larger checked portrait instead of accepting the first successful thumbnail;
both catalogues also choose the largest reference across duplicate competition
rosters. The APIs and browser prefer that catalogue over live roster thumbnails.
Small fallbacks are not enlarged in the profile, and wide club photographs use
a centred crop. No portraits are generated, altered or mirrored.

`data/player-image-identities.json` keeps the reviewed provider crosswalk. Its
Reep portion is a pinned CC0 snapshot, joined by exact ESPN ID and name; official
FPL photo-code matches have their separate source field. This crosswalk is not
used as evidence of current club membership. Team-scoped sourced rosters establish
that context, and the APIs recheck the current roster before returning a profile.
An abbreviated or mononymous lineup name must resolve uniquely inside that club.

## Maintenance

- `node scripts/sync-player-photo-refs.mjs` checks current roster identities and
  available URLs, preserving prior references if a club roster is unavailable.
- `python3 scripts/enrich-player-portraits.py` verifies the API-Football image
  fallback for existing reviewed identity bridges without any API key.
- `node scripts/build-player-photo-catalog.mjs` rebuilds both browser and API
  indexes from the saved checked references.
- `node scripts/upgrade-player-portraits.mjs` checks for larger portraits for
  existing exact roster identities without changing fixtures or picks.
- `node scripts/check-player-photo-coverage.mjs YYYY-MM-DD` audits the actual
  browser lookup against that date's saved XIs and records every remaining gap.

The existing Original nightly workflow commits the API index with the browser
registry. No extra schedule or V2 refresh is added. Unavailable photos remain
initials; neither the image collector nor coverage audit changes fixtures,
starting XIs, predictions, historical boards or result tracking.
