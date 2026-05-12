# Runtime Smoke Tests

This document captures the repeatable route-level checks to run after Hono routing changes.

Use placeholders in commands. Do not paste real internal secrets, R2 keys, bucket names, object keys, signed URLs, or auth cookies into this file.

## Latest Run Snapshot (2026-05-07)

Executed:

- `npm --prefix apps/api run smoke:hono-routes` (PASS)
- live API curl checks against `127.0.0.1:8787` (PASS for sampled routes)
- live web curl checks against `127.0.0.1:3000` (PASS for sampled routes)

Observed live statuses:

- API: `/health` `200`, `/api/v1/assets?limit=1` `200`, `/unknown-route` `404`, wrong method on preview `405`, internal admin without secret `401`, `/assets?limit=1` `200`, legacy `/media/preview/*` `410`
- Web: `/` `200`, `/search` `200`, `/api/public/assets?limit=1` `200`, `/api/fotobox` while logged out `401`, `/api/assets/:id/download/check` while logged out `401`

Known blocker from this run:

- same-origin business-email route `POST /api/auth/business-email/validate` returned `500` in the current local web server session, consistent with missing/misaligned `NEXT_PUBLIC_API_BASE_URL` in that runtime environment.
- subscriber download attachment + quota increment + `image_download_logs` `COMPLETED` verification remains pending because this run did not execute with an authenticated active subscriber test session.

## Start Servers

API Worker:

```sh
npm --prefix apps/api run dev
```

The API dev server defaults to port `8787`.

Web app:

```sh
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8787 npm --prefix apps/web run dev -- --port 3000
```

For privileged web-to-api calls, configure `INTERNAL_API_BASE_URL` and `INTERNAL_API_SECRET` in the local server environment. Do not expose them to client code.

## Hono Fetch Harness

The lightweight Hono smoke script does not require a running server and does not use real secrets:

```sh
npm --prefix apps/api run smoke:hono-routes
```

It checks:

- `GET /health`
- public catalog wrong-method `405`
- public media preview wrong-method `405`
- internal account/admin missing-secret `401`
- internal account/admin wrong-method `405` with a fake local internal secret
- legacy disabled media responses
- fixture `/assets` list does not crash
- unknown route `404`
- response bodies do not include known secret/storage leak patterns

This script is route smoke coverage only. It does not prove database-backed public catalog success, R2 preview delivery, web rendering, or subscriber download E2E.

## Public Catalog

With the API server running:

```sh
curl -sS -i http://127.0.0.1:8787/api/v1/assets
curl -sS -i "http://127.0.0.1:8787/api/v1/assets?sort=latest"
curl -sS -i "http://127.0.0.1:8787/api/v1/assets?q=test"
curl -sS -i http://127.0.0.1:8787/api/v1/assets/filters
curl -sS -i http://127.0.0.1:8787/api/v1/assets/collections
curl -sS -i http://127.0.0.1:8787/api/v1/assets/<KNOWN_ASSET_ID>
```

Expected:

- existing public response shapes remain stable
- list/detail/filter/collection routes do not expose private storage fields
- successful asset responses use safe preview API URLs
- expected safe errors are returned when local DB/env is unavailable

Wrong methods:

```sh
curl -sS -i -X POST http://127.0.0.1:8787/api/v1/assets
curl -sS -i -X POST http://127.0.0.1:8787/api/v1/assets/filters
curl -sS -i -X DELETE http://127.0.0.1:8787/api/v1/assets/<KNOWN_ASSET_ID>
```

Expected:

- `405 METHOD_NOT_ALLOWED`

## Public Media Preview

```sh
curl -sS -i "http://127.0.0.1:8787/api/v1/media/assets/<KNOWN_ASSET_ID>/preview?variant=thumb"
curl -sS -i "http://127.0.0.1:8787/api/v1/media/assets/<KNOWN_ASSET_ID>/preview?variant=card"
curl -sS -i "http://127.0.0.1:8787/api/v1/media/assets/<KNOWN_ASSET_ID>/preview?variant=detail"
curl -sS -i -X POST "http://127.0.0.1:8787/api/v1/media/assets/<KNOWN_ASSET_ID>/preview?variant=card"
```

Expected:

- successful responses return an image content type through the API route
- missing token/env/object states return existing safe errors
- no direct R2 URL, object key, bucket name, signed token, or private storage path appears
- wrong method returns `405 METHOD_NOT_ALLOWED`

## Internal Auth Rejection

Missing internal secret:

```sh
curl -sS -i http://127.0.0.1:8787/api/v1/internal/fotobox/items
curl -sS -i http://127.0.0.1:8787/api/v1/internal/downloads/history
curl -sS -i http://127.0.0.1:8787/api/v1/internal/admin/assets
curl -sS -i http://127.0.0.1:8787/api/v1/internal/admin/users
```

Invalid internal secret:

```sh
curl -sS -i -H "x-internal-api-secret: wrong-secret" http://127.0.0.1:8787/api/v1/internal/fotobox/items
curl -sS -i -H "x-internal-api-secret: wrong-secret" http://127.0.0.1:8787/api/v1/internal/admin/assets
```

Expected:

- internal auth error
- no secret, R2, storage, or DB internals in the response

Wrong methods with a valid local internal secret:

```sh
curl -sS -i -X PUT -H "x-internal-api-secret: <INTERNAL_API_SECRET>" http://127.0.0.1:8787/api/v1/internal/fotobox/items
curl -sS -i -X POST -H "x-internal-api-secret: <INTERNAL_API_SECRET>" http://127.0.0.1:8787/api/v1/internal/downloads/history
curl -sS -i -X POST -H "x-internal-api-secret: <INTERNAL_API_SECRET>" http://127.0.0.1:8787/api/v1/internal/admin/catalog/stats
curl -sS -i -X POST -H "x-internal-api-secret: <INTERNAL_API_SECRET>" http://127.0.0.1:8787/api/v1/internal/admin/filters
```

Expected:

- `405 METHOD_NOT_ALLOWED`

## Account And Fotobox Routes

With a valid internal secret and safe local test user id:

```sh
curl -sS -i -H "x-internal-api-secret: <INTERNAL_API_SECRET>" "http://127.0.0.1:8787/api/v1/internal/fotobox/items?authUserId=<AUTH_USER_ID>"
curl -sS -i -H "x-internal-api-secret: <INTERNAL_API_SECRET>" "http://127.0.0.1:8787/api/v1/internal/downloads/history?authUserId=<AUTH_USER_ID>"
```

Expected:

- stable JSON response shape
- results are scoped to the supplied authenticated user id
- no private storage fields leak

## Admin Internal Routes

With a valid internal secret and local admin-capable data:

```sh
curl -sS -i -H "x-internal-api-secret: <INTERNAL_API_SECRET>" "http://127.0.0.1:8787/api/v1/internal/admin/assets"
curl -sS -i -H "x-internal-api-secret: <INTERNAL_API_SECRET>" "http://127.0.0.1:8787/api/v1/internal/admin/users"
curl -sS -i -H "x-internal-api-secret: <INTERNAL_API_SECRET>" "http://127.0.0.1:8787/api/v1/internal/admin/catalog/stats"
curl -sS -i -H "x-internal-api-secret: <INTERNAL_API_SECRET>" "http://127.0.0.1:8787/api/v1/internal/admin/filters"
```

Expected:

- stable response shapes
- admin media tunnel routes do not expose direct R2 URLs or object keys

## Legacy Fixture Routes

```sh
curl -sS -i http://127.0.0.1:8787/assets
curl -sS -i http://127.0.0.1:8787/assets/<LEGACY_ASSET_ID_OR_SAMPLE>
curl -sS -i "http://127.0.0.1:8787/search?q=street"
curl -sS -i http://127.0.0.1:8787/media/preview/<SAMPLE_ID>
curl -sS -i http://127.0.0.1:8787/media/access/<SAMPLE_ID>
curl -sS -i http://127.0.0.1:8787/media/original/<SAMPLE_ID>
curl -sS -i http://127.0.0.1:8787/admin/assets
curl -sS -i http://127.0.0.1:8787/admin/ingestion/runs
```

Expected:

- fixture routes keep existing response shapes
- legacy media routes remain disabled/restricted
- no private storage fields leak
- these routes remain transitional and are not production `/api/v1` contracts

## Unknown Routes

```sh
curl -sS -i http://127.0.0.1:8787/does-not-exist
curl -sS -i http://127.0.0.1:8787/api/v1/does-not-exist
```

Expected:

- project-standard `404 ROUTE_NOT_FOUND`

## Web Smoke

With web and API servers running:

```sh
curl -sS -i http://127.0.0.1:3000/
curl -sS -i http://127.0.0.1:3000/search
curl -sS -i "http://127.0.0.1:3000/search?sort=latest"
curl -sS -i "http://127.0.0.1:3000/search?q=test"
curl -sS -i http://127.0.0.1:3000/categories
curl -sS -i http://127.0.0.1:3000/events
curl -sS -i http://127.0.0.1:3000/assets/<KNOWN_ASSET_ID>
curl -sS -i http://127.0.0.1:3000/account
curl -sS -i http://127.0.0.1:3000/account/fotobox
curl -sS -i http://127.0.0.1:3000/account/downloads
curl -sS -i http://127.0.0.1:3000/account/subscription
```

Expected:

- public pages load
- protected account pages redirect or return a safe auth response while logged out
- preview images use safe API URLs
- rendered HTML does not expose internal secrets or private storage data

## Browser-Visible Leak Scan

For saved response bodies or rendered HTML, search for:

```sh
grep -E "INTERNAL_API_SECRET|x-internal-api-secret|cloudflarestorage.com|X-Amz|MEDIA_ORIGINALS_BUCKET|MEDIA_PREVIEWS_BUCKET|r2_original_key|storageKey" <RESPONSE_FILE>
```

Expected:

- no matches

## Subscriber Download E2E

Only run this with:

- a known active subscriber
- a known downloadable approved asset
- local web/API servers configured with `INTERNAL_API_BASE_URL` and `INTERNAL_API_SECRET`
- access to verify database quota/log state

Browser path:

```text
/assets/<KNOWN_DOWNLOADABLE_ASSET_ID>
```

Expected UI:

- header and asset detail auth state agree
- active subscriber sees the download action
- failed preflight shows an inline error without full page refresh
- successful preflight starts the same-origin attachment route through hidden iframe/anchor
- no clean file is fetched into browser JavaScript memory as a blob

Successful download is verified only when all of these are true:

- attachment download starts
- quota increments by 1
- `image_download_logs` receives `COMPLETED` for that request (after `STARTED`; see [`download-completion-logging-report.md`](../../docs/db-revamp/reports/download-completion-logging-report.md))
- no direct R2 URL appears in the browser

If any of those cannot be verified, document subscriber download E2E as pending.
