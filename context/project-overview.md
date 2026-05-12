# Fotocorp Project Overview

## Product Summary

Fotocorp is a Shutterstock-like editorial stock image platform for a large legacy photo archive. The target corpus is approximately 1 million high-resolution images, with current storage planning around 2TB. Canonical originals live in Cloudflare R2, while public browsing uses lower-resolution watermarked derivatives.

The product must preserve legacy metadata and identifiers. Fotokey/ImageCode values are business-visible identifiers and must remain searchable and displayable alongside the internal database UUIDs. Legacy originals must not be renamed, moved, or reorganized casually because file and metadata mapping may depend on current identifiers.

Phase 1 search is metadata and keyword based. Semantic, vector, and AI search are future phases and are not dependencies for the current client catalog and download work.

## Primary Users

- Public visitors browsing and searching watermarked editorial imagery.
- Authenticated users managing account state, Fotobox items, and downloads.
- Subscribers downloading clean originals through entitlement-protected flows.
- Admins and super admins managing catalog records, publish state, subscribers, and operational health.
- Photographers uploading or reviewing their own contributed images. Current code has route shells for photographer pages; complete workflows remain future work unless separately verified.
- Caption writers preparing captions, keywords, tags, and event metadata. This is legacy/client reference context and future work unless implementation is added.

## Business Goals

1. Make approved public image records discoverable by keyword, category, event, photographer, and date/year filters.
2. Let non-subscribers inspect watermarked previews without exposing clean media.
3. Let active subscribers download clean originals without ever seeing R2 object keys, direct R2 URLs, bucket names, signed URLs, or internal API secrets.
4. Preserve legacy identifiers, metadata, photographer/event/category mapping, and import auditability.
5. Give admins enough tools to verify catalog health, preview readiness, R2 mapping, publish state, and subscriber entitlements.
6. Keep the API architecture understandable while it moves from a manual Cloudflare Worker router to incremental Hono route groups.

## Core User Flows

### Public Browse/Search/Detail

1. Visitor opens the homepage, search page, category page, event page, or latest image surfaces.
2. Visitor searches by keyword or filters by category, event, photographer, date/year, and sort where implemented.
3. Public catalog routes return approved, public, image assets with ready watermarked derivatives.
4. Visitor opens an asset detail page showing preview imagery and editorial metadata such as headline, caption, event/category, date, photographer, Fotokey/ImageCode, copyright, and keywords.
5. Visitor can save to Fotobox or download only after the account/entitlement path allows it.

### Subscriber Download

1. Authenticated user requests a download from the asset detail page.
2. The browser calls a same-origin `apps/web` route, not an internal API route.
3. The web server revalidates the Better Auth user, app profile, and request size.
4. The web server calls an internal `apps/api` route using `INTERNAL_API_BASE_URL` and `INTERNAL_API_SECRET`.
5. The API revalidates the internal secret, user profile, subscriber entitlement, quota, asset eligibility, and source availability.
6. The API streams the clean original from R2 through controlled server-side routes.
7. Browser-visible responses must not include private storage details.

### Fotobox and Download History

1. Authenticated users can save eligible public assets to Fotobox.
2. Account pages list Fotobox items with safe preview URLs.
3. Account download history lists logged download attempts with date filtering where implemented.
4. These flows use same-origin web routes that call internal API routes server-side.

### Admin Catalog Management

1. Admins and super admins enter the admin area.
2. Admin views catalog stats, asset lists, asset detail, filters, migration/reconciliation health, users, and audit surfaces where implemented.
3. Admin mutations and privileged media access go through server-side internal API calls protected by the internal secret.
4. Original and preview admin tunnels must not expose R2 object keys or direct URLs to the browser.

### Legacy Metadata Migration

1. Legacy metadata is imported into catalog tables with preserved source payloads and import batches/issues.
2. Legacy Fotokey/ImageCode remains searchable/displayable.
3. R2 mapping is tracked separately from public eligibility.
4. Import scripts must be reproducible and log enough safe diagnostics to support reconciliation.

## Feature Areas

