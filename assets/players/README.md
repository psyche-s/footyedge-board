# Player portrait reference index — original FootyEdge

- `data/player-photo-refs.json`: club- and player-ID keyed ESPN source references, image content digest, verification time and collection coverage.
- `assets/player-photo-registry.js`: small browser-side lookup data generated from the reference index. This is loaded by the original Today's Picks page, **not FootyEdge V2**.
- `scripts/sync-player-photo-refs.mjs`: reads today's/next day's tracked men's fixtures and ESPN club rosters, fetches image responses to confirm that an asset exists, then stores references only. It does **not** retain/download image files into the repository.
- Player matching is by verified roster identity (exact full name or unique same-team surname). A guessed image association is not permitted.
- Reused identical image digests across different athletes are excluded (likely missing/placeholder).
- Unknown or absent photos keep the player's initials, rather than showing a wrong footballer's image.

A verified HTTP image response establishes that the referenced asset exists, **not** that the image is licensed for republishing or that a source has granted image ownership. Upstream imagery remains with its respective copyright owners. Confirm source display permissions before relying on third-party photos for wider redistribution.

The collector runs only when explicitly dispatched or when this dedicated photo branch is updated; it does not change matches, predictions, frozen picks, odds, V2, or other refresh schedules.
