# Fotocorp Architecture Context

## Stack Table

| Layer | Technology | Role |
| --- | --- | --- |
| Monorepo | pnpm workspace | Top-level workspace with `apps/*` and `packages/*`. |
| Web app | Next.js, React, TypeScript in `apps/web` | Public site, account pages, admin UI, same-origin BFF routes, auth UI, and session-aware route guards. |
| API app | Cloudflare Worker in `apps/api` | Catalog DB logic, media delivery, R2 access, Better Auth route handling, migrations, import scripts, internal APIs, and entitlement checks. |
| Jobs CLI | Node.js package in `apps/jobs` | Background image publish processor (Sharp, R2, DB). **Not** a Cloudflare Worker; no `fetch` entry. **Production:** one-shot **`publish:drain`** via Docker (`docker-compose.jobs.yml`; no idle Neon polling). **Dev:** optional continuous **`publish:worker`** (`dev-worker` profile). Deployed as a **private Docker** image on a VPS ([`media-pipeline-operations.md`](../docs/db-revamp/media-pipeline-operations.md)). **`publish:wake`** exposes `POST /internal/publish/drain` on host loopback (`127.0.0.1:18765`) for Cloudflare Tunnel → API approve webhook (PR-3). **PR-16F:** `FOR UPDATE SKIP LOCKED` job claim via native `pg`. **PR-16G:** with `IMAGE_PUBLISH_PROCESSING_ENABLED=true` (default **`false`**), real contributor IMAGE publish: R2 + Sharp previews, `image_derivatives`, then `ACTIVE+PUBLIC`. Failures keep `APPROVED+PRIVATE`. API CLI `media:process-image-publish-jobs` remains for backfill. |
| API router | Hono | All API route groups are mounted in `apps/api/src/honoApp.ts`; legacy/fixture routes are isolated in their own Hono module. |
| Database | Neon Postgres | Catalog, legacy metadata, app profile, entitlement, Fotobox, download, derivative, and audit persistence. API Worker Hyperdrive foundation uses request-scoped `pg`/`drizzle-orm/node-postgres`: `CORE_HYPERDRIVE` for non-cached core access and `PUBLIC_READ_HYPERDRIVE` for selected cached anonymous public reads; existing Neon serverless helpers remain in place. |
| Public search index | Typesense | Rebuildable public image metadata search/facet/count index. Neon remains the source of truth; Typesense is queried through the API Worker only, never directly by browser code. |
| ORM/migrations | Drizzle ORM and drizzle-kit | Schema definitions and reproducible migrations. |
| Object storage | Cloudflare R2 | Canonical originals and generated preview derivatives. |
| Auth | Better Auth through Hono in `apps/api` | Email/password plus username auth mounted at `/api/auth/*`; `apps/web` keeps same-origin proxy/session helpers for browser and page guards. |
| Transactional email | Resend from `apps/api` | Registration/access request received, approval, and rejection/update emails are sent by the API Worker after successful DB operations. Replies go to Google Workspace at `subscription@fotocorp.com`; Resend inbound receiving is not used. |
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
- `apps/api/src/db/hyperdrive.ts` owns the Hyperdrive-compatible DB factories. `createCoreDb` uses `CORE_HYPERDRIVE.connectionString` with `DATABASE_URL` fallback for non-cached core access. `createPublicReadDb` uses `PUBLIC_READ_HYPERDRIVE.connectionString`, falls back to `CORE_HYPERDRIVE` for local/dev safety, then `DATABASE_URL`. Both create request-scoped `pg.Client` instances and do not replace the existing Neon HTTP or Neon serverless transaction helpers.
- `apps/api/src/honoApp.ts` is the composed Hono app. It handles `/health`, `/api/auth/*`, subscriber download preflight/streaming, internal account Fotobox/download-history routes, internal admin routes, public catalog routes, the public media preview route, and isolated legacy/fixture routes.
- `apps/api/src/index.ts` is now a thin Worker entry point that delegates every request to `honoApp.fetch`.
- `apps/api/src/routes/hono/legacyFixtureRoutes.ts` isolates old fixture/provisional routes from real `/api/v1` route groups.
- `apps/api/src/routes` contains route handlers for public catalog, public media, internal account, internal admin, internal downloads, legacy assets/search/admin, and health.
- `apps/api/src/db/schema` owns Drizzle schema definitions for catalog, legacy metadata, app users, auth tables, derivatives, Fotobox, downloads, uploads, and audit.
- `apps/jobs` is a **Node.js** publish processor (Sharp; PR-16F/16G). **Dockerized for private VPS** (no published ports). **`apps/web` must never call `apps/jobs` directly**; staff approval enqueues `image_publish_jobs` in Neon via **`apps/api`**, then a scheduled or triggered **`publish:drain`** run on the VPS consumes the queue (Neon + R2). No 24/7 DB poll loop in production. `IMAGE_PUBLISH_PROCESSING_ENABLED` (default `false`) gates claiming. **`apps/api`** CLI `media:process-image-publish-jobs` remains for operator backfill.
- R2 originals bucket binding stores clean canonical originals. Treat the binding name as an internal server concern.
- R2 previews bucket binding stores generated watermarked preview derivatives. Treat the binding name as an internal server concern.
- Neon DB stores metadata, auth/app profile state, catalog state, import/reconciliation state, derivative metadata, Fotobox records, download logs, and audit records.
- `email_delivery_logs` stores transactional access-email delivery attempts and provider message ids. Successful access-flow emails are idempotent per related inquiry/template using a partial unique index.
- Typesense stores rebuildable public search documents for fast public search, facets, counts, and page pagination. Current alias: `public_assets_current`; current v2 collection: `public_assets_20260519_v2`. The parallel API route is `GET /api/v1/search/assets`; the existing SQL-backed `/api/v1/assets*` routes remain unchanged. The web `/search` page can cut over to the Typesense BFF path with `NEXT_PUBLIC_USE_TYPESENSE_SEARCH=true`; rollback is the same env flag set to anything else. Production API access uses Cloudflare Tunnel and Cloudflare Access service auth at `https://search.fotocorp.com` because the Worker cannot reach a VPS-local `127.0.0.1` binding. Operational setup is documented in [`typesense-cloudflare-access-runbook.md`](../docs/db-revamp/typesense-cloudflare-access-runbook.md).
- Photographer normalization uses a clean `photographers` table keyed by numeric `legacy_photographer_id`, while existing `photographer_profiles` rows remain in place for legacy/import compatibility during the DB revamp.
- Image/event runtime reads use canonical `image_assets` and `photo_events` tables. Their UUIDs were preserved from the retired legacy `assets` and `asset_events` mirrors during the DB revamp.
- Derivative runtime reads use canonical `image_derivatives` rows with provider-neutral `storage_key` and uppercase variant names.
- Media access and subscriber download runtime writes use canonical `image_access_logs` and `image_download_logs`.
- Internal admin catalog runtime reads and writes use clean image tables. Admin route URLs still say `/assets` for API compatibility, but the implementation operates on `image_assets`, `photo_events`, `contributors`, and `image_derivatives`. Staff catalog filter options are cheap taxonomy reads without global asset-count aggregation on the initial catalog page path.
- Legacy CSV/import mirror tables (`asset_events`, `assets`, `asset_media_derivatives`, `asset_media_access_logs`, `asset_download_logs`, `asset_fotobox_items`, and stale import issue data) have been retired from the production schema. The old `legacy:import`, `legacy:import:chunks`, `legacy:sync-clean-schema`, and `db:validate:clean-sync` package commands are no longer supported for production. See [`docs/db-revamp/legacy-table-retirement-runbook.md`](../docs/db-revamp/legacy-table-retirement-runbook.md).
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
- Preview derivatives (`thumb`, `card`, `detail`) live in the previews R2 bucket (`fotocorp-2026-previews`, binding `MEDIA_PREVIEWS_BUCKET`) behind the API boundary, under `previews/watermarked/<variant>/<fotokey>.webp` for all three. All variants use tiered protected watermarks (`@fotocorp/media-preview`) with `image_derivatives.is_watermarked = true` and profiles `fotocorp_thumb_light_preview_v1`, `fotocorp_card_light_preview_v1`, `fotocorp_detail_preview_v1`. The `watermarked` path prefix is retained for URL stability.
- Photographer pre-approval uploads live in a separate staging R2 bucket (`fotocorp-2026-contributor-uploads`, binding `MEDIA_CONTRIBUTOR_UPLOADS_BUCKET`) under `staging/<photographer_id>/<event_id>/<batch_id>/<upload_item_id>.<ext>`. Staging keys are opaque, are never exposed to the browser, and are never written to the canonical originals bucket. The original filename uploaded by the photographer is metadata only.
- The browser must never receive direct R2 URLs, bucket names, R2 object keys, private storage paths, signed storage URLs, or internal secrets.
- Public previews must be served from controlled API preview routes. **Detail** responses use watermarked bytes; **thumb** and **card** use clean bytes from the same controlled path and key layout.
- Clean originals may be streamed only through subscriber/admin controlled server-side tunnels after auth, entitlement, quota, asset, and source checks. The admin photographer-uploads original viewer streams from the staging bucket before approval and from the canonical originals bucket after Fotokey assignment.
- Staff contributor upload review (`/staff/contributor-uploads`) uses internal `admin/contributor-uploads` routes for list/sort, metadata PATCH (with `updated_at` optimistic concurrency), bulk reject, approve, original streaming, and **replace file** (presigned PUT to the existing staging key, then complete — editorial `title` / `caption` / `keywords` stay on `image_assets`). **Approve** promotes bytes from the contributor staging bucket to the canonical originals bucket: when Worker bindings `MEDIA_CONTRIBUTOR_UPLOADS_BUCKET` and `MEDIA_ORIGINALS_BUCKET` are present, the API uses native R2 `get`/`put`; otherwise it uses S3-compatible CopyObject with `R2_*` (or legacy `CLOUDFLARE_R2_*`) credentials and bucket names. The browser uses same-origin `/api/staff/contributor-uploads/*` BFF routes only; no R2 URLs or keys are exposed in list payloads.
- Derivative metadata tracks variants `THUMB`, `CARD`, and `DETAIL`, generation readiness, watermark state (`is_watermarked`: false for thumb/card, true for detail), expected `watermark_profile` per variant, dimensions, and R2 storage keys.
- R2 object keys are implementation details. Display business identifiers such as Fotokey/ImageCode where relevant instead of storage identifiers.
- **Catalog categories (PR-16I):** `photo_events.category_id` is the event default/suggested category; `image_assets.category_id` is the canonical public category for the asset. Public catalog resolves category for display as **asset category → event category → unavailable**. On staff **approve** and on **publish completion** (`apps/jobs` / API publish CLI), if `image_assets.category_id` is null and the linked event has a category, the asset row is backfilled from `photo_events.category_id` (existing non-null asset category is never overwritten). Public API field **`fotokey`** is always **`image_assets.fotokey`** (canonical `FC…`); `legacy_image_code` is not used as a public business id.

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
- Signup accepts any valid email address (including personal providers). Registration profile validation only checks basic email format and normalizes `companyEmail` / domain for storage.
- Fotocorp registration metadata lives outside Better Auth core tables in `fotocorp_user_profiles`. Better Auth owns credentials, sessions, and username identity; product profile fields are validated during `/sign-up/email` and inserted after successful Better Auth user creation.
- Current authenticated registration profile reads are exposed through Hono at `GET /api/v1/auth/me` (subscriber `owner_type = USER` only).
- Platform session probe for marketing/header: `GET /api/v1/auth/session` returns `{ ownerType, user?, contributor? }` from `fotocorp_session` without profile/inquiry payload. Web BFF `GET /api/auth/get-session` unifies platform + staff cookies into `{ kind: user | contributor | staff, primaryHref, ... }`.
- **Unified sign-in** (`apps/web` `/sign-in`): single email/username + password form (no persona tabs). Login tries `POST /api/v1/auth/login` with `scope=ANY`, then `POST /api/v1/staff/auth/login`. Post-login: contributors → `/contributor/dashboard`; subscribers and staff default → `/` with safe `callbackUrl` rules (`apps/web/src/lib/auth-post-login.ts`). Successful login clears the other cookie family (`fotocorp_session` vs `fotocorp_staff_session`).
- `auth_credentials` enforces global uniqueness on `(identifier_type, lower(login_identifier))` across USER, CONTRIBUTOR, and STAFF — one login string cannot denote multiple owner types.
- `apps/web` keeps server helpers for subscriber guards (`getCurrentAuthUser`), plus a same-origin `/api/auth/*` proxy to the API Worker for browser auth requests.
- `apps/web` also keeps the photographer portal separate from Better Auth through `/api/photographer/*` proxy routes, server-side `/me` guards, and UI routes for `/photographer/login`, `/photographer/change-password`, `/photographer/dashboard`, `/photographer/images`, `/photographer/events` (list, create, edit), and `/photographer/uploads` (batch list, new bulk upload with presigned R2 PUT + submit, batch detail), including dashboard analytics fed by `GET /api/v1/photographer/analytics/summary`.
- App user profile state lives in `app_user_profiles`.
- App roles are `USER`, `PHOTOGRAPHER`, `ADMIN`, and `SUPER_ADMIN`.
- Subscriber access combines `app_user_profiles` flags (`is_subscriber`, `subscription_status`, plan fields, dates) for UX with **`subscriber_entitlements`** for download authorization: an **ACTIVE** row per licensed **asset type**, remaining download count, **quality cap** vs requested download size, and optional validity window. Staff reviews **`customer_access_inquiries`** (status includes **`ACCESS_GRANTED`** after activation) under `/api/v1/staff/access-inquiries/*`, generates missing **DRAFT** entitlements without overwriting existing rows, edits counts, then activates. Registration preference capture stores quantity + quality for Editorial and Royalty Free, but quantity-only for Video and Caricature (`video_quantity_range`, `caricature_quantity_range`); Video/Caricature entitlement drafts default `quality_access` to `HIGH`.
- Internal dashboard and privileged catalog tooling in `apps/web` under **`/staff/*`** require a **staff session** (`fotocorp_staff_session` cookie), backed by `staff_members` + `auth_credentials` / `auth_sessions` (`owner_type = STAFF`) in Neon. Subscriber `users.role` does **not** grant staff route access; staff credentials are bootstrapped separately. Legacy browser URLs under `/admin/*` were removed; reserved namespace ends in **404** (`app/admin/[[...path]]`).
- Staff auth API (Hono): `POST /api/v1/staff/auth/login`, `POST /api/v1/staff/auth/logout`, `GET /api/v1/staff/auth/me` (`apps/api/src/routes/staff/auth/route.ts`). Sales-led inquiry + entitlement routes: `GET/POST /api/v1/staff/access-inquiries*`, `PATCH/POST /api/v1/staff/subscriber-entitlements/*` (activate + suspend) (`apps/api/src/routes/staff/access-inquiries/`). Staff audit read: `GET /api/v1/staff/audit-logs` (`apps/api/src/routes/staff/audit-logs/route.ts`) — `SUPER_ADMIN` only; unified cursor-paginated feed across `staff_audit_logs`, `asset_admin_audit_logs`, and `admin_user_audit_logs` with sanitized metadata. Staff productivity read: `GET /api/v1/staff/productivity` (`apps/api/src/routes/staff/productivity/route.ts`) — `SUPER_ADMIN` only; aggregates caption edits from `asset_admin_audit_logs` plus contributor-upload metadata/approval/rejection counts from `staff_audit_logs`. Staff UI: `/staff/audit`, `/staff/team-performance`. Write-side audit foundation remains `staff_audit_logs` for staff-domain events (e.g. `STAFF_LOGIN_SUCCESS`, `STAFF_LOGIN_FAILED`, `STAFF_LOGOUT`, contributor-upload review actions), while asset editorial before/after deltas remain in `asset_admin_audit_logs`. Bootstrap: `pnpm --dir apps/api staff:bootstrap` with `STAFF_BOOTSTRAP_*` vars documented in `apps/api/.dev.vars.example`.
- Staff workspace RBAC (`apps/web/src/lib/staff/staff-route-access.ts`): **`CAPTION_WRITER`** accesses `/staff/contributor-uploads` (full pre-publish workflow) and `/staff/captions`; only **`SUPER_ADMIN`** and **`CAPTION_WRITER`** may access contributor uploads. **`CATALOG_MANAGER`** and **`REVIEWER`** no longer access contributor uploads (catalog/homepage-hero remain for catalog manager). `/staff/team-performance` is `SUPER_ADMIN` only. Contributor upload volume for admins is aggregateable from `contributor_upload_batches` / `contributor_upload_items` by `contributor_id`; staff caption/upload productivity is aggregateable from existing audit rows without duplicating revision tables.
- **Upload wizard resume:** Contributor and staff upload wizards persist in-progress work as `OPEN` `contributor_upload_batches` rows. Once a batch exists, the web wizard syncs `?batchId=` into the URL and reloads batch detail from `GET /api/v1/contributor/upload-batches/:batchId` (contributor) or `GET /api/v1/internal/admin/staff-upload-wizard/upload-batches/:batchId` (staff BFF). Metadata and uploaded items rehydrate from server state; local `File` picks are not recoverable after refresh unless the bytes already reached `ASSET_CREATED`. OPEN batches expose **Continue editing** from contributor upload list/detail pages.
- Main-app legacy `ADMIN` / `SUPER_ADMIN` roles may still exist in `app_user_profiles` for data/audit compatibility, but they are not used to gate the internal dashboard UI.
- Main-app photographer roles remain part of the Better Auth/app-user model, but the dedicated contributor portal uses separate `contributor_accounts` and `contributor_sessions`; these sessions do not grant staff or subscriber access. Contributor accounts may carry `portal_role` (`STANDARD` | `PORTAL_ADMIN`); `PORTAL_ADMIN` can list all contributors and must choose a target photographer when creating events for someone else. Read-only `GET /api/v1/contributor/catalog/asset-categories` backs event category pickers.
- Account routes require an authenticated user and an active profile.
- Clean downloads require an active `app_user_profiles` row with **active subscriber flags**, a matching **ACTIVE** `subscriber_entitlement` for the asset type (API errors distinguish missing entitlement vs exhausted quota vs insufficient quality tier), sufficient quality tier for the requested download size, downloadable asset state, and an available canonical original object.
- Internal API routes require the internal API secret in server-side calls. Browser components must never call them directly.

