# API Routing Audit

## Related documentation

- [DB revamp docs (README)](../../docs/db-revamp/README.md) — catalog/photographer DB revamp entry point, runbooks, and historical PR reports under `reports/`.
- [Media pipeline operations (temporary)](../../docs/db-revamp/media-pipeline-operations.md) — one-time derivative migration status and generation commands.
- [Typesense public search API report](../../docs/db-revamp/reports/typesense-public-search-api-report.md) — parallel public search route, BFF path, Typesense env, request mapping, and production access caveat.
- [Public route cache audit](../../docs/db-revamp/reports/public-route-cache-audit.md) — public route caller inventory, cache behavior, search back-navigation behavior, and verification commands.
- [Resend + Google Workspace email integration](../../docs/integrations/email-resend-google-workspace.md) — access-flow transactional email sender, reply handling, env vars, delivery logs, and manual test steps.
- [Hyperdrive rollout](../../docs/infrastructure/hyperdrive-rollout.md) — two-path Hyperdrive rollout rules, PR-1 core binding scope, and cached public-read guardrails.

## Incremental update (2026-06-16)

- **Caricature blurred preview generation (PR 10):** `POST /api/v1/internal/admin/caricature-assets/:assetId/generate-previews` queues `caricature_derivatives` (`BLURRED_CARD`, `BLURRED_DETAIL`). Node script `pnpm --dir apps/api media:generate-caricature-previews` reads originals from private bucket, writes blurred WebPs to `fotocorp-caricature-previews`, sets `public_url` from `PUBLIC_PREVIEW_CDN_BASE_URL`. Publish validation requires ready previews. Contributor wizard hides `PUBLISHED` status.
- **Caricature original upload (PR 9):** Private R2 bucket `fotocorp-caricature-originals` via Worker binding `MEDIA_CARICATURE_ORIGINALS_BUCKET` and S3 presign vars `R2_CARICATURE_ORIGINALS_BUCKET`. Routes: `POST /api/v1/internal/admin/caricature-assets/upload-shell`, `POST .../:assetId/original/presign`, `POST .../:assetId/original/complete` (mirrored on contributor `/api/v1/contributor/caricatures/*`). Upload wizard step 3 presigns browser PUT, verifies object, and sets `original_bucket` / `original_object_key` on `caricature_assets`. Staff BFF: `/api/staff/upload-wizard/caricatures/upload-shell`, `.../original/presign`, `.../original/complete`.
- **Caricature staff metadata CRUD + upload wizard (PR 8):** Internal routes `GET|POST /api/v1/internal/admin/caricature-assets` and `GET|PATCH .../:assetId` with language/visible-text validation and publish blocked until original file exists. Contributor routes `GET /api/v1/contributor/caricatures/categories`, `POST|GET|PATCH /api/v1/contributor/caricatures/:assetId`. Caricature is enabled in step 1 of the shared staff/contributor upload wizard; editorial keeps Event → Upload → Metadata, caricature uses Details → single-file Upload → caricature Metadata. Staff BFF: `/api/staff/upload-wizard/caricature-categories`, `/api/staff/upload-wizard/caricatures`.
- **Caricature categories seed + staff read (PR 2):** Idempotent `pnpm --dir apps/api db:seed:caricature-categories` for MVP taxonomy. Internal read route `GET /api/v1/internal/admin/caricature-categories` (`activeOnly` default true). Route ownership: `apps/api/src/routes/internal/admin-caricature-categories/route.ts`.

## Incremental update (2026-06-13)

- **Hyperdrive public-read DB PR-2:** `PUBLIC_READ_HYPERDRIVE` is active for reviewed anonymous public read-only Postgres routes only. The binding uses a read-only Neon role with Hyperdrive query caching configured for max-age 60 seconds and stale-while-revalidate 15 seconds. Migrated responses include `x-fotocorp-db-path: public-read`. Auth/session/download/entitlement/staff/contributor mutation paths remain core/non-cached. Public media preview metadata remains unchanged. Typesense search routes remain Typesense-backed and are not part of this DB migration.
- **Hyperdrive core DB foundation PR-1:** Added `CORE_HYPERDRIVE` / `PUBLIC_READ_HYPERDRIVE` env typing and `apps/api/src/db/hyperdrive.ts` with request-scoped `pg.Client` + `drizzle-orm/node-postgres` helpers. Existing Neon HTTP and Neon serverless transaction helpers remain unchanged. Public catalog/homepage/media routes were not migrated in PR-1.
- **Protected core DB health check:** `GET /api/v1/internal/health/hyperdrive-core` is owned by `apps/api/src/routes/system/health/hyperdrive-core-route.ts`; it requires `x-internal-api-secret`, runs `select 1 as ok` through `withCoreDb`, and returns only `{ ok, dbPath, provider }`.

## Incremental update (2026-06-11)

- **Video/Caricature access-request quantities:** `POST /api/v1/auth/sign-up` now accepts and requires `videoQuantityRange` for `VIDEO` and `caricatureQuantityRange` for `CARICATURE`; no quality preference is collected for those asset types. `GET /api/v1/staff/access-inquiries*` surfaces the quantity fields, and `POST /api/v1/staff/access-inquiries/:inquiryId/entitlement-draft` uses them to prefill allowed downloads while defaulting Video/Caricature `quality_access` to `HIGH`. Migration: `0053_access_interest_video_caricature_quantity.sql`.
- **`SUPER_ADMIN` staff audit read:** `GET /api/v1/staff/audit-logs` — unified cursor-paginated feed across `staff_audit_logs`, `asset_admin_audit_logs`, and `admin_user_audit_logs`; query params `source`, `action`, `entityType`, `from`, `to`, `limit`, `cursor`. Route ownership: `apps/api/src/routes/staff/audit-logs/route.ts`. Web BFF proxies via `/api/staff/audit-logs`; staff UI at `/staff/audit`.
- **`SUPER_ADMIN` staff productivity read:** `GET /api/v1/staff/productivity` — aggregates caption edits and unique captioned assets from existing audit streams (`asset_admin_audit_logs.after ? 'caption'` plus `staff_audit_logs.metadata_json.changedFields`), and upload approvals/rejections from contributor-upload audit counts. Query params `from`, `to`. Route ownership: `apps/api/src/routes/staff/productivity/route.ts`. Web BFF proxies via `/api/staff/productivity`; staff UI at `/staff/team-performance`.
- **Request audit metadata:** Registration and contributor submissions store submission metadata on `customer_access_inquiries`; downloads store metadata on `image_download_logs`. Web BFF captures download audit before forwarding to internal API. Staff inquiry detail returns `submissionAudit` (raw IP `SUPER_ADMIN`-only); mutation inquiry payloads are sanitized. See `context/architecture.md` § Request Audit Metadata.

