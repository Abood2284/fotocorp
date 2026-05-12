# Jobs direct VPS deployment (Docker, no DNS)

This runbook covers running **`apps/jobs`** as a **private** Node worker on an Ubuntu VPS (for example Raff Technologies) using **Docker Compose**. There is **no public HTTP port**, **no domain**, and **no CapRover** requirement for this path.

## Model

- **Inbound:** none for the worker container (firewall can stay SSH-only).
- **Outbound:** Neon Postgres, Cloudflare R2, and (later) optional Cloudflare Queues.
- **Work creation:** staff/admin flows hit **`apps/api`**, which writes publish rows in Neon; **`apps/jobs`** must never be called from **`apps/web`**.
- **Current CLI behavior (PR-16F):** the worker now polls real `image_publish_jobs` rows from Neon. Behavior is gated by **`IMAGE_PUBLISH_PROCESSING_ENABLED`** (default **`false`**):
  - `false` → counts queued jobs, logs `processing disabled`, does **not** claim or mutate any row.
  - `true` → claims one queued job per iteration via `FOR UPDATE SKIP LOCKED`, marks its items + job **`FAILED`** with `failure_code = PROCESSING_NOT_IMPLEMENTED`, never touches `image_assets`. Use only against development data — real Sharp/R2 processing lands in a follow-up PR.

## Prerequisites on the VPS

- Ubuntu 24.04 (or similar)
- Docker Engine + Docker Compose plugin
- Linux user (example: `fotocorp`) with permission to run Docker (often `docker` group)
- Repo clone path (this doc): `/opt/fotocorp/app`

## 1. First-time clone

```bash
sudo mkdir -p /opt/fotocorp
sudo chown -R fotocorp:fotocorp /opt/fotocorp
cd /opt/fotocorp
git clone <YOUR_REPO_URL> app
cd app
```

Replace `<YOUR_REPO_URL>` with your Git remote.

## 2. Create production env

```bash
cp apps/jobs/.env.production.example apps/jobs/.env.production
nano apps/jobs/.env.production
```

- Never commit **`apps/jobs/.env.production`** (gitignored).
- Fill **`DATABASE_URL`**, R2 variables, and bucket names per `apps/jobs/src/config/env.ts` and the example file.

## 3. Validate Compose file

```bash
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production config
```

`--env-file` is optional if the Compose file does not use interpolation from that file; it matches operator muscle memory and keeps CLI flags consistent with build/run commands.

## 4. Build image

```bash
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production build fotocorp-jobs
```

Build context is the **repository root**; the Dockerfile is **`apps/jobs/Dockerfile`**.

## 5. Sharp smoke inside the container

```bash
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs pnpm --dir apps/jobs smoke:sharp
```

Expect JSON with `"ok":true` and a non-zero `outputBytes`.

## 6. Dry-run inside the container

```bash
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs pnpm --dir apps/jobs publish:dry-run
```

Dry-run tolerates missing service env vars and only **warns**; it still exercises the CLI path. When `DATABASE_URL` is present, dry-run reports the real **queued** publish-job count from Neon without claiming or mutating rows.

## 7. Start long-running worker

```bash
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production up -d fotocorp-jobs
```

Default container command is **`pnpm --dir apps/jobs publish:worker`** (poll loop; see `apps/jobs/src/index.ts`). **Do not publish ports** in Compose; this stack keeps the worker private.

## 8. Logs

```bash
docker logs -f fotocorp-jobs
```

or:

```bash
docker compose -f docker-compose.jobs.yml logs -f fotocorp-jobs
```

Compose configures **JSON log rotation** (`max-size` / `max-file`) to limit disk growth.

## 9. Restart

```bash
docker compose -f docker-compose.jobs.yml restart fotocorp-jobs
```

## 10. Stop

```bash
docker compose -f docker-compose.jobs.yml stop fotocorp-jobs
```

## 11. Update deployment

```bash
cd /opt/fotocorp/app
git pull
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production up -d --build fotocorp-jobs
```

## 12. Health / resource checks

```bash
docker ps
docker inspect fotocorp-jobs
docker stats fotocorp-jobs
free -h
```

## 13. DNS, TLS, and CapRover (deferred)

- **No domain** is required for this worker: it does not serve HTTP.
- **No DNS** is required for the worker to reach Neon or R2 outbound.
- **CapRover** is intentionally **not** part of this PR; it can be introduced later if you want Git-push deploys after a domain exists.
- **No Nginx** in this stack: nothing is terminated publicly for jobs.

## Security checklist

- Compose file must **not** map `ports:` for `fotocorp-jobs`.
- Keep **R2 secrets** and **`DATABASE_URL`** only on the VPS and in **`apps/jobs/.env.production`**.
- **Never** expose R2 credentials to **`apps/web`** or browser-visible config.

## Optional command overrides

One-off **`publish:once`** (exits after a single pass):

```bash
docker compose -f docker-compose.jobs.yml --env-file apps/jobs/.env.production run --rm fotocorp-jobs pnpm --dir apps/jobs publish:once
```

## Known limitation (until a follow-up PR)

`apps/jobs` does **not** perform real Sharp / R2 image processing yet. With `IMAGE_PUBLISH_PROCESSING_ENABLED=false` (the production default) `publish:once` / `publish:worker` only **count** queued publish jobs; they never claim them and never touch `image_assets`. Today's working processor remains the API-side CLI:

```bash
pnpm --dir apps/api media:process-image-publish-jobs -- --limit 25
```

A follow-up PR will move that processor into `apps/jobs` so the VPS worker can produce derivatives natively. Until then, leave `IMAGE_PUBLISH_PROCESSING_ENABLED=false` for any database that contains real staff/contributor work.

## PR-16F safety flag

```env
IMAGE_PUBLISH_PROCESSING_ENABLED=false   # default; production-safe
IMAGE_PUBLISH_PROCESSING_ENABLED=true    # controlled testing only — placeholder lifecycle marks jobs FAILED
```

The flag is also wired in `docker-compose.jobs.yml` (defaults to `"false"`). When `true`, the worker:

- claims one queued job per iteration using `FOR UPDATE SKIP LOCKED`,
- marks its items and the job `FAILED` with `failure_code = PROCESSING_NOT_IMPLEMENTED`,
- does **not** mutate `image_assets`, does **not** promote anything to the public catalog.