## Request Audit Metadata

Technical request metadata is captured for registration, contributor applications, and subscriber downloads to support security, entitlement enforcement, licensing compliance, and abuse investigation.

### Capture helpers

- API: `apps/api/src/lib/request-audit-context.ts` — reads IP (CF-Connecting-IP → X-Forwarded-For), approximate geo (request.cf → Cloudflare visitor headers), CF-Ray, User-Agent, and optional secret-based IP hash.
- Web BFF: `apps/web/src/lib/server/request-audit-context.ts` — same shape for browser-facing routes (downloads).

### Storage

- **Registration and contributor applications:** submission metadata on `customer_access_inquiries` (`submission_ip_address`, hash, geo fields, CF-Ray, user-agent). Populated by `POST /api/v1/auth/sign-up` and `POST /api/v1/public/contributor-applications`. Applicant profile location fields remain separate from IP-derived metadata.
- **Subscriber downloads:** metadata on `image_download_logs` (`ip_address`, hash, geo fields, CF-Ray, user-agent; legacy `ip_hash` / `user_agent` retained). Web BFF captures audit context on `/api/assets/:assetId/download` and forwards `requestAudit` to internal API. Internal API (`apps/api/src/routes/internal/downloads/service.ts`) normalizes `requestAudit` and legacy `requestIp` / `userAgent` via `apps/api/src/lib/downloads/download-request-audit.ts`.