## Incremental update (2026-06-07)

- Staff role **`CAPTION_WRITER`** added (`0048_staff_role_caption_writer.sql`). Contributor upload review actions now write `staff_audit_logs` rows (`CONTRIBUTOR_UPLOAD_METADATA_SAVED`, `CONTRIBUTOR_UPLOAD_APPROVED`, `CONTRIBUTOR_UPLOAD_REJECTED`, `CONTRIBUTOR_UPLOAD_FILE_REPLACED`) from `apps/api/src/routes/internal/admin-contributor-uploads/service.ts` using `x-admin-auth-user-id` from the web BFF. Metadata save audit now records actual changed fields after normalization, so productivity reporting can count caption changes without treating every save as a caption edit.
- **`CAPTION_WRITER` admin provisioning (staff-authenticated, not bootstrap):** `GET|POST /api/v1/staff/members`, `PATCH /api/v1/staff/members/:memberId` — `SUPER_ADMIN` only; create/list/disable/reset password for `CAPTION_WRITER` accounts. Web BFF proxies via `/api/staff/members*`. Staff UI: `/staff/staff-users`.
- Removed temporary staff media pipeline visibility: deleted `/staff/media-pipeline` page, sidebar nav item, and internal admin route `GET /api/v1/internal/admin/media-pipeline/status`. CLI `pnpm --dir apps/api media:pipeline-status` remains for operator use.

## Incremental update (2026-06-06)

- `GET /api/v1/internal/admin/homepage-hero-pool` returns the curated 25-image homepage hero pool from `public_homepage_hero_pool_items`.
- `GET /api/v1/internal/admin/homepage-hero-pool/candidates` lists public-ready CARD preview candidates for staff selection (Postgres fallback when Typesense is disabled; staff UI prefers `GET /api/public/search/assets`).
- `PUT /api/v1/internal/admin/homepage-hero-pool` atomically replaces the pool with exactly 25 eligible assets and writes a `staff_audit_logs` row (`HOMEPAGE_HERO_POOL_REPLACED`).
- `GET /api/v1/public/homepage/hero-set` reads `public_homepage_hero_pool_items` directly and returns a random 9 of 25 on each request when the pool is complete; no refresh job required.
- Staff UI: `/staff/homepage-hero` for `SUPER_ADMIN` and `CATALOG_MANAGER`.

## Incremental update (2026-06-04)

- `POST /api/v1/internal/admin/contributor-uploads/approve` — after Neon publish job rows are committed, the Worker POSTs `JOBS_DRAIN_WEBHOOK_URL` (VPS `publish:wake`) with header `x-jobs-wake-secret` = `JOBS_DRAIN_WEBHOOK_SECRET` (must match VPS `JOBS_WAKE_SECRET`). The outbound fetch is registered with `executionCtx.waitUntil()` so it is not cancelled when the approve JSON response returns. Approval response is unchanged if the wake fails. Implementation: `apps/api/src/lib/jobs/publish-drain-webhook.ts`.
- `POST /api/v1/auth/forgot-password` — body `{ email }`; always returns generic success message; creates `password_reset_tokens` row and sends `CUSTOMER_PASSWORD_RESET` when an ACTIVE USER email credential exists; rate-limited per user/IP. Web BFF `POST /api/auth/forgot-password`.
- `GET /api/v1/auth/reset-password/validate?token=` — validates unused non-expired token hash. Web BFF `GET /api/auth/reset-password/validate`.
- `POST /api/v1/auth/reset-password` — body `{ token, newPassword }`; updates USER credential hashes, marks token used, revokes all USER sessions (no auto-login). Web BFF `POST /api/auth/reset-password`. Migration: `0045_password_reset_tokens.sql`.
- `POST /api/v1/auth/change-password` (`apps/api/src/routes/platform-auth/route.ts`): requires valid `fotocorp_session` with `owner_type = USER`; body `{ currentPassword, newPassword }`; verifies current password, enforces portal strength rules, updates all ACTIVE USER `auth_credentials` (EMAIL + USERNAME rows), revokes other USER sessions for that account. Web BFF `POST /api/auth/change-password` proxies to this route.

## Incremental update (2026-06-03)

- `GET /api/v1/auth/session` (`apps/api/src/routes/platform-auth/route.ts`): lightweight platform session from `fotocorp_session`; returns `{ ok, ownerType, user?, contributor? }` without registration profile/inquiry payload. Web BFF `GET /api/auth/get-session` prefers staff cookie when present, else proxies this route (legacy fallback: `contributor/auth/me` + `auth/me`).

## Incremental update (2026-06-02)

- `GET /api/v1/assets/filters` defaults to taxonomy-only (`includeCounts` omitted or not `"true"`). Heavy category/event aggregate counts require explicit `?includeCounts=true` (opt-in). Public marketing pages (`/categories`, `/events`, `/search`, slug/event detail) use web helper `getPublicCatalogTaxonomy()` → lightweight reads from `asset_categories` / `photo_events` without asset aggregation.

## Incremental update (2026-06-01)

