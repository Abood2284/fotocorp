# PR-16A — `apps/jobs` Node runtime + Sharp smoke

## Summary

Converted `apps/jobs` from a Wrangler Worker scaffold (fixture ingestion + `fetch` export) into a **Node CLI** package with:

- `tsx` entry (`publish:dry-run`, `publish:once`, `dev`)
- Typed env loader (`src/config/env.ts`) with dry-run vs strict validation
- Image publish worker skeleton (`ImagePublishWorker`, placeholder job/storage/processor services)
- **Sharp** dependency isolated to `apps/jobs` + smoke script `scripts/smoke/check-sharp-node.ts`
- Removed `wrangler.jsonc`, Worker `dev`/`deploy` scripts, and fixture ingestion modules

## Root scripts

- `dev:jobs` now runs `pnpm --dir apps/jobs dev` (tsx dry-run), not Wrangler.
- Root `dev` (`concurrently`) no longer starts jobs (avoids a short-lived process in the default dev loop).

## Follow-up

- PR-16B+: wire `listPendingJobs` to `image_publish_jobs`, R2 copy/derivative writes, and real `--once` processing.