### Download logging behavior

- **Preflight** (`POST /api/v1/internal/assets/:assetId/download/check`): no quota decrement, no download log writes.
- **Actual download** (`POST /api/v1/internal/assets/:assetId/download`): quota increment unchanged; writes audit fields on `STARTED` and on relevant `FAILED` rows. `COMPLETED` updates status only (audit captured at `STARTED`).

### Staff visibility

- Staff inquiry detail (`GET /api/v1/staff/access-inquiries/:inquiryId`) returns `submissionAudit` separately from the sanitized `inquiry` object. Raw IP is included in `submissionAudit.ipAddress` only for **`SUPER_ADMIN`**; other authorized staff roles receive null for raw IP but may see hash, geo, CF-Ray, and user-agent.
- Mutation responses (notes PATCH, close) use `sanitizeCustomerAccessInquiryForStaffResponse` / `serializeStaffInquiryMutationResponse` so raw submission audit columns are not returned on the `inquiry` object.

### IP hashing and ops

- New request audit hashes use secret-based SHA-256: `SHA-256(\`${ip}:${IP_HASH_SECRET}\`)` when both IP and secret are present; otherwise hash is null.
- **`IP_HASH_SECRET` must be set on both API and web Workers** (same value in each environment). Use a strong random value, preferably 32+ bytes. Do not commit `.dev.vars`, `.env.local`, or other secret files.
- Historical download rows may retain older unsalted IP hashes from before PR 5; new rows use secret-based hashes when configured. Raw IP may be stored separately where available.