- `POST /api/v1/auth/sign-up` remains owned by `apps/api/src/routes/platform-auth/route.ts`; after successful user/account/inquiry creation it sends `CUSTOMER_ACCESS_REQUEST_RECEIVED` to the registrant and, when `STAFF_ACCESS_INQUIRY_NOTIFY_EMAIL` is set, `STAFF_NEW_ACCESS_INQUIRY` to that internal inbox (minimal applicant summary + staff review link). Both use `apps/api/src/lib/email/email-service.ts`. Email failure is logged and does not fail registration.
- `POST /api/v1/public/contributor-applications` remains owned by `apps/api/src/routes/public/contributor-applications/route.ts`; after successful application inquiry creation it sends `CONTRIBUTOR_APPLICATION_RECEIVED` when the applicant supplied an email. Email failure is logged and does not fail application submission.
- `POST /api/v1/staff/access-inquiries/:inquiryId/approve-contributor` remains owned by `apps/api/src/routes/staff/access-inquiries/route.ts`; after successful contributor activation/credential issuance it sends `CONTRIBUTOR_APPLICATION_APPROVED_WITH_CREDENTIALS` when the applicant supplied an email. Temporary passwords are rendered only in the outgoing provider payload, not delivery logs.
- `POST /api/v1/staff/subscriber-entitlements/:entitlementId/activate` remains owned by `apps/api/src/routes/staff/access-inquiries/route.ts`; after successful entitlement activation it sends `CUSTOMER_ACCESS_APPROVED` with entitlement limits via `apps/api/src/lib/email/entitlement-email.ts`. Idempotency is keyed per `subscriber_entitlement` (separate Image/Video activations each email once).
- `POST /api/v1/staff/access-inquiries/:inquiryId/activate-entitlements` activates **DRAFT** rows for an inquiry (all drafts by default, or optional `entitlementIds` subset); validates positive download caps on the selection; sends one consolidated `CUSTOMER_ACCESS_APPROVED` email keyed to `entitlement_batch`.
- `PATCH /api/v1/staff/subscriber-entitlements/:entitlementId` on **ACTIVE** rows sends `CUSTOMER_ENTITLEMENT_UPDATED` when `allowed_downloads` or `quality_access` changes; idempotency keyed per entitlement update timestamp.
- `POST /api/v1/staff/access-inquiries/:inquiryId/close` remains owned by `apps/api/src/routes/staff/access-inquiries/route.ts`; after successful close it sends `CUSTOMER_ACCESS_REJECTED` or `CONTRIBUTOR_APPLICATION_REJECTED` based on inquiry type. Staff notes remain internal and are not rendered in the public email.

## Incremental update (2026-05-30)

- `GET /api/v1/public/royalty-free/featured` is the canonical public Royalty-Free featured feed in `apps/api/src/routes/public/homepage-routes.ts`; it reads current-month rows from `public_royalty_free_featured_items` (featured-first CTE, then asset/derivative joins) and returns public featured assets with `Cache-Control: public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800`. Populate with `pnpm --dir apps/api royalty-free:refresh-featured -- --period YYYY-MM --limit 50` (`creative:refresh-featured` remains an alias).
- `GET /api/v1/public/creative/featured` remains a compatibility alias to the same handler (`legacyRoute: true` in logs). Web BFF `GET`/`HEAD` `/api/public/royalty-free/featured` maps to the canonical route; `/api/public/creative/featured` remains mapped for backward compatibility.
- `GET /api/v1/public/homepage/hero-set` is owned by `apps/api/src/routes/public/homepage-routes.ts`; it reads `public_homepage_hero_pool_items` (exactly 25 eligible rows) and returns a shuffled 9-item backdrop set per request. Returns `Cache-Control: public, max-age=0, s-maxage=30, stale-while-revalidate=60`. Staff save at `/staff/homepage-hero` is the write path — no cron or refresh script required.
- Web BFF `GET`/`HEAD` `/api/public/homepage/hero-set` maps to the route above with matching public cache headers.
- `GET /api/v1/public/events/browse` is owned by `apps/api/src/routes/public/homepage-routes.ts`; it supports `section=news|sports|entertainment|fashion|retro`, reads `photo_events` joined to `asset_categories` on `photo_events.category_id`, requires at least one public-ready CARD preview asset per event, and uses keyset pagination on `event_date desc nulls last, id desc`. Cache: `public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400`.
- Web BFF `GET`/`HEAD` `/api/public/events/browse` maps to the browse route above with the same 1-day browser / 30-day edge cache header.

## Incremental update (2026-05-29)

- `GET /api/v1/search/assets` remains owned by `apps/api/src/routes/public/catalog-routes.ts` and now returns `Cache-Control: public, max-age=30, s-maxage=120, stale-while-revalidate=300` for anonymous public Typesense results.
- `GET /api/v1/assets/:assetId` remains owned by `apps/api/src/routes/public/catalog-routes.ts` and now returns `Cache-Control: public, max-age=300, s-maxage=2592000, stale-while-revalidate=604800` for public metadata.
- Web BFF `GET`/`HEAD` `/api/public/events/latest`, `/api/public/search/assets`, `/api/public/search/caricatures`, and `/api/public/assets/:assetId` remain owned by `apps/web/src/app/api/public/[...path]/route.ts`; these public paths explicitly preserve/set public cache headers instead of falling back to `private, no-store`.
- `GET /api/v1/public/events/latest` now accepts `section=latest|news|sports|entertainment|fashion|retro` while staying projection-backed by `public_event_feed_items`.
- `GET /api/v1/public/creative/featured` was renamed in favor of `GET /api/v1/public/royalty-free/featured` (see 2026-05-30 incremental update); the creative path remains as a compatibility alias.
- Public marketing layout no longer probes `/api/v1/staff/auth/me`; staff auth remains required under `/staff/*`.

## Incremental update (2026-05-20)

- Added parallel public search route: `GET /api/v1/search/assets`.
- Route ownership: `apps/api/src/routes/public/catalog-routes.ts`.
- Service/helper: `apps/api/src/lib/search/typesense-public-assets.ts`.
- Web BFF path: `GET /api/public/search/assets` in `apps/web/src/app/api/public/[...path]/route.ts`.
- Existing SQL-backed public routes `/api/v1/assets` and `/api/v1/assets/filters` are unchanged.
- PR-3 correction: route `query_by` is `event_title,caption,who_is_in_picture,people,keywords,category_name,fotokey`; `title` is not searched.
- PR-4 secure access: outbound Typesense fetches always send `X-TYPESENSE-API-KEY` and optionally send Cloudflare Access service-token headers when both `TYPESENSE_CF_ACCESS_CLIENT_ID` and `TYPESENSE_CF_ACCESS_CLIENT_SECRET` are configured. Partial Access config returns the existing `typesense_not_configured` path.
- PR-5 compatibility cutover prep: the route now accepts `q`, `page`, `limit`, `category`, `event`, `city`, and `sort` while preserving legacy `categoryId` / `eventId` compatibility. It returns `total`, `page`, `perPage`, `totalPages`, `facets.categories/events/cities/sources`, and `timing.backend="typesense"` while keeping `totalCount`, `limit`, `hasMore`, and `meta` for existing consumers. The web `/search` page uses `/api/public/search/assets` only when `NEXT_PUBLIC_USE_TYPESENSE_SEARCH=true`; it does not call `/api/v1/assets/filters` in that mode.

