# FootyEdge logo cache

FootyEdge stores its reusable football competition and club logo assets in this directory so the production UI does not depend on a patchwork of external hotlinks.

## Upstream source

Logos are sourced from [football-logos.cc](https://football-logos.cc/), which provides normalized transparent PNG/SVG football marks. Their individual logo pages request credit and a link back to football-logos.cc.

The automated source list lives in `data/logo-sources.json`. The sync script fetches the 256×256 PNG offered by each source page and writes the local copy here.

- `competitions/` — league/tournament marks
- `teams/` — club/team marks discovered from configured competition pages
- `manifest.json` — local-path/source-page/source-asset audit
- `registry.js` — browser lookup map used by Today’s Picks

Country/national-team displays on FootyEdge continue to use the approved circular flag treatment. Cached national-team crest files may exist, but flags remain the reader-facing default unless the owner changes that rule.

Source/credit: https://football-logos.cc/