## Database Ownership

- `apps/api` owns catalog, media, admin, download, Fotobox, audit, legacy import, and migration schema.
- Better Auth tables are represented in the API schema/migrations because the API Worker owns the `/api/auth/*` route handler.
- Manual DB patches are discouraged. Schema changes should be represented in Drizzle schema and migrations.
- Migrations must be reproducible, reviewable, and safe to run in the expected environment.
- Real DB types must be verified before adding foreign keys or changing references.
- Known type fact: `app_user_profiles.id` is text in the real DB, even though current Drizzle schema has shown UUID in code history. Verify and align before introducing new references.
- Import and reconciliation scripts for the retired legacy mirror schema are archive-only references; they are no longer production commands after legacy table retirement.
- Photographer/profile imports must use numeric legacy IDs for identity joins. Do not join photographers by display name, and do not use `tempphotographer` as a primary mapping source.
- Runtime image/photographer joins use `image_assets.photographer_id -> photographers.id`.
- Runtime derivative and download-log joins use `image_assets.id`; old asset UUIDs were preserved in `image_assets.id` during cutover so no runtime mapping table is needed.
- `image_assets.legacy_image_code` is intentionally not unique until known duplicate legacy image-code import issues are resolved.
- `image_derivatives.image_asset_id` points to `image_assets.id`, and public media preview routes resolve uppercase clean variants at the service boundary.
- Clean image log tables use nullable foreign keys with `on delete set null` so audit/history records survive future image or derivative cleanup.
- Re-running old legacy import/sync scripts is no longer supported on the production schema after legacy table retirement.

