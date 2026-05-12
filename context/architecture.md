# Fotocorp Architecture Context

## Stack Table

| Layer | Technology | Role |
| --- | --- | --- |
| Monorepo | pnpm workspace | Top-level workspace with `apps/*` and `packages/*`. |
| Web app | Next.js, React, TypeScript in `apps/web` | Public site, account pages, admin UI, same-origin BFF routes, auth UI, and session-aware route guards. |
| API app | Cloudflare Worker in `apps/api` | Catalog DB logic, media delivery, R2 access, Better Auth route handling, migrations, import scripts, internal APIs, and entitlement checks. |
| Jobs CLI | Node.js package in `apps/jobs` | Background image publish worker (Sharp, R2, DB). **Not** a Cloudflare Worker; no `fetch` entry. Invoked via `tsx` CLI scripts. **PR-16E:** deployable as a **private Docker** service on a VPS (see `docker-compose.jobs.yml`, `apps/jobs/Dockerfile`, and [`jobs-direct-vps-deployment-runbook.md`](../docs/db-revamp/jobs-direct-vps-deployment-runbook.md)); no inbound HTTP port. **PR-16F:** Neon polling + `FOR UPDATE SKIP LOCKED` job claim via native `pg`. **PR-16G:** with `IMAGE_PUBLISH_PROCESSING_ENABLED=true` (default **`false`**), the worker runs real contributor IMAGE publish: R2 originals + staging fallback, Sharp watermarked WebP previews (`previews/watermarked/...`), upserts `image_derivatives`, then sets `image_assets` to `ACTIVE+PUBLIC` only after success. Failures keep assets `APPROVED+PRIVATE`. The API CLI `pnpm --dir apps/api media:process-image-publish-jobs` remains for operator backfill. |
| API router | Hono | All API route groups are mounted in `apps/api/src/honoApp.ts`; legacy/fixture routes are isolated in their own Hono module. |
| Database | Neon Postgres | Catalog, legacy metadata, app profile, entitlement, Fotobox, download, derivative, and audit persistence. |
| ORM/migrations | Drizzle ORM and drizzle-kit | Schema definitions and reproducible migrations. |
| Object storage | Cloudflare R2 | Canonical originals and generated preview derivatives. |
| Auth | Better Auth through Hono in `apps/api` | Email/password plus username auth mounted at `/api/auth/*`; `apps/web` keeps same-origin proxy/session helpers for browser and page guards. |
| Media processing | Sharp (Node-capable contexts) | Derivative generation uses native Sharp in Node-capable scripts. **`apps/jobs`** runs the production VPS publish worker (PR-16G). **`apps/api`** still ships the backfill CLI `pnpm --dir apps/api media:process-image-publish-jobs` with the same derivative profiles. Do not import native Sharp into the Worker runtime. |
| UI | Tailwind CSS v4, local component primitives | Public catalog UI, admin surfaces, account pages, and shared components. |

## Documentation structure

- [DB revamp README](../docs/db-revamp/README.md) is the entry point.
- Current operating docs live at the top level under [`docs/db-revamp/`](../docs/db-revamp/).
- Historical PR reports live under [`docs/db-revamp/reports/`](../docs/db-revamp/reports/).
- Future PRs should add or update one current doc where relevant and place detailed implementation reports under `reports/`.

## System Boundaries

