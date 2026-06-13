# Hyperdrive Rollout

Fotocorp uses Cloudflare Workers for the API surface and Neon Postgres for catalog, auth, entitlement, audit, and operational state. Hyperdrive gives the Worker a Postgres-compatible connection path with Cloudflare-managed connection pooling close to the Worker runtime, which avoids relying on Neon serverless HTTP drivers for every future API DB path.

## Two DB paths

Fotocorp will use two Hyperdrive paths because the API has two different database safety profiles:

- `CORE_HYPERDRIVE`: core API database path for auth, sessions, staff routes, contributor uploads, downloads, entitlements, audits, and mutations. Query caching is disabled for this Hyperdrive configuration.
- `PUBLIC_READ_HYPERDRIVE`: public-read database path for carefully reviewed anonymous public catalog/event reads. PR-2 uses a read-only Neon role and Hyperdrive query caching with max-age 60 seconds and stale-while-revalidate 15 seconds.

PR-1 activated the foundation for `CORE_HYPERDRIVE`. PR-2 activates `PUBLIC_READ_HYPERDRIVE` only for selected public read-only Postgres routes. Existing Neon serverless helpers remain in place for current compatibility.

## Core path rules

Never route auth, session, download, entitlement, staff, contributor, or mutation paths through cached Hyperdrive. These flows need fresh reads, writes, transactions, locks, quota updates, and audit writes.

`CORE_HYPERDRIVE` must point to an unpooled Neon connection string. Hyperdrive owns the connection pooling layer for the Worker path, so the Worker should create request-scoped `pg.Client` instances instead of a global `pg.Pool`.

The API Worker uses `pg` with `drizzle-orm/node-postgres` for Hyperdrive-compatible DB access. The `pg` package must stay at `8.16.3` or newer.

## Public-read path rules

`PUBLIC_READ_HYPERDRIVE` is restricted to anonymous public catalog, homepage, event, and royalty-free read routes that use Postgres. The migrated PR-2 route responses include `x-fotocorp-db-path: public-read` for safe debugging.

PR-2 migrates:

- `GET /api/v1/assets`
- `GET /api/v1/assets/filters`
- `GET /api/v1/assets/collections`
- `GET /api/v1/assets/events`
- `GET /api/v1/assets/:assetId`
- `GET /api/v1/public/homepage`
- `GET /api/v1/public/events/latest`
- `GET /api/v1/public/events/browse`
- `GET /api/v1/public/homepage/hero-set`
- `GET /api/v1/public/royalty-free/featured`
- `GET /api/v1/public/creative/featured` as the royalty-free compatibility alias

The public Typesense search routes are not part of this migration because they do not use Postgres at request time. Public media preview metadata and R2 preview delivery remain unchanged for now because preview correctness may need tighter freshness than the public-read DB cache.

## PR sequence

1. PR-1: add the API Worker foundation for `CORE_HYPERDRIVE`, keep fallback to `DATABASE_URL`, and expose a protected internal health check.
2. PR-2: activate `PUBLIC_READ_HYPERDRIVE` with a read-only DB role and query caching enabled for reviewed public read-only Postgres routes.
3. Later PRs: migrate reviewed public reads route by route. Do not move privileged or mutating paths to the cached public-read path.
