# Fotocorp Jobs Runtime, VPS Deployment, and Polling Report

**Project:** Fotocorp  
**Area:** `apps/jobs` image processing worker  
**Status:** Planning / pre-VPS deployment  
**Purpose:** Preserve the current production-runtime decision so we can continue frontend/API work now and return to deployment once the VPS is ready.

---

## 1. Decision Snapshot

Fotocorp needs a separate background worker for image processing because the main API runtime is Cloudflare Workers, while native Sharp image processing requires a real Node.js runtime.

The current direction is:

```txt
apps/web  → frontend/admin/photographer GUI
apps/api  → Cloudflare Workers API
apps/jobs → long-running Node.js worker on VPS
DB        → Neon Postgres
Storage   → Cloudflare R2
```

The preferred low-cost VPS option for `apps/jobs` is **Raff Technologies $4.99/mo Linux VPS**, with:

```txt
2 vCPU
4 GB RAM
50 GB NVMe SSD
Ubuntu 24.04 support
SSH access
Unmetered bandwidth
```

Raff is acceptable for early production/pilot deployment, especially because the worker can later be moved to another VPS provider if reliability is not good enough.

---

## 2. Why `apps/jobs` Exists Separately

`apps/api` is currently a Cloudflare Worker. It is suitable for:

```txt
authentication
admin actions
photographer upload coordination
DB writes
R2 signed upload/download routing
job creation
status APIs
```

It is **not** suitable for native Sharp processing.

`apps/jobs` is now a Node-oriented worker package. It is intended for:

```txt
Sharp image processing
watermark preview generation
copying approved originals from staging R2 to canonical R2
writing derivative records
updating publish job status
marking assets public only after required processing succeeds
```

This separation keeps the architecture clean:

```txt
apps/api decides what should happen.
apps/jobs performs heavy image work.
```

---

## 3. Production Deployment Model

### Recommended deployment split

| Component | Runtime | Deployment target | Responsibility |
|---|---|---|---|
| `apps/web` | Next.js | Vercel / current web hosting | GUI for public users, admins, photographers |
| `apps/api` | Cloudflare Worker | Cloudflare Workers | Auth, admin approval, DB writes, job creation, status reads |
| `apps/jobs` | Node.js | Raff VPS via CapRover | Long-running Sharp worker |
| DB | Postgres | Neon | Source of truth for assets, jobs, users, metadata |
| Storage | Object storage | Cloudflare R2 | Originals, staging uploads, previews/derivatives |

### CapRover mode

`apps/jobs` should be deployed as a **non-web worker app**.

It should not expose a public HTTP URL. CapRover supports a setting called **Do not expose as web app**, intended for non-HTTP apps/background services.

Correct model:

```txt
apps/jobs runs continuously
→ checks DB or queue
→ processes pending work
→ writes logs/status
```

Wrong model:

```txt
frontend → apps/jobs public URL
```

Frontend should never talk directly to `apps/jobs`.

---

## 4. How Admin Approval Triggers Jobs

When an admin approves images, the frontend does not call the worker.

The flow is:

```txt
Admin GUI
→ apps/web
→ apps/api
→ Neon DB job rows
→ apps/jobs detects pending rows
→ apps/jobs processes images
→ apps/jobs updates DB
→ GUI polls apps/api for status
```

### Example: admin approves 20 images

1. Admin selects 20 submitted images.
2. Admin clicks **Approve**.
3. `apps/web` calls `apps/api`.
4. `apps/api` validates the admin session/role.
5. `apps/api` assigns Fotokeys or prepares assignment depending on final schema decision.
6. `apps/api` creates one publish job.
7. `apps/api` creates 20 publish job items.
8. `apps/api` returns `jobId` to the GUI.
9. `apps/jobs` sees the pending job and processes it.
10. Admin GUI polls `apps/api` for progress.

Example DB state:

```txt
image_publish_jobs
  id = job_123
  status = PENDING
  total_items = 20
  completed_items = 0
  failed_items = 0

image_publish_job_items
  job_id = job_123
  image_asset_id = asset_001
  status = PENDING
```

---

## 5. How `apps/jobs` Knows New Images Were Approved

The first version should use **DB polling**.

That means:

```txt
apps/api creates job rows in Neon
apps/jobs checks Neon every few seconds
```

No direct call to `apps/jobs` is needed.

The database acts as the signal.

### Worker loop concept