- `apps/web` owns user-facing UI, admin UI, account pages, auth UI, session-aware route guards, and same-origin web/BFF routes.
- `apps/web/src/app/api` owns browser-safe same-origin routes. These routes may call internal API routes server-side after authenticating the current user.
- `apps/web/src/app/api/auth/[...all]` is a browser same-origin proxy to the API-owned Hono Better Auth handler. It does not define OAuth providers or own auth business logic.
- `apps/web/src/lib/api` owns public API helpers and compatibility wrappers used by existing pages/routes.
- `apps/web/src/lib/server/internal-api` owns privileged server-only web-to-api calls. It centralizes `INTERNAL_API_BASE_URL`, `INTERNAL_API_SECRET`, internal route builders, JSON fetch, stream fetch, error parsing, and safe diagnostics.
- `apps/api` owns catalog/media/admin/download business logic, Better Auth route handling, R2 access, Drizzle schema/migrations, legacy import scripts, and internal APIs.
- `apps/api/src/honoApp.ts` is the composed Hono app. It handles `/health`, `/api/auth/*`, subscriber download preflight/streaming, internal account Fotobox/download-history routes, internal admin routes, public catalog routes, the public media preview route, and isolated legacy/fixture routes.
- `apps/api/src/index.ts` is now a thin Worker entry point that delegates every request to `honoApp.fetch`.
- `apps/api/src/routes/hono/legacyFixtureRoutes.ts` isolates old fixture/provisional routes from real `/api/v1` route groups.
- `apps/api/src/routes` contains route handlers for public catalog, public media, internal account, internal admin, internal downloads, legacy assets/search/admin, and health.
- `apps/api/src/db/schema` owns Drizzle schema definitions for catalog, legacy metadata, app users, auth tables, derivatives, Fotobox, downloads, uploads, and audit.
- `apps/jobs` is a **Node.js** worker package (Sharp; PR-16F/16G publish pipeline). It is **Dockerized for private VPS deployment** (no published ports, no browser access). **`apps/web` must never call `apps/jobs` directly**; staff flows use **`apps/api`** to persist work in Neon, and the worker consumes that work outbound-only (Neon, R2). The safety flag `IMAGE_PUBLISH_PROCESSING_ENABLED` (default `false`) gates claiming and processing. With `true`, the worker claims queued `image_publish_jobs`, processes contributor IMAGE items (`ImagePublishProcessor`), and reconciles job status from per-item outcomes. **`apps/api`** CLI `media:process-image-publish-jobs` remains for operator backfill.
- R2 originals bucket binding stores clean canonical originals. Treat the binding name as an internal server concern.
- R2 previews bucket binding stores generated watermarked preview derivatives. Treat the binding name as an internal server concern.
- Neon DB stores metadata, auth/app profile state, catalog state, import/reconciliation state, derivative metadata, Fotobox records, download logs, and audit records.
- Photographer normalization uses a clean `photographers` table keyed by numeric `legacy_photographer_id`, while existing `photographer_profiles` rows remain in place for legacy/import compatibility during the DB revamp.
- Image/event runtime reads use clean `image_assets` and `photo_events` tables with preserved UUIDs from `assets` and `asset_events`.
- Derivative runtime reads use clean `image_derivatives` rows with preserved UUIDs from `asset_media_derivatives`, provider-neutral `storage_key`, and uppercase variant names.
- Media access and subscriber download runtime writes use clean `image_access_logs` and `image_download_logs`; old log tables remain only for legacy/import compatibility and audit comparison.
- Internal admin catalog runtime reads and writes use clean image tables. Admin route URLs still say `/assets` for API compatibility, but the implementation operates on `image_assets`, `photo_events`, `photographers`, and `image_derivatives`.
- Legacy CSV/import scripts continue to write **old** catalog tables (`photographer_profiles`, `asset_events`, `assets`, `asset_media_derivatives`). After each import (or chunk run), operators must run `pnpm --dir apps/api legacy:sync-clean-schema` so clean tables match old tables; the chunked import runner invokes this automatically on successful completion unless `--no-sync-clean-schema` is set. See [`docs/db-revamp/reports/clean-schema-import-sync-report.md`](../docs/db-revamp/reports/clean-schema-import-sync-report.md).
- Photographer portal credentials live in `photographer_accounts` (username + Worker-compatible `$scrypt$` hash, isolated from Better Auth `user` / `account` tables). Photographer sessions live in `photographer_sessions`, use the `fc_ph_session` cookie, and store only SHA-256 token hashes. The first portal UI lives under `/photographer/*` in `apps/web` and proxies browser calls through same-origin `/api/photographer/*` routes to the API-owned `/api/v1/photographer/*` endpoints. See [`docs/db-revamp/reports/photographer-accounts-report.md`](../docs/db-revamp/reports/photographer-accounts-report.md), [`docs/db-revamp/reports/photographer-auth-boundary-report.md`](../docs/db-revamp/reports/photographer-auth-boundary-report.md), [`docs/db-revamp/reports/photographer-portal-ui-report.md`](../docs/db-revamp/reports/photographer-portal-ui-report.md), [`docs/db-revamp/reports/photographer-analytics-report.md`](../docs/db-revamp/reports/photographer-analytics-report.md), and [`docs/db-revamp/reports/photographer-events-report.md`](../docs/db-revamp/reports/photographer-events-report.md).

