# PR: Homepage instant shell and Latest Events pagination

## Summary

- Added `GET /api/v1/public/events/latest` with cursor pagination by `photo_events.created_at desc, id desc`.
- Reduced `GET /api/v1/public/homepage` to a lightweight response containing only `latestEventsPreview` and `generatedAt`.
- Removed blocking homepage SSR data waits from `apps/web/src/app/(marketing)/page.tsx`.
- Moved Latest Events and below-fold asset/editorial sections into client-side progressive loading.
- Added `apps/api/drizzle/0032_photo_events_active_created_at_id_idx.sql` for the latest-events cursor order.

## API behavior

- Latest Events defaults: `windowDays=30`, `limit=15`, `cursor=null`.
- Cursor encodes `createdAt` and `id`.
- Eligibility remains server-side:
  - `photo_events.status = ACTIVE`
  - `photo_events.created_at` inside the requested window
  - at least one `ACTIVE` + `PUBLIC` image asset
  - at least one ready `CARD` derivative
- `eventDate` remains nullable and is not required for eligibility.
- Preview URLs use stable public paths like `/api/media/assets/<assetId>/preview/card`.
- No signed URLs, R2 keys, bucket names, original storage keys, or internal secrets are returned.

## Web behavior

- `/` now renders the header, hero/search, tab shell, and section skeletons without awaiting the homepage feed.
- Latest Events loads the first 15 items after the shell renders.
- `Load more events` fetches `nextCursor` and appends results without offset pagination.
- Below-fold sections fetch only when their section is near the viewport or the relevant tab is selected.
- Section-level failures show `This section is temporarily unavailable.` without blanking the homepage.

## Verification

Commands run:

```txt
pnpm --dir apps/api check
pnpm --dir apps/api smoke:hono-routes
npm --prefix apps/web run build
pnpm --dir apps/api db:migrate
```

Notes:

- `pnpm --dir apps/api check` passed.
- `pnpm --dir apps/api smoke:hono-routes` passed after rerunning outside the sandbox because `tsx` could not create its IPC pipe inside the sandbox.
- `npm --prefix apps/web run build` passed after rerunning outside the sandbox because the Next build attempted to bind `127.0.0.1` inside the sandbox.
- `pnpm --dir apps/api db:migrate` applied the new index migration successfully.

In-process Hono verification against local `.dev.vars`:

| Route | Status | Duration | Result |
| --- | ---: | ---: | --- |
| `/api/v1/public/events/latest?windowDays=30&limit=15` | 200 | 25407ms | 15 items, `hasMore=true`, string `nextCursor`, stable preview URL, no signed URL leak |
| next page using returned cursor | 200 | 15076ms | 15 items, 0 duplicates, `hasMore=true` |
| `/api/v1/public/homepage` | 200 | 13197ms | keys: `latestEventsPreview`, `generatedAt`; no `newestAssets`; no `editorialSections` |

The in-process timings include local DB path latency and are still materially below the previously observed 31-34s mega-feed path. More importantly, the web homepage no longer waits on this endpoint before rendering the shell.