## Current Route Groups

- Health: `GET /health` through Hono.
- Internal DB health: `GET /api/v1/internal/health/hyperdrive-core` through Hono; requires `x-internal-api-secret`, probes the core DB path with `select 1`, and returns only a safe status payload.
- Auth: `/api/auth/*` through Hono-native Better Auth route handling.
- Auth profile: `GET /api/v1/auth/me` through Hono-native route handling.
- Staff auth: `POST /api/v1/staff/auth/login`, `POST /api/v1/staff/auth/logout`, `GET /api/v1/staff/auth/me` through Hono-native route handling (`apps/api/src/routes/staff/auth/route.ts`). Uses HttpOnly cookie `fotocorp_staff_session` (hashed session rows in `staff_sessions`).
- Photographer auth: `POST /api/v1/photographer/auth/login`, `POST /api/v1/photographer/auth/logout`, `GET /api/v1/photographer/auth/me`, and `POST /api/v1/photographer/auth/change-password` through Hono-native route handling. These routes read only `fc_ph_session` and operate on `photographer_accounts` / `photographer_sessions`.
- Photographer images: `GET /api/v1/photographer/images` through Hono-native route handling, scoped to `image_assets.photographer_id = current photographer id`.
- Photographer analytics: `GET /api/v1/photographer/analytics/summary` through Hono-native route handling, scoped to the current photographer session; aggregates uploads, submission vs live counts, completed-download metrics, top downloaded images, and recent uploads without exposing subscriber identities or storage internals.
- Photographer events: `GET/POST /api/v1/photographer/events`, `GET/PATCH /api/v1/photographer/events/:eventId` through Hono-native route handling; creates and updates `photo_events` directly with provenance columns (`created_by_source`, photographer/account FKs). List scopes `mine` vs `available` (`ACTIVE` events for upload selection); photographers edit only events they created. See [`docs/db-revamp/reports/photographer-events-report.md`](../docs/db-revamp/reports/photographer-events-report.md).
- Contributor bulk uploads (backend; canonical paths `/api/v1/contributor/upload-batches/*`, legacy alias `/api/v1/photographer/upload-batches/*`): `POST/GET /api/v1/contributor/upload-batches`, `GET /api/v1/contributor/upload-batches/:batchId`, `POST .../files`, `POST .../files/:itemId/complete`, `POST .../submit` through Hono-native route handling. Uses `contributor_upload_batches` and `contributor_upload_items`; **bytes are staged in the contributor staging bucket** under `staging/<contributor_id>/<event_id>/<batch_id>/<upload_item_id>.<ext>` (Worker binding `MEDIA_CONTRIBUTOR_UPLOADS_BUCKET`). Presigned PUT URLs are minted by the API via `createContributorStagingPresignedPutUrl` using **server-side** S3 credentials: prefer `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_CONTRIBUTOR_STAGING_BUCKET` in `apps/api/.dev.vars` (legacy aliases `CLOUDFLARE_R2_*` + `CLOUDFLARE_R2_CONTRIBUTOR_UPLOADS_BUCKET` remain supported). `POST .../files` returns **503** `UPLOAD_STORAGE_NOT_CONFIGURED` when that config is incomplete (no silent `NOT_CONFIGURED` success with missing URLs). `complete` verifies the staging object with `MEDIA_CONTRIBUTOR_UPLOADS_BUCKET.head` when the Worker binding exists, otherwise S3 `HeadObject` against the same bucket name. New rows in `image_assets` are SUBMITTED + PRIVATE + **`FOTOCORP`** with `fotokey = NULL`. Upload **origin** is tracked via batch/item rows and `contributor_id`, not via `image_assets.source`. Pre-approval uploads must never be written to the canonical originals bucket. R2 bucket **CORS** for browser `PUT` on the **staging** bucket is documented in [`docs/db-revamp/reports/photographer-bulk-upload-backend-report.md`](../docs/db-revamp/reports/photographer-bulk-upload-backend-report.md) (dashboard configuration). See that report for smoke details.
- Public catalog: `/api/v1/assets`, `/api/v1/assets/filters`, `/api/v1/assets/collections`, `/api/v1/assets/events`, `/api/v1/assets/:id` through Hono-native route modules. These anonymous read-only Postgres routes use `PUBLIC_READ_HYPERDRIVE` in PR-2 and include `x-fotocorp-db-path: public-read`; the Typesense search routes remain Typesense-backed and are not part of the DB migration.
- Public Typesense search: `GET /api/v1/search/assets` through the public catalog Hono route module. It queries Typesense alias `public_assets_current` for public search results, counts, and page pagination; facets remain available with `includeFacets=true` but the `/search` UI now uses the separate `/api/v1/assets/filters` route for filter-panel data so the primary search request can omit heavy facets. It returns both the PR-5 response fields (`total`, `perPage`, `totalPages`, `timing`) and compatibility fields (`totalCount`, `limit`, `meta`). Anonymous public search responses use `Cache-Control: public, max-age=30, s-maxage=120, stale-while-revalidate=300`. `/search` now uses the same-origin `/api/public/search/assets` BFF path directly with TanStack Query client caching; `/api/v1/assets` remains a compatibility/listing route, not the homepage/search query path.
- Public asset detail: `GET /api/v1/assets/:id` and same-origin BFF `GET /api/public/assets/:id` return public metadata and preview URLs only, with `Cache-Control: public, max-age=300, s-maxage=2592000, stale-while-revalidate=604800`. Entitlement state, remaining quota, and clean original downloads remain on separate private same-origin/internal routes. Staff metadata/publish edits call a targeted public cache invalidation hook; Cloudflare purge runs only when purge env vars are configured.
- Public homepage/events: `GET /api/v1/public/homepage` is a lightweight homepage shell feed that returns only a first-page Latest Events preview. `GET /api/v1/public/events/latest` is the cursor-paginated Latest Events endpoint ordered by `public_event_feed_items.event_date desc, event_id desc`; it supports `section=latest|news|sports|entertainment|fashion|retro` using the projection plus lightweight event/category joins. Latest Events rows are served from **`public_event_feed_items`**; the Worker daily cron (`apps/api/src/index.ts` → `runPublicEventFeedCleanup`) deletes aged projection rows by `event_date` then runs **`reconcilePublicEventFeedProjectionDrift`** to correct drift vs live public-ready assets. `GET /api/v1/public/events/browse` is the homepage category browse endpoint for `section=news|sports|entertainment|fashion|retro`; it reads **`photo_events`** joined to **`asset_categories`** on `photo_events.category_id`, requires at least one public-ready CARD preview asset per event, uses keyset pagination on `event_date desc nulls last, id desc`, and returns `Cache-Control: public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400`. `GET /api/v1/public/royalty-free/featured` (canonical; `GET /api/v1/public/creative/featured` remains a compatibility alias) reads current-month rows from **`public_royalty_free_featured_items`** (period key `YYYY-MM`) via a featured-first query, avoiding request-time full-catalog scans, and returns `Cache-Control: public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800`. Homepage hero backdrop uses **`public_homepage_hero_pool_items`** (staff-curated 25-image pool) via `GET /api/v1/public/homepage/hero-set`, which returns the first 9 eligible images in staff-curated position order (`Cache-Control: public, max-age=0, s-maxage=30, stale-while-revalidate=60`); the web homepage does not call `/api/v1/assets` for hero images. These anonymous read-only Postgres routes use `PUBLIC_READ_HYPERDRIVE` in PR-2. Staff curates the pool at `/staff/homepage-hero` through internal admin routes `GET/PUT /api/v1/internal/admin/homepage-hero-pool` — save is the only write path and remains non-cached/core; exactly 25 public-ready images required. Legacy `public_homepage_hero_sets` / `homepage:refresh-hero-sets` remain in the repo but are no longer the live hero source.
- Public media: `/api/v1/media/assets/:assetId/preview` through Hono-native route modules. Public media preview metadata is intentionally not moved to cached public-read Hyperdrive in PR-2.
- Internal admin: `/api/v1/internal/admin/*` through Hono-native route modules. Admin catalog handlers use clean image schema for catalog reads, editorial/publish mutations, original tunnels, preview tunnels, stats, and filters.
- Internal admin photographer-upload review + publish queue (PR-15 / PR-15.1): `/api/v1/internal/admin/photographer-uploads`, `/api/v1/internal/admin/photographer-uploads/approve`, `/api/v1/internal/admin/photographer-uploads/:imageAssetId/original` through a Hono-native route module under `apps/api/src/routes/internal/admin-photographer-uploads/*`. List supports `status=SUBMITTED|APPROVED|ACTIVE|all`. Approve enforces the `FOTOCORP + SUBMITTED + PRIVATE + fotokey is null` precondition, allocates Fotokeys in input order via `apps/api/src/lib/fotokey/allocator.ts`, copies the original from the staging bucket to the canonical originals bucket via `apps/api/src/lib/r2-photographer-uploads.ts#copyStagingObjectToOriginals` using `FCddmmyyNNN.<ext>`, sets `image_assets` to `APPROVED + PRIVATE` with the assigned Fotokey + canonical filename, and inserts `image_publish_jobs` + `image_publish_job_items` rows. Approved assets only become `ACTIVE + PUBLIC` after the publish processor (`apps/api/scripts/media/process-image-publish-jobs.ts`) generates `THUMB`/`CARD`/`DETAIL` WebP derivatives (**thumb/card clean, detail watermarked**) in the previews bucket and upserts `image_derivatives` rows as `READY`. Long-term that processor may move to the Node CLI in `apps/jobs` (native Sharp); PR-16A added the `apps/jobs` skeleton only. The original viewer streams from the staging bucket before approval and from the canonical originals bucket after Fotokey assignment. R2 storage keys, bucket names, signed URLs, and raw R2 errors are never returned. See [`docs/db-revamp/reports/admin-photographer-upload-review-report.md`](../docs/db-revamp/reports/admin-photographer-upload-review-report.md) and [`docs/db-revamp/reports/fotokey-publish-pipeline-report.md`](../docs/db-revamp/reports/fotokey-publish-pipeline-report.md).
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
3. Public catalog routes return only approved, public, image assets with required protected preview derivatives ready (all variants watermarked with expected profiles).
4. Clean original downloads must revalidate auth, subscription, quota, asset eligibility, and source availability server-side.
5. Preview access must use the stored preview derivatives only (never stream originals to preview URLs). **Detail** must be the watermarked derivative; **thumb** and **card** are clean derivatives at the same key prefix layout.
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
