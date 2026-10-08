# FootyEdge Lab (separate UI experiment)

- Vercel project: `footyedge-lab` (Psyche team).
- Public URL: https://footyedge-lab.vercel.app
- First deployment ID: `dpl_4VJACuy8jKGiurnn9V9QU7WWEEa6`
- Main product: https://footyedge.mooo.com
- This branch is an isolated working branch created for possible future lab development. **It is not currently the lab's deployed source.** The initial lab was deployed directly through Vercel with three source files: `index.html`, `api/footyedge.js`, and `vercel.json`.

## Data integrity

The lab is a read-only view. The Vercel function fetches only public JSON from `https://raw.githubusercontent.com/psyche-s/footyedge-board/main/`. It supports official `data/boards/YYYY-MM-DD.json`, readiness, performance summary, schedule snapshots and research snapshot. The active model, archives, official morning publication, price verification and post-match learning continue only on `main`.

Do not create or imply a new pick if the main locked board does not have one. Missing exact odds stay N/A. The same men's-only slate exclusion applies. Never backfill or rewrite archived explanations.

The UI takes inspiration from dark sports-analysis dashboards; this isn't a replica of another site's source. To iterate, either redeploy source files directly to the same Vercel project or explicitly connect a reviewed lab-source repository. Do not change the original Vercel project or main branch as part of visual lab experiments.
