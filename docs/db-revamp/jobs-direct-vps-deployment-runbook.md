# Jobs direct VPS deployment (Docker, no DNS)

This runbook covers running **`apps/jobs`** as a **private** Node worker on an Ubuntu VPS (for example Raff Technologies) using **Docker Compose**. There is **no public HTTP port**, **no domain**, and **no CapRover** requirement for this path.

## Model

- **Inbound:** none for the worker container (firewall can stay SSH-only).
- **Outbound:** Neon Postgres, Cloudflare R2, and (later) optional Cloudflare Queues.
- **Work creation:** staff/admin flows hit **`apps/api`**, which writes publish rows in Neon; **`apps/jobs`** must never be called from **`apps/web`**.
- **Current CLI behavior:** `listPendingJobs` is still a placeholder; **`publish:once`** / **`publish:worker`** **throw** if any pending publish jobs exist until real processing is implemented. Use **`publish:dry-run`** for safe smoke on a DB that may have queued work.

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

Dry-run tolerates missing service env vars and only **warns**; it still exercises the CLI path.

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

If the database has **pending** publish jobs, **`publish:once`** / **`publish:worker`** exit with an error by design (`ImagePublishWorker` throws until processing is implemented). Use **`publish:dry-run`** for safe checks on those databases.