## Current API Architecture

- Hono is installed in `apps/api` and owns all route groups.
- `apps/api/src/index.ts` exports a thin Worker `fetch` handler that delegates to `honoApp.fetch`.
- Better Auth is mounted through `apps/api/src/routes/hono/authRoutes.ts` at `/api/auth/*`. The enabled methods are email/password signup/sign-in and username sign-in; OAuth/social providers are not enabled.
- PR-19 introduced a Hono shell for:
  - `GET /health`
  - `POST /api/v1/internal/assets/:assetId/download/check`
  - `POST /api/v1/internal/assets/:assetId/download`
- PR-22 migrated internal account routes to Hono-native route declarations:
  - `GET /api/v1/internal/fotobox/items`
  - `POST /api/v1/internal/fotobox/items`
  - `DELETE /api/v1/internal/fotobox/items/:assetId`
  - `GET /api/v1/internal/downloads/history`
- PR-23 migrated internal admin routes to Hono-native route declarations under `/api/v1/internal/admin/*`.
- PR-24 migrated public catalog routes to Hono-native route declarations:
  - `GET /api/v1/assets`
  - `GET /api/v1/assets/filters`
  - `GET /api/v1/assets/collections`
  - `GET /api/v1/assets/:assetId`
- PR-25 migrated the public media preview route to Hono:
  - `GET /api/v1/media/assets/:assetId/preview`
- PR-26 isolated legacy/fixture routes in `apps/api/src/routes/hono/legacyFixtureRoutes.ts` and removed manual routing from `apps/api/src/index.ts`.
- PR-27 added repeatable runtime smoke documentation and an in-process Hono route smoke harness at `apps/api/scripts/smoke/check-hono-routes.ts`.
- Legacy fixture routes still coexist with DB-backed `/api/v1` routes, but they are clearly separated from production route modules.
- Do not treat legacy/fixture routes as production catalog contracts. Delete, disable, or redirect them only in a scoped follow-up after usage is verified.

## Target API Architecture

- Backend target architecture details are defined in `context/backend-reference-architecture.md`.
- `apps/api/src/index.ts` delegates to the composed Hono app and should stay thin.
- Hono route modules should be grouped by:
  - public catalog routes
  - public media routes
  - internal account routes
  - internal admin routes
  - internal downloads routes
  - auth routes
  - legacy/fixture routes during their isolation or removal window
- Internal API authentication should be centralized, consistently applied, and easy to audit.
- Method guards should be consistent at the route definition level.
- Route parameters and request bodies should be validated near route entry.
- Request context middleware should provide request id and request-scoped context for JSON APIs.
- Web internal API access is centralized behind `apps/web/src/lib/server/internal-api`, a server-only route builder/client that handles:
  - `INTERNAL_API_BASE_URL`
  - `INTERNAL_API_SECRET`
  - internal route construction
  - JSON error parsing
  - stream/attachment forwarding
  - safe diagnostics
- Privileged internal clients must not fall back to public API base URLs. Reintroducing `NEXT_PUBLIC_API_BASE_URL` as a privileged fallback is architectural drift.
- Existing compatibility helpers in `apps/web/src/lib/api` may delegate to the server-only internal client so older imports remain stable.