## Incremental update (2026-05-14)

- Added internal admin route: `GET /api/v1/internal/admin/media-pipeline/status`.
- Route ownership: `apps/api/src/routes/internal/admin/route.ts`.
- Service: `apps/api/src/routes/internal/admin/service.ts` using shared query module `apps/api/src/lib/media/pipeline-status.ts`.

## Current Entry Point

- Main file: `apps/api/src/index.ts`
- Routing style: Manual `if`/`startsWith`/regex path matching in a single `fetch` handler.
- Error handling: Global `try/catch` in `fetch`, using `errorResponse(...)` with `AppError` codes/status.
- Service creation pattern: Service/repository objects are constructed at request entry in `fetch` and passed into route functions.
- Hono installed: Yes (`apps/api/package.json` includes `hono` and `@hono/zod-validator`).
- Hono used in main entrypoint: No. Main API router is manual; Hono is only referenced as a type import in `apps/api/src/db/index.ts`.

## Current Problem

`apps/api/src/index.ts` currently mixes too many responsibilities:

- service creation
- route matching
- method checks
- param decoding
- internal API dispatch
- legacy route dispatch
- error handling

This makes route behavior hard to reason about and slows root-cause analysis when errors occur (for example subscriber download failures).

## Route Groups

### Health Routes

| Method | Path | Handler | Source file | Notes |
|---|---|---|---|---|
| `GET` | `/health` | `healthRoute` | `apps/api/src/routes/health.ts` | Returns provisional fixture environment health payload. |
| `GET` | `/api/v1/internal/health/hyperdrive-core` | `hyperdriveCoreHealthRoutes` | `apps/api/src/routes/system/health/hyperdrive-core-route.ts` | Internal secret required. Probes the `CORE_HYPERDRIVE` core DB path with fallback to `DATABASE_URL`; does not expose connection details or raw errors. |

### Legacy or Fixture Routes

| Method | Path | Handler | Source file | Notes |
|---|---|---|---|---|
| `GET` | `/assets` | `listAssetsRoute` | `apps/api/src/routes/assets.ts` | Legacy fixture-backed list via `FixtureCatalogRepository`. |
| `GET` | `/assets/:id` | `getAssetRoute` | `apps/api/src/routes/assets.ts` | Legacy fixture-backed detail. |
| `GET` | `/search` | `searchRoute` | `apps/api/src/routes/search.ts` | Legacy fixture search path. |
| `GET` | `/media/preview/*` | `previewMediaRoute` | `apps/api/src/routes/media.ts` | Legacy media route explicitly disabled (`410`). |
| `GET` | `/media/access/*` | `mediaAccessRoute` | `apps/api/src/routes/media.ts` | Legacy media route explicitly disabled (`410`). |
| `GET` | `/media/original/*` | `originalMediaRoute` | `apps/api/src/routes/media.ts` | Legacy original route restricted (`403`). |
| `GET` | `/admin/assets` | `listAdminAssetsRoute` | `apps/api/src/routes/admin.ts` | Legacy fixture-backed admin surface. |
| `GET` | `/admin/assets/:id` | `getAdminAssetRoute` | `apps/api/src/routes/admin.ts` | Legacy fixture-backed admin detail. |
| `GET` | `/admin/ingestion/runs` | `listIngestionRunsRoute` | `apps/api/src/routes/admin.ts` | Legacy fixture-backed ingestion listing. |
| `GET` | `/admin/ingestion/runs/:id` | `getIngestionRunRoute` | `apps/api/src/routes/admin.ts` | Legacy fixture-backed ingestion detail. |

### Public Catalog Routes