| Area | Status | Notes |
| --- | --- | --- |
| Home | Implemented/partial | Marketing route exists with public gallery direction; exact data coverage depends on current API availability. |
| About, Contact, Services | Implemented/partial | Marketing pages exist. Content should stay product-accurate. |
| Search bar and search page | Implemented/partial | URL-driven search/filter UI exists for Phase 1 metadata search. |
| Latest pictures | Implemented/partial | Public catalog sorting and homepage surfaces exist; verify runtime data before claiming production completeness. |
| Categories | Implemented/partial | Category listing/detail routes and API filter/collection endpoints exist. |
| Event/album browsing | Implemented/partial | Event listing/detail routes exist; legacy album behavior is not fully restored unless verified. |
| Search by event, category, date/year | Implemented/partial | API/web support exists for current metadata filters; keep URL-driven filters compact. |
| Asset detail | Implemented/partial | Detail page and components exist for preview, metadata, gated actions, Fotobox, and download actions. |
| Fotobox | Implemented/partial | Account pages and internal API routes exist; E2E should still be verified after auth/download fixes. |
| Download history | Implemented/partial | Account route and internal API route exist with year/month parameters. |
| Subscriber clean downloads | In progress | Foundation exists; current PR sequence tracks auth-state/no-refresh UX and `INVALID_ASSET_ID` bug follow-up. |
| Admin dashboard/catalog | Implemented/partial | Admin pages, catalog stats, asset browser/detail, publish mutation, user subscription controls, tunnels, and audit surfaces exist. |
| Manage subscribers | Implemented/partial | Admin users/subscription update route exists; verify UX and permissions in each PR. |
| Manage photographers | Partial/future | Admin route exists for catalog photographers; complete workflow is not proven. |
| Manage caption writers | Future | Legacy reference only unless code is added. |
| Statistics | Implemented/partial | Admin dashboard and catalog health surfaces exist. |
| Published/unpublished events | Future/partial | Legacy reference; current catalog status/visibility exists but full event workflow is not proven. |
| Photographer dashboard/upload/reports | Partial/future | Photographer routes exist, but full upload/report workflow should be treated as future until verified. |
| Caption writer dashboard/caption workflow | Future | Product context only. |
| Payment/checkout | Future | Pricing/subscription pages may exist, but payment processing is not implemented unless Stripe/checkout code is added and verified. |
| Semantic/vector/AI search | Future | Not implemented and not required for Phase 1. |

## Current Implementation Status

- `apps/web` is a Next.js app with public marketing/catalog routes, account routes, admin routes, photographer route shells, auth UI, same-origin API routes, and server-side API helpers.
- `apps/api` is a Cloudflare Worker API using Neon Postgres, Drizzle ORM, Better Auth route handling, R2 access, media derivative metadata, legacy import schema, internal routes, and Hono routing.
- Hono owns all API route groups, including `/api/auth/*`.
- Public catalog API routes are DB-backed under `/api/v1/assets*`.
- Legacy fixture routes still exist outside `/api/v1`; they must be isolated or removed in a later route cleanup.
- Better Auth route handling lives in `apps/api` under `/api/auth/*` with email/password plus username auth only. `apps/web` keeps same-origin auth proxying and server-side session reads for route guards.
- Server-only web helpers currently hand-build several internal API routes, and some still fall back to `NEXT_PUBLIC_API_BASE_URL`. That fallback is technical debt and must be removed in a focused internal API client cleanup.

## In Scope

- Metadata-based public browsing/search/detail.
- Watermarked preview delivery through controlled API routes.
- Subscriber download entitlement and quota enforcement.
- Fotobox and download history account surfaces.
- Admin catalog, publish state, subscription, audit, and media tunnel surfaces.
- Legacy metadata import, R2 mapping, derivative generation, and reconciliation.
- Incremental Hono route migration.
- Centralized web internal API client and route builder.

## Out of Scope

- Semantic/vector/AI search in Phase 1.
- Payment/checkout unless a dedicated payment PR adds and verifies it.
- Complete photographer/caption writer production workflows until explicitly scoped.
- Public direct R2 access.
- Browser calls to `/api/v1/internal/...`.
- Big-bang API rewrites or broad route migrations in one PR.
- Renaming or moving legacy originals without a proven mapping-safe plan.

## Success Criteria

1. Public users can search approved public image assets and view watermarked previews.
2. Public catalog responses include only safe fields and never expose private storage data.
3. Subscribers can download clean originals through same-origin/internal server flow without seeing R2 URLs, object keys, bucket names, or internal secrets.
4. Download checks and downloads revalidate auth, subscription, quota, asset eligibility, and source availability server-side.
5. Admins can manage asset metadata and publish state through protected routes.
6. Legacy Fotokey/ImageCode remains searchable and displayable in business-facing contexts.
7. Fotobox and download history work from authenticated account pages using safe preview URLs.
8. API route changes keep docs and route audit context up to date.

## Major Risks

- Leaking R2 object keys, bucket names, signed URLs, direct R2 URLs, or internal API secrets to browser-visible output.
- Allowing browser/client components to call internal API routes directly.
- Treating subscriber as a role instead of an entitlement on the app user profile.
- Breaking legacy ID to media mapping by renaming or reorganizing originals.
- Claiming fixture or partial routes as production-complete.
- Expanding the manual router in `apps/api/src/index.ts` instead of moving toward Hono modules.
- Using public API environment variables as fallback for privileged internal calls.
- Mixing architecture migration, feature changes, and UI polish in one broad PR.