## Storage Model

- Clean originals live in the canonical originals R2 bucket (`fotocorp-2026-megafinal`, binding `MEDIA_ORIGINALS_BUCKET`) behind the API boundary. This bucket holds canonical Fotokey-named originals only (`FCddmmyyNNN.<jpg|png|webp>` at the bucket root).
- Watermarked preview derivatives live in the previews R2 bucket (`fotocorp-2026-previews`, binding `MEDIA_PREVIEWS_BUCKET`) behind the API boundary, under `previews/watermarked/<thumb|card|detail>/<fotokey>.webp`.
- Photographer pre-approval uploads live in a separate staging R2 bucket (`fotocorp-2026-contributor-uploads`, binding `MEDIA_CONTRIBUTOR_UPLOADS_BUCKET`) under `staging/<photographer_id>/<event_id>/<batch_id>/<upload_item_id>.<ext>`. Staging keys are opaque, are never exposed to the browser, and are never written to the canonical originals bucket. The original filename uploaded by the photographer is metadata only.
- The browser must never receive direct R2 URLs, bucket names, R2 object keys, private storage paths, signed storage URLs, or internal secrets.
- Public previews must be served from controlled API preview routes and must use watermarked derivatives only.
- Clean originals may be streamed only through subscriber/admin controlled server-side tunnels after auth, entitlement, quota, asset, and source checks. The admin photographer-uploads original viewer streams from the staging bucket before approval and from the canonical originals bucket after Fotokey assignment.
- Derivative metadata tracks clean variants `THUMB`, `CARD`, and `DETAIL`, generation readiness, watermark state, dimensions, and R2 storage keys.
- R2 object keys are implementation details. Display business identifiers such as Fotokey/ImageCode where relevant instead of storage identifiers.

### Fotokey + Photographer Publish Pipeline (PR-15.1)

- Fotokey format: `FC` + `DD` + `MM` + `YY` + sequence (`FC010126001`). Sequence is padded to a minimum of 3 digits but may grow beyond 999 (`FC0101261000`).
- Fotokey is generated **only when an admin approves** an upload, never at upload/submit time. Admin approval order (the `imageAssetIds` request array order) decides Fotokey sequence. Sequence allocation uses `fotokey_daily_counters` with a transactional row lock per business date (`Asia/Kolkata`).
- On approval the asset transitions: `SUBMITTED + PRIVATE + fotokey=null` → `APPROVED + PRIVATE + fotokey=FCddmmyyNNN`; the original is **copied** (not moved) from the staging bucket to the canonical originals bucket as `FCddmmyyNNN.<ext>` (`jpeg` normalized to `jpg`); `original_storage_key` and `original_filename` are rewritten to the canonical Fotokey-based name; `image_publish_jobs` and `image_publish_job_items` rows are inserted to queue derivative generation.
- The asset only becomes `ACTIVE + PUBLIC` once all required derivatives (`THUMB`, `CARD`, `DETAIL`) are `READY` in `image_derivatives`. If derivative generation fails, the asset stays `APPROVED + PRIVATE` and the job item is `FAILED` with `failure_code` / `failure_message` set.
- Fotokey, once assigned, is permanent: hard delete is blocked at the code level once `image_assets.fotokey` is non-null (helper `apps/api/src/lib/assets/asset-delete-guard.ts`, error `ASSET_HAS_FOTOKEY`). Hide, archive, or replace published assets — do not hard delete.
- See [`docs/db-revamp/reports/fotokey-publish-pipeline-report.md`](../docs/db-revamp/reports/fotokey-publish-pipeline-report.md) for full lifecycle, schema, R2 promotion, processor CLI, and validation/smoke coverage.

## Auth and Access Model