| Method | Path | Handler | Source file | Notes |
|---|---|---|---|---|
| `GET` | `/api/v1/assets` | `publicAssetListRoute` | `apps/api/src/routes/public/catalog-routes.ts` | DB-backed public catalog list. PR-2 uses `PUBLIC_READ_HYPERDRIVE` and returns `x-fotocorp-db-path: public-read`. PR-16I: JSON `fotokey` = `image_assets.fotokey`; `category` = asset category else event default; `categoryId` query matches asset or (null asset + event) category. |
| `GET` | `/api/v1/assets/filters` | `publicAssetFiltersRoute` | `apps/api/src/routes/public/catalog-routes.ts` | PR-2 uses `PUBLIC_READ_HYPERDRIVE`. Taxonomy by default (`asset_categories`, `photo_events`). Pass `includeCounts=true` only when aggregate counts are explicitly required; public UX should use `getPublicCatalogTaxonomy()` on web instead. |
| `GET` | `/api/v1/assets/collections` | `publicAssetCollectionsRoute` | `apps/api/src/routes/public/catalog-routes.ts` | PR-2 uses `PUBLIC_READ_HYPERDRIVE`. DB-backed collections. PR-16I: same resolved category for grouping/preview pick. |
| `GET` | `/api/v1/assets/events` | `getPublicAssetEvents` | `apps/api/src/routes/public/catalog-routes.ts` | PR-2 uses `PUBLIC_READ_HYPERDRIVE`. Event collection feed for public catalog consumers. |
| `GET` | `/api/v1/assets/:id` | `publicAssetDetailRoute` | `apps/api/src/routes/public/catalog-routes.ts` | PR-2 uses `PUBLIC_READ_HYPERDRIVE`. DB-backed public asset detail. PR-16I: same `fotokey` + category rules as list. |
| `GET` | `/api/v1/search/assets` | `searchTypesensePublicAssets` | `apps/api/src/routes/public/catalog-routes.ts` + `apps/api/src/lib/search/typesense-public-assets.ts` | Parallel Typesense-backed public search/count endpoint. Searches `event_title`, `caption`, `who_is_in_picture`, `people`, `keywords`, `category_name`, and `fotokey`; does not search `title`. Supports page pagination and category/event/city name filters for the feature-flagged `/search` cutover. Facets remain available by default, but callers can pass `includeFacets=false`; the `/search` UI uses `/api/v1/assets/filters` separately for filter data. Does not replace `/api/v1/assets` or `/api/v1/assets/filters`. |
| `GET` | `/api/v1/search/caricatures` | `searchTypesenseCaricatures` | `apps/api/src/routes/public/catalog-routes.ts` + `apps/api/src/lib/search/typesense-caricatures.ts` | Typesense-backed caricature segment search (`status:=PUBLISHED && visibility:=PUBLIC`). BFF: `/api/public/search/caricatures`. Returns empty results when the collection is missing (Typesense 404). Wired by `/search?segment=caricature` when `NEXT_PUBLIC_USE_TYPESENSE_SEARCH=true`. |
| `GET` | `/api/v1/search/events` | `searchTypesensePublicEvents` | `apps/api/src/routes/public/catalog-routes.ts` + `apps/api/src/lib/search/typesense-public-event-search.ts` | Typesense grouped search by `event_id` (`group_limit=1`) for matching unique events; filters to event-backed documents with `event_date_ts:>0` and sorts by `event_date_ts` for date browsing so null-event legacy assets do not occupy event result pages. Returns representative asset + preview + per-event matching asset counts. BFF: `/api/public/search/events`. Used by `/search?mode=events`; event cards link to `/assets/[representativeAssetId]`. Does not use `/api/v1/assets`. Report: [`docs/db-revamp/reports/search-event-results-report.md`](../../docs/db-revamp/reports/search-event-results-report.md). |
| `GET` | `/api/v1/public/homepage` | `getPublicHomepageFeed` | `apps/api/src/routes/public/homepage-routes.ts` | PR-2 uses `PUBLIC_READ_HYPERDRIVE`. Lightweight homepage feed: first-page latest-events preview only, ordered by `event_date`; no newest/editorial asset slices. |
| `GET` | `/api/v1/public/homepage/hero-set` | `getPublicHomepageHeroSet` | `apps/api/src/routes/public/homepage-routes.ts` | PR-2 uses `PUBLIC_READ_HYPERDRIVE`. Random 9 from staff-curated `public_homepage_hero_pool_items` (requires exactly 25 eligible rows). Cache `public, max-age=0, s-maxage=30, stale-while-revalidate=60`. Staff save at `/staff/homepage-hero` is the write path and remains non-cached/core. |
| `GET` | `/api/v1/public/events/latest` | `listPublicLatestEvents` | `apps/api/src/routes/public/homepage-routes.ts` | PR-2 uses `PUBLIC_READ_HYPERDRIVE`. Cursor-paginated Latest Events from `public_event_feed_items` projection (`windowDays`, `limit`, optional cursor), filtered and ordered by `event_date desc, event_id desc`. Returns `previewAssetId` for homepage event cards to link to `/assets/[id]`. Card `previewUrl` uses `PUBLIC_PREVIEW_CDN_BASE_URL` + derivative `storage_key` when configured; otherwise stable `/api/media/assets/:id/preview/card` fallback. |
| `GET` | `/api/v1/public/events/browse` | `fetchPublicEventCategoryBrowseRows` | `apps/api/src/routes/public/homepage-routes.ts` + `apps/api/src/lib/assets/public-homepage.ts` | PR-2 uses `PUBLIC_READ_HYPERDRIVE`. Cursor-paginated homepage category browse for `news`, `sports`, `entertainment`, `fashion`, and `retro`. Reads `photo_events` + `asset_categories` (not `public_event_feed_items`), filters `status = ACTIVE` with a public-ready CARD preview per event, returns `limit+1` keyset pagination, and does not expose total counts. |
| `GET` | `/api/v1/public/royalty-free/featured` | `listPublicRoyaltyFreeFeaturedAssets` | `apps/api/src/routes/public/homepage-routes.ts` | PR-2 uses `PUBLIC_READ_HYPERDRIVE`. Canonical public Royalty-Free featured feed. |
| `GET` | `/api/v1/public/creative/featured` | `listPublicRoyaltyFreeFeaturedAssets` | `apps/api/src/routes/public/homepage-routes.ts` | PR-2 uses `PUBLIC_READ_HYPERDRIVE`. Compatibility alias for Royalty-Free featured. |

### Public Media Routes

| Method | Path | Handler | Source file | Notes |
|---|---|---|---|---|
| `GET` | `/api/v1/media/assets/:assetId/preview` | `securePreviewMediaRoute` | `apps/api/src/routes/secureMedia.ts` | Token-verified preview route (legacy signed URLs). |
| `GET` | `/api/media/assets/:assetId/preview/:variant` | `stablePreviewMediaRoute` | `apps/api/src/routes/public/stable-preview-media.ts` | Stable public preview (no token). Same handler on `/api/v1/media/assets/:assetId/preview/:variant`. Retained as fallback when `PUBLIC_PREVIEW_CDN_BASE_URL` is unset; public JSON responses prefer direct CDN URLs when configured. Not moved to cached public-read Hyperdrive in PR-2. |

### Internal Admin Routes

