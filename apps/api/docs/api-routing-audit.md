# API Routing Audit

## Related documentation

- [DB revamp docs (README)](../../docs/db-revamp/README.md) — catalog/photographer DB revamp entry point, runbooks, and historical PR reports under `reports/`.
- [Media pipeline operations (temporary)](../../docs/db-revamp/media-pipeline-operations.md) — one-time derivative migration status and generation commands.

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
| `GET` | `/api/v1/assets` | `publicAssetListRoute` | `apps/api/src/routes/publicAssets.ts` | DB-backed public catalog list. PR-16I: JSON `fotokey` = `image_assets.fotokey`; `category` = asset category else event default; `categoryId` query matches asset or (null asset + event) category. |
| `GET` | `/api/v1/assets/filters` | `publicAssetFiltersRoute` | `apps/api/src/routes/publicAssets.ts` | DB-backed filters. PR-16I: category counts use resolved category `coalesce(asset, event)`. |
| `GET` | `/api/v1/assets/collections` | `publicAssetCollectionsRoute` | `apps/api/src/routes/publicAssets.ts` | DB-backed collections. PR-16I: same resolved category for grouping/preview pick. |
| `GET` | `/api/v1/assets/:id` | `publicAssetDetailRoute` | `apps/api/src/routes/publicAssets.ts` | DB-backed public asset detail. PR-16I: same `fotokey` + category rules as list. |

### Public Media Routes

| Method | Path | Handler | Source file | Notes |
|---|---|---|---|---|
| `GET` | `/api/v1/media/assets/:assetId/preview` | `securePreviewMediaRoute` | `apps/api/src/routes/secureMedia.ts` | Token-verified watermarked preview route. |

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
| `GET` | `/api/v1/internal/admin/filters` | `internalAdminFiltersRoute` | `apps/api/src/routes/internalAdminCatalog.ts` | No explicit method guard in `index.ts`; handler enforces auth. |
| `GET` | `/api/v1/internal/admin/users` | `internalAdminUsersRoute` | `apps/api/src/routes/internalAdminCatalog.ts` | Explicit method guard in `index.ts`. |
| `PATCH` | `/api/v1/internal/admin/users/:authUserId/subscription` | `internalAdminUserSubscriptionRoute` | `apps/api/src/routes/internalAdminCatalog.ts` | Explicit method guard in `index.ts`. |

### Internal Account Routes

| Method | Path | Handler | Source file | Notes |
|---|---|---|---|---|
| `GET`,`POST` | `/api/v1/internal/fotobox/items` | `internalFotoboxItemsRoute` | `apps/api/src/routes/internalAccount.ts` | Method dispatch inside handler. |
| `DELETE` | `/api/v1/internal/fotobox/items/:assetId` | `internalFotoboxItemRoute` | `apps/api/src/routes/internalAccount.ts` | UUID route param validated in handler. |
| `GET` | `/api/v1/internal/downloads/history` | `internalDownloadHistoryRoute` | `apps/api/src/routes/internalAccount.ts` | Auth + pagination/filter route. |

### Internal Download Routes

| Method | Path | Handler | Source file | Notes |
|---|---|---|---|---|
| `POST` | `/api/v1/internal/assets/:assetId/download` | `internalSubscriberAssetDownloadRoute` | `apps/api/src/routes/internalDownloads.ts` | Internal secret required; UUID validation + subscriber/quota logic. |

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
| `GET` | `/api/v1/staff/access-inquiries` | Staff session; roles `SUPER_ADMIN`, `SUPPORT`, `FINANCE`. |
| `GET` | `/api/v1/staff/access-inquiries/:inquiryId` | Detail + `subscriberAccess` + linked entitlement rows. |
| `POST` | `/api/v1/staff/access-inquiries/:inquiryId/entitlement-draft` | Non-destructive: creates missing **DRAFT** rows per inquiry asset type; never overwrites existing rows. |
| `PATCH` | `/api/v1/staff/subscriber-entitlements/:entitlementId` | **DRAFT** full edit; **ACTIVE** adjust (`allowed_downloads` ≥ 1 and ≥ `downloads_used`, quality, validity). |
| `POST` | `/api/v1/staff/subscriber-entitlements/:entitlementId/activate` | **DRAFT** → **ACTIVE**; validates positive `allowed_downloads` + quality; sets inquiry **`ACCESS_GRANTED`**; syncs `app_user_profiles` subscriber flags. |
| `POST` | `/api/v1/staff/subscriber-entitlements/:entitlementId/suspend` | **ACTIVE** → **SUSPENDED**. |

Implementation: `apps/api/src/routes/staff/auth/route.ts`, `apps/api/src/routes/staff/access-inquiries/route.ts` + `service.ts` (mounted from `apps/api/src/honoApp.ts`). Same-origin web proxy: `apps/web/src/app/api/staff/[...path]/route.ts` (GET/POST/PATCH).

## Contributor portal (Hono) — catalog + directory

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/v1/contributor/catalog/asset-categories` | Authenticated contributor session; read-only list for event category picker. |
| `GET` | `/api/v1/contributor/contributors` | `PORTAL_ADMIN` contributor accounts only; optional `q`, `limit` for photographer search. |

Implementation: `apps/api/src/routes/contributor/catalog/route.ts`, `apps/api/src/routes/contributor/contributors/route.ts` (mounted from `apps/api/src/honoApp.ts`). Same-origin web BFF: `apps/web/src/app/api/contributor/[...path]/route.ts` (GET/POST/PATCH).

## Contributor portal — direct R2 upload batches (PR-16H)

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/v1/contributor/upload-batches` | Create batch. |
| `GET` | `/api/v1/contributor/upload-batches` | List batches. |
| `GET` | `/api/v1/contributor/upload-batches/:batchId` | Batch detail + items. |
| `POST` | `/api/v1/contributor/upload-batches/:batchId/files` | Registers items and returns presigned PUT instructions. Requires API-side `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_CONTRIBUTOR_STAGING_BUCKET` in `apps/api/.dev.vars` (or legacy `CLOUDFLARE_R2_*` equivalents). Returns **503** `UPLOAD_STORAGE_NOT_CONFIGURED` when missing. |
| `POST` | `/api/v1/contributor/upload-batches/:batchId/files/:itemId/complete` | Verifies staging object; creates `image_assets` row. |
| `POST` | `/api/v1/contributor/upload-batches/:batchId/submit` | Submits batch. |

Implementation: `apps/api/src/routes/contributor/uploads/route.ts` + `service.ts`. Presigning: `apps/api/src/lib/r2-presigned-put.ts`, `apps/api/src/lib/r2-contributor-uploads.ts`. Legacy path alias: `/api/v1/photographer/upload-batches/*` → same handlers.

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