- Better Auth route handling lives in `apps/api` under `/api/auth/*` and is mounted through Hono.
- Authentication is email/password plus username only. Google OAuth, other OAuth/social providers, magic links, anonymous auth, passkeys, and Google One Tap are not enabled.
- Usernames are required at signup, normalized to lowercase, limited to 3-30 characters, restricted to letters, numbers, underscore, and dot, and protected from reserved names.
- Signup email eligibility is enforced by the API business-email validation service. The public `/api/v1/auth/business-email/validate` route is UX-only; the Better Auth `/sign-up/email` before hook is the final lock.
- Business-email validation uses exact email allowlists, email/domain overrides, free/disposable domain blocks, DNS-over-HTTPS MX checks, and cached domain verdicts.
- Fotocorp registration metadata lives outside Better Auth core tables in `fotocorp_user_profiles`. Better Auth owns credentials, sessions, and username identity; product profile fields are validated during `/sign-up/email` and inserted after successful Better Auth user creation.
- Current authenticated registration profile reads are exposed through Hono at `GET /api/v1/auth/me`.
- `apps/web` keeps a matching Better Auth server helper for session reads and protected page guards, plus a same-origin `/api/auth/*` proxy to the API Worker for browser auth requests.
- `apps/web` also keeps the photographer portal separate from Better Auth through `/api/photographer/*` proxy routes, server-side `/me` guards, and UI routes for `/photographer/login`, `/photographer/change-password`, `/photographer/dashboard`, `/photographer/images`, `/photographer/events` (list, create, edit), and `/photographer/uploads` (batch list, new bulk upload with presigned R2 PUT + submit, batch detail), including dashboard analytics fed by `GET /api/v1/photographer/analytics/summary`.
- App user profile state lives in `app_user_profiles`.
- App roles are `USER`, `PHOTOGRAPHER`, `ADMIN`, and `SUPER_ADMIN`.
- Subscriber is an entitlement/profile state, not a role. Use `is_subscriber`, `subscription_status`, plan fields, dates, and quota fields for download access.
- Internal dashboard and privileged catalog tooling in `apps/web` under **`/staff/*`** require a **staff session** (`fotocorp_staff_session` cookie), backed by `staff_accounts` / `staff_sessions` in Neon. Better Auth `ADMIN` / `SUPER_ADMIN` app roles **do not** grant access to staff routes or staff-only BFF routes; staff credentials are pre-created and independent of Better Auth. Legacy browser URLs under `/admin/*` were removed; reserved namespace ends in **404** (`app/admin/[[...path]]`).
- Staff auth API (Hono): `POST /api/v1/staff/auth/login`, `POST /api/v1/staff/auth/logout`, `GET /api/v1/staff/auth/me` (`apps/api/src/routes/staff/auth/route.ts`). Staff audit foundation: `staff_audit_logs` (e.g. `STAFF_LOGIN_SUCCESS`, `STAFF_LOGIN_FAILED`, `STAFF_LOGOUT`). Bootstrap: `pnpm --dir apps/api staff:bootstrap` with `STAFF_BOOTSTRAP_*` vars documented in `apps/api/.dev.vars.example`.
- Main-app legacy `ADMIN` / `SUPER_ADMIN` roles may still exist in `app_user_profiles` for data/audit compatibility, but they are not used to gate the internal dashboard UI.
- Main-app photographer roles remain part of the Better Auth/app-user model, but the dedicated contributor portal uses separate `contributor_accounts` and `contributor_sessions`; these sessions do not grant staff or subscriber access.
- Account routes require an authenticated user and an active profile.
- Clean downloads require active subscriber entitlement, available quota, downloadable asset state, and available original source object.
- Internal API routes require the internal API secret in server-side calls. Browser components must never call them directly.

## Database Ownership