```ts
async function workerLoop() {
  while (true) {
    const job = await findPendingJob();

    if (job) {
      await processJob(job);
      continue;
    }

    await sleep(15000);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

Recommended initial intervals:

```txt
Development polling interval: 5 seconds
Production idle polling interval: 15–30 seconds
```

Use `setTimeout`/sleep-style looping instead of raw `setInterval` to avoid overlapping checks if a previous check takes longer than expected.

---

## 6. Does a Long-Running Node Process Affect Billing?

### On Raff VPS

No extra billing.

A VPS is fixed-cost. If the Raff plan is $4.99/mo, the bill is still $4.99/mo whether the Node process is idle, polling, or running all day.

The Node process does use server resources, but it does not create usage-based compute billing like Railway/Fly/Render-style managed platforms.

### Resource behavior

Approximate behavior:

```txt
Idle worker:
  CPU: near 0%
  RAM: low/moderate baseline, likely 100–300MB depending imports and runtime

Processing images:
  CPU: high
  RAM: can spike depending image size, concurrency, Sharp/libvips behavior
```

This is why the first production worker should be conservative:

```txt
JOB_CONCURRENCY=1
sharp.concurrency(1)
UV_THREADPOOL_SIZE=2
MALLOC_ARENA_MAX=2
```

Start safe, measure real memory, then increase concurrency if stable.

---

## 7. Does Polling Every Few Seconds Affect Billing or Resources?

### On Raff VPS

Almost no billing concern.

A small DB check every 15–30 seconds uses minimal CPU and memory. The worker is mostly sleeping between checks.

### On Neon

This is the real consideration.

Neon supports scale-to-zero behavior. If a database is inactive long enough, its compute can suspend. If `apps/jobs` polls every few seconds forever, Neon may remain active because it is continuously queried.

So polling can affect Neon compute active time, especially on paid plans or under production usage.

For the first version, this is acceptable because DB polling is simpler and easier to debug from the GUI. Later, if Neon compute usage becomes a concern, switch to Cloudflare Queue or another push/pull queue design.

---

## 8. Job Claiming Safety

When multiple workers eventually exist, we must prevent duplicate processing.

The recommended DB pattern is row locking with `FOR UPDATE SKIP LOCKED`.

Concept:

```sql
BEGIN;

SELECT id
FROM image_publish_jobs
WHERE status = 'PENDING'
ORDER BY created_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED;

UPDATE image_publish_jobs
SET status = 'PROCESSING', started_at = now()
WHERE id = $job_id;

COMMIT;
```

Why this matters:

```txt
Worker A locks job_123
Worker B skips job_123 and looks for another job
No duplicate processing
```

For the first version with one worker, this still gives us the right foundation.

---

## 9. GUI Status Flow

After approval, `apps/api` should return a job ID:

```json
{
  "ok": true,
  "jobId": "job_123",
  "totalItems": 20
}
```

The admin GUI should poll `apps/api`, not `apps/jobs`:

```txt
GET /api/admin/publish-jobs/job_123
```

Example response:

```json
{
  "status": "PROCESSING",
  "totalItems": 20,
  "completedItems": 7,
  "failedItems": 0
}
```

The GUI remains simple:

```txt
Approve images
Show publish progress
Show failures if any
Refresh asset state after completion
```

---

## 10. Publish Lifecycle Invariant

The most important rule:

```txt
Admin approval starts publishing.
Publishing completion makes the asset public.
```

Admin approval should not immediately make assets public.

Correct lifecycle:

```txt
Photographer upload
→ staging R2 bucket
→ image_assets.status = SUBMITTED
→ image_assets.visibility = PRIVATE
→ fotokey = NULL

Admin approves
→ publish job created
→ asset remains PRIVATE / PUBLISHING

apps/jobs processes
→ copy original to canonical R2
→ generate preview/derivative
→ write image_derivatives rows
→ mark job item completed