| Method | Path | Handler | Source file | Notes |
|---|---|---|---|---|
| `GET` | `/api/v1/internal/admin/assets` | `internalAdminAssetsRoute` | `apps/api/src/routes/internalAdminCatalog.ts` | Internal secret required. |
| `GET` | `/api/v1/internal/admin/assets/:assetId` | `internalAdminAssetDetailRoute` | `apps/api/src/routes/internalAdminCatalog.ts` | Internal secret required. |
| `PATCH` | `/api/v1/internal/admin/assets/:assetId` | `internalAdminAssetUpdateRoute` | `apps/api/src/routes/internalAdminCatalog.ts` | Internal secret required. |
| `POST` | `/api/v1/internal/admin/assets/:assetId/publish-state` | `internalAdminAssetPublishStateRoute` | `apps/api/src/routes/internalAdminCatalog.ts` | Explicit method guard in `index.ts`. |
| `GET` | `/api/v1/internal/admin/assets/:assetId/original` | `internalAdminAssetOriginalRoute` | `apps/api/src/routes/internalAdminCatalog.ts` | Explicit method guard in `index.ts`. |
| `GET` | `/api/v1/internal/admin/assets/:assetId/preview` | `internalAdminAssetPreviewRoute` | `apps/api/src/routes/internalAdminCatalog.ts` | Explicit method guard in `index.ts`. |
| `GET` | `/api/v1/internal/admin/catalog/stats` | `internalAdminStatsRoute` | `apps/api/src/routes/internalAdminCatalog.ts` | No explicit method guard in `index.ts`; handler enforces auth. |
| `GET` | `/api/v1/internal/admin/filters` | `internalAdminFiltersRoute` | `apps/api/src/routes/internalAdminCatalog.ts` | No explicit method guard in `index.ts`; handler enforces auth. Returns cheap taxonomy options for staff catalog filters without global `image_assets` count aggregation. |
| `GET` | `/api/v1/internal/admin/users` | `internalAdminUsersRoute` | `apps/api/src/routes/internalAdminCatalog.ts` | Explicit method guard in `index.ts`. |
| `PATCH` | `/api/v1/internal/admin/users/:authUserId/subscription` | `internalAdminUserSubscriptionRoute` | `apps/api/src/routes/internalAdminCatalog.ts` | Explicit method guard in `index.ts`. |
| `GET` | `/api/v1/internal/admin/homepage-hero-pool` | `getHomepageHeroPoolService` | `apps/api/src/routes/internal/admin-homepage-hero-pool/route.ts` | Curated 25-image homepage hero pool from `public_homepage_hero_pool_items`. |
| `GET` | `/api/v1/internal/admin/homepage-hero-pool/candidates` | `listHomepageHeroPoolCandidatesService` | `apps/api/src/routes/internal/admin-homepage-hero-pool/route.ts` | Public-ready CARD preview candidates for staff selection. |
| `PUT` | `/api/v1/internal/admin/homepage-hero-pool` | `replaceHomepageHeroPoolService` | `apps/api/src/routes/internal/admin-homepage-hero-pool/route.ts` | Atomically replaces pool with exactly 25 eligible assets; writes `HOMEPAGE_HERO_POOL_REPLACED` audit log. |

### Internal Account Routes

| Method | Path | Handler | Source file | Notes |
|---|---|---|---|---|
| `GET`,`POST` | `/api/v1/internal/fotobox/items` | `internalFotoboxItemsRoute` | `apps/api/src/routes/internalAccount.ts` | Method dispatch inside handler. |
| `DELETE` | `/api/v1/internal/fotobox/items/:assetId` | `internalFotoboxItemRoute` | `apps/api/src/routes/internalAccount.ts` | UUID route param validated in handler. |
| `GET` | `/api/v1/internal/downloads/history` | `internalDownloadHistoryRoute` | `apps/api/src/routes/internalAccount.ts` | Auth + pagination/filter route. |

### Internal Download Routes

| Method | Path | Handler | Source file | Notes |
|---|---|---|---|---|
| `POST` | `/api/v1/internal/assets/:assetId/download/check` | preflight check | `apps/api/src/routes/internal/downloads/` | No quota decrement; no `image_download_logs` writes. |
| `POST` | `/api/v1/internal/assets/:assetId/download` | `internalSubscriberAssetDownloadRoute` | `apps/api/src/routes/internalDownloads.ts` | Internal secret required; UUID validation + subscriber/quota logic. Accepts `requestAudit` (web BFF) or legacy `requestIp`/`userAgent`; persists audit fields on `image_download_logs` for `STARTED` and relevant `FAILED` rows only. Web BFF captures audit via `getRequestAuditContext()` before proxying. |

## Risks Found

- `index.ts` is too large and centrally owns too many concerns.
- Manual regex/path dispatch makes route behavior brittle.
- Method guard strategy is inconsistent between `index.ts` and route handlers.
- Legacy fixture routes coexist with DB-backed `/api/v1` routes.
- Download route debugging is harder because dispatch and validation are split.
- No central route-group abstraction or router composition.
- Hono is installed but main entrypoint is not using a Hono app shell.

## Recommended Hono Migration Sequence

1. Introduce Hono app shell with `/health` and `/api/v1/internal/assets/:assetId/download` only.
2. Move public catalog routes (`/api/v1/assets*`).
3. Move public media route (`/api/v1/media/assets/:assetId/preview`).
4. Move internal account + internal download history/fotobox routes.
5. Move internal admin catalog routes.
6. Remove or isolate legacy fixture routes behind separate adapter/module.
7. Shrink `index.ts` to export a composed Hono app and thin bootstrap only.

Future install note (not executed in this PR):

- `pnpm --dir apps/api add hono`

(Dependency already exists today.)

## Subscriber Download Trace

### Web Same-Origin Route

- File path: `apps/web/src/app/api/assets/[assetId]/download/route.ts`
- Asset ID source: `context.params.assetId` from same-origin route segment.
- Size source: query string `?size=...`, parsed by `parseSize`.
- Internal API URL built in: `apps/web/src/lib/api/subscriber-downloads-api.ts`
- URL shape: `${API_BASE_URL}/api/v1/internal/assets/${encodeURIComponent(assetId)}/download`
- Method used to internal API: `POST`
- Body sent:
  - `authUserId`
  - `size`
  - `userAgent`
  - `requestIp`
- Headers sent:
  - `Accept: application/octet-stream, application/json`
  - `Content-Type: application/json`
  - `x-internal-api-secret: <server env>`
- Error mapping:
  - Reads upstream JSON `error.code` and maps to user-safe redirect query states (`subscription-required`, `quota-exceeded`, etc.).

### API Manual Router

- File path: `apps/api/src/index.ts`
- Regex used:
  - `^/api/v1/internal/assets/([^/]+)/download$`
- Captured param handling:
  - `decodeURIComponent(match[1])` passed as `assetId`.
