# Fotocorp Jobs (`apps/jobs`)

Node CLI package for background image publish work. This is **not** a Cloudflare Worker: it runs under real **Node.js** so **native Sharp** and similar addons are supported.

## Scripts

| Script | Command | Notes |
| --- | --- | --- |
| `dev` | `tsx src/index.ts --dry-run` | Local developer convenience. |
| `publish:dry-run` | `tsx src/index.ts --dry-run` | Safe mode: tolerates missing service env vars (warns), lists pending jobs (placeholder returns none). |
| `publish:once` | `tsx src/index.ts --once` | Validates required env; runs one pass. **Throws if pending jobs exist** until processing is implemented. |
| `publish:worker` | `tsx src/index.ts --worker` | Production-oriented poll loop (`IMAGE_PUBLISH_POLL_INTERVAL_MS`). Same pending-job guard as `publish:once`. |
| `smoke:sharp` | `tsx scripts/smoke/check-sharp-node.ts` | Proves Sharp loads and encodes a tiny in-memory image. |
| `check` | `tsc -p tsconfig.json --noEmit` | Typecheck. |

Root `pnpm dev` starts web + API only. Run `pnpm dev:jobs` manually when you need a quick dry-run of the jobs CLI.

## Local dry-run

```bash
pnpm --dir apps/jobs publish:dry-run
```

## Docker (private VPS, no public URL)

Build context is the **monorepo root**. The container runs as user **`node`**, exposes **no HTTP port**, and loads secrets from **`apps/jobs/.env.production`** (gitignored; start from `.env.production.example`).

```bash
cp apps/jobs/.env.production.example apps/jobs/.env.production
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production config
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production build fotocorp-jobs
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs pnpm --dir apps/jobs smoke:sharp
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs pnpm --dir apps/jobs publish:dry-run
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production up -d fotocorp-jobs
```

Operator-focused steps (Ubuntu, `/opt/fotocorp/app`, SSH-only firewall) live in [`docs/db-revamp/jobs-direct-vps-deployment-runbook.md`](../docs/db-revamp/jobs-direct-vps-deployment-runbook.md).

**CapRover / DNS** are not required for this deployment path; they can be added later if you want a platform domain in front of other services. The jobs worker stays **off the public internet**.

## Layout

- `src/index.ts` — CLI entry (no Worker `fetch` export).
- `src/config/env.ts` — typed env loader; dry-run tolerates missing service env vars with warnings.
- `src/workers/imagePublishWorker.ts` — orchestration skeleton.
- `src/services/*` — placeholders for DB-backed jobs, R2, and Sharp-based derivatives.

## Environment

See `apps/jobs/.env.production.example` and `src/config/env.ts`. R2 staging uses **`R2_CONTRIBUTOR_STAGING_BUCKET`** (photographer upload staging bucket name).