- `apps/api` owns catalog, media, admin, download, Fotobox, audit, legacy import, and migration schema.
- Better Auth tables are represented in the API schema/migrations because the API Worker owns the `/api/auth/*` route handler.
- Manual DB patches are discouraged. Schema changes should be represented in Drizzle schema and migrations.
- Migrations must be reproducible, reviewable, and safe to run in the expected environment.
- Real DB types must be verified before adding foreign keys or changing references.
- Known type fact: `app_user_profiles.id` is text in the real DB, even though current Drizzle schema has shown UUID in code history. Verify and align before introducing new references.
- Import and reconciliation scripts must preserve legacy source payloads and log safe issue summaries without exposing private object keys in browser-facing surfaces.
- Photographer/profile imports must use numeric legacy IDs for identity joins. Do not join photographers by display name, and do not use `tempphotographer` as a primary mapping source.
- Runtime image/photographer joins use `image_assets.photographer_id -> photographers.id`; old `assets.photographer_profile_id -> photographer_profiles.id` remains for legacy/import compatibility.
- Runtime derivative and download-log joins use `image_assets.id`, preserving old `assets.id` UUIDs so old/new comparison remains direct without an asset mapping table.
- `image_assets.legacy_image_code` is intentionally not unique until known duplicate legacy image-code import issues are resolved.
- `image_derivatives.image_asset_id` points to `image_assets.id`, and public media preview routes resolve uppercase clean variants at the service boundary.
- Clean image log tables use nullable foreign keys with `on delete set null` so audit/history records survive future image or derivative cleanup.
- Legacy import scripts may still write old tables until a dedicated clean import/sync PR.

## Current Route Groups