- Handler called:
  - `internalSubscriberAssetDownloadRoute(request, env, assetId)`
- Method guard status:
  - Before this PR: no explicit guard in `index.ts` (guard existed inside handler).
  - After this PR: explicit `POST` guard added in `index.ts`, non-POST returns `METHOD_NOT_ALLOWED` (`405`).

### Internal Download Handler

- File path: `apps/api/src/routes/internalDownloads.ts`
- Handler signature:
  - `internalSubscriberAssetDownloadRoute(request, env, assetId)`
- `assetId` source:
  - Route param function argument.
- `size` source:
  - JSON body parsed via `downloadRequestSchema` enum (`web|medium|large`).
- `authUserId` source:
  - JSON body parsed via `downloadRequestSchema`.
- Validation schema:
  - `downloadRequestSchema` validates body fields only.
  - Separate UUID validation on route param via `isUuid(assetId)`.
- Exact source of `INVALID_ASSET_ID`:
  - Thrown at the route-param check:
    - `if (!isUuid(assetId)) throw new AppError(400, "INVALID_ASSET_ID", ...)`

## Download Bug Finding

- Root cause:
  - `INVALID_ASSET_ID` is emitted only when the route param reaching `internalSubscriberAssetDownloadRoute` fails UUID regex validation.
  - The payload schema/body is not the origin of this specific code.
- File:
  - `apps/api/src/routes/internalDownloads.ts`
- Exact mismatch:
  - No route/body field mismatch found for this code path; mismatch is at route-param value quality at runtime (or malformed encoded path segment before handler).
- Tiny fix applied:
  - Added explicit `POST` method guard in `apps/api/src/index.ts` for `/api/v1/internal/assets/:assetId/download`.
- Recommended follow-up if not fully resolved:
  - Add one focused safe diagnostic at the throw site for invalid route `assetId` (log method + sanitized assetId + error code), and capture sample failing request path in QA to confirm whether malformed path input reaches API.

## Security Verification Notes

- Browser flow stays same-origin (`/api/assets/:assetId/download?size=...`).
- Internal URL and `x-internal-api-secret` remain server-side in `apps/web/src/lib/api/subscriber-downloads-api.ts` (`server-only`).
- No changes expose internal secret, signed tokens, R2 keys, bucket names, or private object paths.
- Download flow remains separate from public preview path.
- Public preview route continues using signed token verification and watermarked derivative checks.

## PR-19 Hono Shell

- Hono app shell created in `apps/api/src/honoApp.ts`.
- Route gate created in `apps/api/src/honoRouteGate.ts` to scope Hono handling.
- Routes migrated to Hono:
  - `GET /health`
  - `POST /api/v1/internal/assets/:assetId/download`
- Non-POST methods on `/api/v1/internal/assets/:assetId/download` now return `405 METHOD_NOT_ALLOWED` via Hono route handling.
- Manual router in `apps/api/src/index.ts` remains in place for all other routes.
- Added safe diagnostics for invalid download route asset id in `apps/api/src/routes/internalDownloads.ts`:
  - `assetId`
  - `assetIdLength`
  - `assetIdJson`
  - `method`

Target architecture note:

- `index.ts` should eventually export or delegate fully to the Hono app.
- Route modules should be grouped by public, internal account, internal admin, media, and legacy.

Next recommended migration group:

- Public catalog routes (`/api/v1/assets`, `/api/v1/assets/filters`, `/api/v1/assets/collections`, `/api/v1/assets/:id`).

## PR-16C — Staff auth (Hono, current)

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/v1/staff/auth/login` | JSON body `{ username, password }`; sets HttpOnly `fotocorp_staff_session`. |
| `POST` | `/api/v1/staff/auth/logout` | Revokes session server-side; clears cookie. |
| `GET` | `/api/v1/staff/auth/me` | Requires valid staff session cookie. |

### Staff — sales-led access inquiries (current)

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/staff/access-inquiries` | Staff session; roles `SUPER_ADMIN`, `SUPPORT`, `FINANCE`. Query: `type`, `status`. |
| `GET` | `/api/v1/staff/access-inquiries/:inquiryId` | Detail + `subscriberAccess` + linked entitlement rows + `submissionAudit` (raw IP SUPER_ADMIN-only; inquiry object strips raw submission columns). |
| `POST` | `/api/v1/staff/access-inquiries/:inquiryId/close` | **PENDING** / **IN_REVIEW** → **CLOSED** (deny without granting access). Optional `staffNotes`. |
| `POST` | `/api/v1/staff/access-inquiries/:inquiryId/entitlement-draft` | Non-destructive: creates missing **DRAFT** rows per inquiry asset type; never overwrites existing rows. |
| `POST` | `/api/v1/staff/access-inquiries/:inquiryId/activate-entitlements` | **DRAFT** → **ACTIVE** for all or selected draft rows (`entitlementIds` optional); validates caps on selection; sends consolidated approval email. |
| `PATCH` | `/api/v1/staff/subscriber-entitlements/:entitlementId` | **DRAFT** full edit; **ACTIVE** adjust (`allowed_downloads` ≥ 1 and ≥ `downloads_used`, quality, validity). Sends `CUSTOMER_ENTITLEMENT_UPDATED` when caps change on active rows. |
| `POST` | `/api/v1/staff/subscriber-entitlements/:entitlementId/activate` | **DRAFT** → **ACTIVE**; validates positive `allowed_downloads` + quality; sets inquiry **`ACCESS_GRANTED`**; syncs subscriber flags; sends per-entitlement approval email with limits. |
| `POST` | `/api/v1/staff/subscriber-entitlements/:entitlementId/suspend` | **ACTIVE** → **SUSPENDED**. |

Implementation: `apps/api/src/routes/staff/auth/route.ts`, `apps/api/src/routes/staff/access-inquiries/route.ts` + `service.ts` (mounted from `apps/api/src/honoApp.ts`). Same-origin web proxy: `apps/web/src/app/api/staff/[...path]/route.ts` (GET/POST/PATCH).