Only after success
→ image_assets.status = ACTIVE
→ image_assets.visibility = PUBLIC
```

If processing fails:

```txt
asset remains PRIVATE
job/item marked FAILED
error recorded
admin can retry/fix later
```

---

## 11. VPS/CapRover Deployment Direction

Once the Raff VPS is available:

1. Provision Raff Linux VPS.
2. Choose Ubuntu 24.04 LTS.
3. Add SSH key.
4. Point DNS records from Cloudflare:

```txt
server.fotocorp.com       → VPS IP, DNS only
*.server.fotocorp.com     → VPS IP, DNS only
```

5. Install Docker.
6. Install CapRover.
7. Deploy `apps/jobs` as `fotocorp-jobs`.
8. Mark app as **Do not expose as web app**.
9. Add production environment variables:

```txt
DATABASE_URL
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_CONTRIBUTOR_STAGING_BUCKET
R2_ORIGINALS_BUCKET
R2_PREVIEWS_BUCKET
MALLOC_ARENA_MAX=2
UV_THREADPOOL_SIZE=2
JOB_CONCURRENCY=1
POLL_INTERVAL_MS=15000
```

10. Run/verify:

```bash
pnpm --dir apps/jobs smoke:sharp
pnpm --dir apps/jobs publish:dry-run
```

In CapRover/Docker production, these may become container commands rather than direct `pnpm` commands.

---

## 12. What We Can Build Before VPS Arrives

We do not need to wait for the VPS to continue product work.

We can safely continue with:

### Frontend work

```txt
Admin approval UI
Publish progress UI
Submitted image review UI
Job status display
Failure/retry states in UI
```

### API work

```txt
publish job schema
publish job creation endpoint
publish job status endpoint
admin approval endpoint changes
DB-only dry-run job creation
```

### Worker-local work

```txt
local DB polling implementation
job claiming logic
Sharp processor implementation against local/test asset
R2 client integration behind service layer
one-image end-to-end test locally
```

### Not blocked by VPS

```txt
schema design
API contracts
GUI flows
status polling
admin UX
local Sharp tests
R2 SDK integration draft
```

### Blocked or partially blocked by VPS

```txt
real long-running production worker test
CapRover deployment
production logs/restart flow
real production image publish run
memory observation on 4GB Raff VPS
```

---

## 13. Recommended Next PR Sequence

### PR-16B — Publish Job Schema + API Status Basics

Goal:

```txt
Add DB tables for image publish jobs and job items.
Add API endpoint to create/read publish job status.
Keep worker processing mostly placeholder/dry-run.
```

### PR-16C — Admin Approval Creates Publish Jobs

Goal:

```txt
Admin approval should create publish jobs instead of directly making assets public.
Assets remain private until jobs succeed.
```

### PR-16D — Local One-Image Worker Processing

Goal:

```txt
apps/jobs processes one approved image locally:
read source
copy canonical original
generate one preview derivative
update DB
mark asset public after success
```

### PR-16E — VPS Deployment Runbook + CapRover Packaging

Goal:

```txt
Dockerfile/captain-definition/runbook/env example.
Deploy worker to Raff once VPS is ready.
```

### PR-16F — Batch, Retry, Failure Handling

Goal:

```txt
Safe batch processing.
Retry failed items.
Prevent duplicate work.
Expose failure reasons to admin UI.
```

### Later — Queue Integration

Only after DB polling works:

```txt
apps/api creates DB job
apps/api sends Cloudflare Queue message
apps/jobs pulls/receives message
apps/jobs processes job
```

Queue is better long-term, but DB polling is simpler for first GUI testing.

---

## 14. Pitch-Friendly Explanation for Client

We are keeping heavy image processing outside the frontend and outside the serverless API because image resizing and watermarking need a real Node server with Sharp.

The frontend and API will be ready first. When an admin approves images, the API will create a publish job. A separate background worker will then process the images, generate protected previews, move approved originals into the canonical storage bucket, and update the database. The images only become visible publicly after processing succeeds.

This protects the platform from broken public images, avoids exposing backend worker endpoints, and keeps costs predictable by using a low-cost fixed VPS for the heavy image-processing worker.

---

## 15. Current Final Decision

Proceed now with:

```txt
Frontend + API functional readiness
DB publish job model
Admin status UI
Local worker implementation
```

Wait for VPS only for:

```txt
CapRover deployment
production worker smoke test
real long-running process test
memory/concurrency tuning on actual Raff hardware
```

The project is not blocked by the VPS yet.

---

## 16. Reference Sources

- Raff Technologies Linux VM pricing/specs: https://rafftechnologies.com/products/linux-vm
- CapRover app configuration / non-web app option: https://caprover.com/docs/app-configuration.html
- CapRover deployment methods: https://caprover.com/docs/deployment-methods.html
- Neon scale to zero: https://neon.com/docs/introduction/scale-to-zero
- Neon compute lifecycle: https://neon.com/docs/introduction/compute-lifecycle
- Node.js timers: https://nodejs.org/api/timers.html
- PostgreSQL `FOR UPDATE SKIP LOCKED`: https://www.postgresql.org/docs/current/sql-select.html