- Health: `GET /health` through Hono.
- Auth: `/api/auth/*` through Hono-native Better Auth route handling.
- Auth profile: `GET /api/v1/auth/me` through Hono-native route handling.
- Auth validation: `POST /api/v1/auth/business-email/validate` through Hono-native route handling.
- Staff auth: `POST /api/v1/staff/auth/login`, `POST /api/v1/staff/auth/logout`, `GET /api/v1/staff/auth/me` through Hono-native route handling (`apps/api/src/routes/staff/auth/route.ts`). Uses HttpOnly cookie `fotocorp_staff_session` (hashed session rows in `staff_sessions`).
- Photographer auth: `POST /api/v1/photographer/auth/login`, `POST /api/v1/photographer/auth/logout`, `GET /api/v1/photographer/auth/me`, and `POST /api/v1/photographer/auth/change-password` through Hono-native route handling. These routes read only `fc_ph_session` and operate on `photographer_accounts` / `photographer_sessions`.
- Photographer images: `GET /api/v1/photographer/images` through Hono-native route handling, scoped to `image_assets.photographer_id = current photographer id`.
- Photographer analytics: `GET /api/v1/photographer/analytics/summary` through Hono-native route handling, scoped to the current photographer session; aggregates uploads, submission vs live counts, completed-download metrics, top downloaded images, and recent uploads without exposing subscriber identities or storage internals.
- Photographer events: `GET/POST /api/v1/photographer/events`, `GET/PATCH /api/v1/photographer/events/:eventId` through Hono-native route handling; creates and updates `photo_events` directly with provenance columns (`created_by_source`, photographer/account FKs). List scopes `mine` vs `available` (`ACTIVE` events for upload selection); photographers edit only events they created. See [`docs/db-revamp/reports/photographer-events-report.md`](../docs/db-revamp/reports/photographer-events-report.md).
- Photographer bulk uploads (backend): `POST/GET /api/v1/photographer/upload-batches`, `GET /api/v1/photographer/upload-batches/:batchId`, `POST .../files`, `POST .../files/:itemId/complete`, `POST .../submit` through Hono-native route handling. Uses `photographer_upload_batches` and `photographer_upload_items`; **originals are staged in the photographer staging bucket** under `staging/<photographer_id>/<event_id>/<batch_id>/<upload_item_id>.<ext>` (binding `MEDIA_CONTRIBUTOR_UPLOADS_BUCKET`, `CLOUDFLARE_R2_CONTRIBUTOR_UPLOADS_BUCKET`); presigned PUT URLs target this staging bucket via `createPhotographerStagingPresignedPutUrl`; `complete` verifies the staging object with `MEDIA_CONTRIBUTOR_UPLOADS_BUCKET.head` when the Worker binding exists, otherwise with S3 `HeadObject` using `CLOUDFLARE_R2_*` + `CLOUDFLARE_R2_CONTRIBUTOR_UPLOADS_BUCKET`. New rows in `image_assets` are SUBMITTED + PRIVATE + **`FOTOCORP`** with `fotokey = NULL`. Photographer upload **origin** is tracked via upload batch/item rows (and `photographer_id`), not via `image_assets.source`. Pre-approval uploads must never be written to the canonical originals bucket. R2 bucket **CORS** for browser `PUT` is documented in [`docs/db-revamp/reports/photographer-bulk-upload-backend-report.md`](../docs/db-revamp/reports/photographer-bulk-upload-backend-report.md) (dashboard configuration). See that report for env/smoke details.
- Public catalog: `/api/v1/assets`, `/api/v1/assets/filters`, `/api/v1/assets/collections`, `/api/v1/assets/:id` through Hono-native route modules.
- Public media: `/api/v1/media/assets/:assetId/preview` through Hono-native route modules.
- Internal admin: `/api/v1/internal/admin/*` through Hono-native route modules. Admin catalog handlers use clean image schema for catalog reads, editorial/publish mutations, original tunnels, preview tunnels, stats, and filters.
- Internal admin photographer-upload review + publish queue (PR-15 / PR-15.1): `/api/v1/internal/admin/photographer-uploads`, `/api/v1/internal/admin/photographer-uploads/approve`, `/api/v1/internal/admin/photographer-uploads/:imageAssetId/original` through a Hono-native route module under `apps/api/src/routes/internal/admin-photographer-uploads/*`. List supports `status=SUBMITTED|APPROVED|ACTIVE|all`. Approve enforces the `FOTOCORP + SUBMITTED + PRIVATE + fotokey is null` precondition, allocates Fotokeys in input order via `apps/api/src/lib/fotokey/allocator.ts`, copies the original from the staging bucket to the canonical originals bucket via `apps/api/src/lib/r2-photographer-uploads.ts#copyStagingObjectToOriginals` using `FCddmmyyNNN.<ext>`, sets `image_assets` to `APPROVED + PRIVATE` with the assigned Fotokey + canonical filename, and inserts `image_publish_jobs` + `image_publish_job_items` rows. Approved assets only become `ACTIVE + PUBLIC` after the publish processor (`apps/api/scripts/media/process-image-publish-jobs.ts`) generates `THUMB`/`CARD`/`DETAIL` watermarked WebP derivatives in the previews bucket and upserts `image_derivatives` rows as `READY`. Long-term that processor may move to the Node CLI in `apps/jobs` (native Sharp); PR-16A added the `apps/jobs` skeleton only. The original viewer streams from the staging bucket before approval and from the canonical originals bucket after Fotokey assignment. R2 storage keys, bucket names, signed URLs, and raw R2 errors are never returned. See [`docs/db-revamp/reports/admin-photographer-upload-review-report.md`](../docs/db-revamp/reports/admin-photographer-upload-review-report.md) and [`docs/db-revamp/reports/fotokey-publish-pipeline-report.md`](../docs/db-revamp/reports/fotokey-publish-pipeline-report.md).
- Internal account: `/api/v1/internal/downloads/history` through Hono-native route modules.
- Internal fotobox: `/api/v1/internal/fotobox/*` through `apps/api/src/modules/fotobox`.
- Internal downloads: `/api/v1/internal/assets/:assetId/download` and `/download/check` through Hono route module with shared internal auth middleware and route-entry param validation.
- Legacy/fixture: `/assets`, `/assets/:id`, `/search`, `/admin/assets`, `/admin/ingestion/runs`, and legacy `/media/*` routes through `apps/api/src/routes/hono/legacyFixtureRoutes.ts`. These routes still exist and remain transitional.