## Contributor portal (Hono) — catalog + directory

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/contributor/catalog/asset-categories` | Authenticated contributor session; read-only list for event category picker. |
| `GET` | `/api/v1/contributor/contributors` | `PORTAL_ADMIN` contributor accounts only; optional `q`, `limit` for photographer search. |
| `GET` | `/api/v1/contributor/images` | Cursor-paginated images for the signed-in contributor (`limit`, `cursor`). |
| `GET` | `/api/v1/contributor/images/:imageAssetId/preview/:variant` | Contributor session + asset ownership; streams READY `thumb`/`card`/`detail` preview bytes from previews bucket (not limited to `ACTIVE+PUBLIC`). |

Implementation: `apps/api/src/routes/contributor/catalog/route.ts`, `apps/api/src/routes/contributor/contributors/route.ts`, `apps/api/src/routes/contributor/images/route.ts` (mounted from `apps/api/src/honoApp.ts`). Same-origin web BFF: `apps/web/src/app/api/contributor/[...path]/route.ts` (GET/POST/PATCH).

## Contributor portal — direct R2 upload batches (PR-16H)

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/v1/contributor/upload-batches` | Create batch. |
| `GET` | `/api/v1/contributor/upload-batches` | List batches. |
| `GET` | `/api/v1/contributor/upload-batches/:batchId` | Batch detail + items. |
| `POST` | `/api/v1/contributor/upload-batches/:batchId/files` | Registers items and returns presigned PUT instructions. Requires API-side `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_CONTRIBUTOR_STAGING_BUCKET` in `apps/api/.dev.vars` (or legacy `CLOUDFLARE_R2_*` equivalents). Returns **503** `UPLOAD_STORAGE_NOT_CONFIGURED` when missing. |
| `POST` | `/api/v1/contributor/upload-batches/:batchId/files/:itemId/complete` | Verifies staging object; creates `image_assets` row. |
| `POST` | `/api/v1/contributor/upload-batches/:batchId/submit` | Submits batch. |
| `PATCH` | `/api/v1/contributor/upload-batches/:batchId/assets/:imageAssetId/metadata` | Per-asset metadata on OPEN batches (`whoIsInPicture`, `caption`, `keywords`); optional `expectedUpdatedAt` optimistic lock; `409 METADATA_CONFLICT` with snapshot in `error.detail`. |

Implementation: `apps/api/src/routes/contributor/uploads/route.ts` + `service.ts`. Prepare accepts **JPEG only** (`image/jpeg`). Presigning: `apps/api/src/lib/r2-presigned-put.ts`, `apps/api/src/lib/r2-contributor-uploads.ts`. Legacy path alias: `/api/v1/photographer/upload-batches/*` → same handlers.

## Internal admin — contributor upload review (staff BFF)

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/internal/admin/contributor-uploads` | List upload-linked `image_assets` with filters; optional `sort` (`submitted` \| `contributor` \| `event`) + `order` (`asc` \| `desc`); DTO includes `title`, `caption`, `keywords`. |
| `POST` | `/api/v1/internal/admin/contributor-uploads/approve` | Approve + queue publish (existing). |
| `POST` | `/api/v1/internal/admin/contributor-uploads/reject` | Bulk reject eligible `SUBMITTED` rows → `ARCHIVED`. |
| `PATCH` | `/api/v1/internal/admin/contributor-uploads/:imageAssetId` | Metadata patch for eligible submissions; body includes `expectedUpdatedAt` (optimistic lock on `updated_at`); `409 METADATA_CONFLICT` returns current snapshot in `error.detail`. |
| `POST` | `/api/v1/internal/admin/contributor-uploads/:imageAssetId/replace-presign` | Presigned PUT to existing staging key; `503` when S3 presign env incomplete. |
| `POST` | `/api/v1/internal/admin/contributor-uploads/:imageAssetId/replace-complete` | After PUT, verifies staging object; updates file columns on `contributor_upload_items` + `image_assets` without clearing editorial fields; same optimistic lock semantics. |
| `GET` | `/api/v1/internal/admin/contributor-uploads/:imageAssetId/original` | Stream original bytes (staging or canonical by fotokey). |
| `GET` | `/api/v1/internal/admin/contributor-uploads/batches/:batchId` | Batch detail + items. |

Implementation: `apps/api/src/routes/internal/admin-contributor-uploads/route.ts` + `service.ts` + `validators.ts`. Same-origin web BFF: `apps/web/src/app/api/staff/contributor-uploads/*` (approve, reject, `[imageAssetId]/metadata`, `replace-presign`, `replace-complete`).

## Internal admin — staff upload wizard (delegated contributor batches)

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/internal/admin/staff-upload-wizard/contributors` | Active photographers for staff picker (`q`, `limit`). |
| `GET` | `/api/v1/internal/admin/staff-upload-wizard/asset-categories` | Same category list as contributor catalog. |
| `POST` | `/api/v1/internal/admin/staff-upload-wizard/events` | Create `photo_events` row as staff delegate (`targetContributorId`, `eventDate` required). |
| `POST` | `/api/v1/internal/admin/staff-upload-wizard/upload-batches` | Create `contributor_upload_batches` for `targetContributorId` + primary active `contributor_accounts` row. |
| `GET` | `/api/v1/internal/admin/staff-upload-wizard/upload-batches/:batchId` | Load open-batch detail for staff upload wizard resume (batch, event, contributor, items + metadata). |
| `POST` | `/api/v1/internal/admin/staff-upload-wizard/upload-batches/:batchId/files` | Prepare JPEG uploads (same as contributor prepare). |
| `POST` | `/api/v1/internal/admin/staff-upload-wizard/upload-batches/:batchId/files/:itemId/complete` | Complete item. |
| `POST` | `/api/v1/internal/admin/staff-upload-wizard/upload-batches/:batchId/submit` | Submit batch. |
| `PATCH` | `/api/v1/internal/admin/staff-upload-wizard/upload-batches/:batchId/assets/:imageAssetId/metadata` | Metadata patch on open batch. |

Implementation: `apps/api/src/routes/internal/admin-staff-upload-wizard/route.ts` + `service.ts` + `validators.ts`; reuses `staffDelegate*` helpers in `contributor/uploads/service.ts`. Web BFF: `apps/web/src/app/api/staff/upload-wizard/*` (staff session + same roles as contributor upload review).
