# PR: Homepage / Latest Events latency tracing (diagnostic only)

## Scope

Diagnostic instrumentation only — no feed SQL changes, cache policy changes, Redis, projection tables, or UI copy changes.

## Instrumentation added

| Layer | Request ID | Server-Timing | Structured `latency_trace` logs |
| --- | --- | --- | --- |
| API middleware | `x-fotocorp-request-id` (+ legacy `x-request-id`) | — | — |
| `GET /api/v1/public/events/latest` | propagated | `parse`, `db`, `map`, `response_build`, `total` | yes + `db` block |
| Stable preview (`/api/media/...` and `/api/v1/media/...`) | propagated | `db_lookup`, `r2_read`, `response_build`, `total` | yes |
| Web proxy `/api/public/events/latest` | propagated | `upstream_fetch`, `json_parse`, `response_build`, `total` | yes |
| Web proxy preview | propagated | same as JSON proxy | yes |
| Browser `fetchPublicLatestEvents` | generated per fetch | — | yes (`layer: browser`) |
| Marketing shell `GET /` | from incoming headers when present | — | yes (`auth_session`, `staff_auth`) |
| `/api/auth/get-session` (web proxy + API) | propagated | handler / proxy segments | yes |
| `/api/v1/staff/auth/me` (API; web via staff session) | propagated | `db`, `total` | yes |

Helper script: `scripts/diagnostics/homepage-latency.sh`  
SQL playbook: `docs/db-revamp/reports/homepage-latency-diagnostics-sql.md`

## Verification

| Check | Result |
| --- | --- |
| `pnpm --dir apps/api check` | pass |
| `pnpm --dir apps/api smoke:hono-routes` | pass |
| `npm --prefix apps/web run build` | pass |
| `bash scripts/diagnostics/homepage-latency.sh` | pass (API + web + `/`; one homepage run reset) |

## Timings — local direct API (`8787`)

`GET /api/v1/public/events/latest?windowDays=30&limit=15` (5 runs, 2026-05-17):

| Run | status | TTFB | total |
| --- | --- | --- | --- |
| 1 | 200 | 4.51s | 4.51s |
| 2 | 200 | 1.79s | 1.79s |
| 3 | 200 | 1.94s | 1.94s |
| 4 | 200 | 1.81s | 1.81s |
| 5 | 200 | 1.76s | 1.76s |

Header sample (`x-fotocorp-request-id: web-trace-…-api`):

```
Server-Timing: parse;dur=3, db;dur=2359, map;dur=1, response_build;dur=0, total;dur=2363
```

Warm-path API handler time aligns with **~1.7–2.4s DB** (`db` segment ≈ total). Run 1 (~4.5s) is mild cold-start; earlier session saw ~29s on first touch after idle.

## Timings — local web proxy / homepage (2026-05-17, `pnpm dev`)

`GET /api/public/events/latest?windowDays=30&limit=15` (5 runs):

| Run | status | TTFB | total |
| --- | --- | --- | --- |
| 1 | 200 | 16.39s | 16.39s |
| 2 | 200 | 19.40s | 19.40s |
| 3 | 200 | 3.35s | 3.35s |
| 4 | 200 | 10.80s | 10.80s |
| 5 | 200 | 9.21s | 9.21s |

Sample web proxy headers (`x-fotocorp-request-id: web-trace-…`):

```
server-timing: upstream_fetch;dur=6263, json_parse;dur=408, response_build;dur=0, total;dur=6671
```

Warm back-to-back (3 runs): web proxy **1.71–1.75s** TTFB vs API **1.71–2.30s** — aligned once both sides are warm.

`GET /` homepage shell (5 runs):

| Run | status | TTFB | total | notes |
| --- | --- | --- | --- | --- |
| 1 | 200 | 2.53s | 2.64s | |
| 2 | 200 | 9.42s | 9.56s | |
| 3 | 200 | 11.30s | 11.61s | |
| 4 | 200 | 10.16s | 10.27s | |
| 5 | — | — | — | connection reset (dev server hiccup) |

Homepage HTML does **not** block on latest-events JSON (client fetch); shell time is mostly RSC + auth session work.

## Timings — preview card (`/preview/card`)

Asset `19d3ee1c-5687-44de-a8ab-0e52e8e670fc` (from latest-events item):

| Layer | Run 1 TTFB | Runs 2–5 TTFB (approx) |
| --- | --- | --- |
| API direct | 1.96s | 0.77–0.96s |
| Web proxy | 2.35s | 0.86–0.99s |

Preview adds ~0.8–1s per tile after warm-up; 15 event tiles ≈ significant parallel browser load separate from latest-events JSON latency.

Correlate web/API logs by matching `requestId` in `latency_trace` JSON lines.

## Log correlation

1. Issue a request with a fixed ID:  
   `curl -H 'x-fotocorp-request-id: my-trace-1' 'http://127.0.0.1:8787/api/v1/public/events/latest?windowDays=30&limit=15'`
2. API Worker stdout should emit one `latency_trace` object with the same `requestId` and `db.dbMs`.
3. Browser latest-events fetch generates its own ID; web proxy forwards it upstream — match `x-fotocorp-request-id` / `x-upstream-request-id` on the proxy response.

Example API log shape:

```json
{
  "event": "latency_trace",
  "requestId": "diag-report-001",
  "layer": "api",
  "route": "/api/v1/public/events/latest",
  "status": "ok",
  "statusCode": 200,
  "durationMs": 1719,
  "timings": { "parse": 0, "db": 1719, "map": 0, "response_build": 0, "total": 1719 },
  "db": {
    "dbMs": 1719,
    "rowCount": 16,
    "queryName": "public_latest_events",
    "windowDays": 30,
    "limit": 15,
    "hasCursor": false
  }
}
```

## Conclusion (2026-05-17 local run)

| Layer | Time (warm) | Time (cold / noisy) | Verdict |
| --- | --- | --- | --- |
| DB query (`public_latest_events`) | **1.7–2.4s** (`db` ≈ total in Server-Timing) | 4.5s API run 1; web proxy 3–19s runs 1–2,4–5 | **Primary bottleneck** for Latest Events JSON |
| API handler (parse/map/build) | &lt;5ms | — | Negligible vs DB |
| Web proxy overhead | ~0ms warm (proxy TTFB ≈ API); `json_parse` ~400ms on one sampled trace | +0–17s when upstream/Next dev cold | Not a steady-state problem; dev compilation/cold upstream dominates spikes |
| Homepage shell `GET /` | **2.5s** best run | **9–11s** runs 2–4 | Auth/RSC cost separate from latest-events; does not include 15 preview images |
| Preview route (per card) | **~0.8–1.0s** warm | ~2s run 1 | Adds parallel load after events JSON returns; DB+R2 per tile |

**User-visible Latest Events delay** ≈ **latest-events JSON (1.7–2.4s warm, higher cold)** + **15× preview fetches (~0.9s each warm)** unless browser cache hits.

**Next step:** run SQL in `homepage-latency-diagnostics-sql.md` on staging DB and compare `EXPLAIN (ANALYZE)` to `dbMs` in API `latency_trace` logs. Do not optimize in the tracing PR.