Use `apps/api/docs/api-routing-audit.md` for the latest route inventory when refactoring.

## Runtime QA

- Manual server/browser smoke steps live in `apps/api/docs/runtime-smoke-tests.md`.
- The lightweight Hono route harness can be run with `npm --prefix apps/api run smoke:hono-routes`.
- The harness verifies route ownership basics without real secrets: health, public wrong-method handling, public media wrong-method handling, internal auth rejection, internal wrong-method handling with a fake local secret, legacy disabled media routes, legacy fixture `/assets`, unknown route handling, and response-body leak patterns.
- The harness is not a substitute for full runtime QA against Wrangler, Neon, R2, Better Auth, or browser sessions.
- Subscriber download E2E remains verified when attachment download, quota increment, and `image_download_logs` lifecycle (`STARTED` then `COMPLETED` on successful response preparation) are confirmed in a live runtime; see [`docs/db-revamp/reports/download-completion-logging-report.md`](../docs/db-revamp/reports/download-completion-logging-report.md).

## Invariants

1. Browser-visible output must never include R2 object keys, bucket names, direct R2 URLs, signed storage URLs, internal API secrets, or private storage paths.
2. Browser/client components must never call `/api/v1/internal/...` directly.
3. Public catalog routes return only approved, public, image assets with ready watermarked previews.
4. Clean original downloads must revalidate auth, subscription, quota, asset eligibility, and source availability server-side.
5. Preview access must use watermarked derivatives only.
6. Fotokey/ImageCode must be preserved and never casually replaced by internal UUIDs in business-facing contexts.
7. Internal privileged web calls must use `INTERNAL_API_BASE_URL`; do not fall back to public API base URLs.
8. Hono migration must be incremental, route group by route group.
9. Do not rename or move legacy originals unless mapping safety is proven.
10. API route changes must update architecture context and route audit docs.
11. Better Auth route handling belongs to the API Worker; web auth endpoints should stay same-origin proxies/session helpers rather than new auth business logic.
12. Subscriber access is entitlement-driven, not role-driven.
13. Fixture/legacy routes must be marked as fixture/legacy and must not be treated as production catalog behavior.
14. Photographer normalization must use numeric legacy IDs only; name matching is forbidden for canonical photographer joins.
15. DB revamp table migrations must preserve existing UUIDs where possible and keep legacy payloads as archive/audit data rather than the main app dependency.
16. Derivative route switching must be separated from derivative table creation/backfill so media delivery behavior remains stable during schema-only PRs.
17. Clean log tables are the runtime write target for media access and subscriber downloads; old log tables should not receive new runtime writes.
18. Photographer pre-approval uploads must live in the photographer staging bucket only. The canonical originals bucket holds Fotokey-named originals only.
19. Fotokey is assigned only on admin approval; admin approval order decides Fotokey sequence; once assigned, Fotokey is permanent and the asset must not be hard-deleted (use hide/archive/replace).
20. Approved photographer-upload assets are not public until all required derivatives (`THUMB`, `CARD`, `DETAIL`) are `READY` in `image_derivatives`.

## Subscriber Download UX Pattern

- Browser download controls first call the same-origin JSON preflight route `POST /api/assets/:assetId/download/check`.
- The web preflight route authenticates the current session/profile, then calls Hono `POST /api/v1/internal/assets/:assetId/download/check` through the server-only internal API client.
- Internal preflight validates the internal secret, asset id, request body, subscription, quota, asset eligibility, and source availability. It must not increment quota, write `STARTED` logs, or stream a file.
- If preflight fails, the client shows an inline user-safe error without a full page refresh.
- If preflight succeeds, the client starts the actual same-origin attachment route with a hidden iframe. The attachment route revalidates server-side, increments quota, writes `image_download_logs` (`STARTED` then `COMPLETED` when the downloadable response is ready). `COMPLETED` reflects server-side success, not client-side save completion.
