# Typesense Public Search API Report

## Scope

PR-2 added a parallel Typesense-powered public search endpoint:

- API Worker: `GET /api/v1/search/assets`
- Web BFF: `GET /api/public/search/assets`

This PR does **not** replace the existing SQL-backed routes:

- `GET /api/v1/assets`
- `GET /api/v1/assets/filters`
- `GET /api/v1/assets/collections`
- `GET /api/v1/assets/:assetId`

PR-5 adds the feature-flagged frontend cutover path. The frontend `/search` page uses the Typesense BFF only when:

```env
NEXT_PUBLIC_USE_TYPESENSE_SEARCH=true
```

When the flag is disabled, `/search` continues to use the legacy SQL-backed `/api/v1/assets` list route plus `/api/v1/assets/filters`.

## PR-5 Compatibility Update

The Typesense endpoint now accepts the frontend-compatible query params:

```txt
q, page, limit, category, event, city, sort
```

Legacy `categoryId` and `eventId` remain supported for old deep links and compatibility. UUID values map to `category_id` / `event_id`; non-UUID values map to `category_name` / `event_title`.

Centralized Typesense mapping:

| Frontend param | Typesense mapping |
| --- | --- |
| `q` | `q` |
| `category` (UUID) | `filter_by=category_id:=...` |
| `category` (name) | `filter_by=category_name:=...` |
| `categoryId` (UUID) | `filter_by=category_id:=...` |
| `event` (UUID) | `filter_by=event_id:=...` |
| `event` (name) | `filter_by=event_title:=...` |
| `eventId` (UUID) | `filter_by=event_id:=...` |
| `city` | `filter_by=event_location:=...` |
| `sort=newest` | `sort_by=created_at_ts:desc` |
| `sort=oldest` | `sort_by=created_at_ts:asc` |

UUID detection applies to both legacy (`eventId`/`categoryId`) and PR-5 (`event`/`category`) param names.

Response contract:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "perPage": 50,
  "totalPages": 1,
  "facets": {
    "categories": [],
    "events": [],
    "cities": [],
    "sources": []
  },
  "timing": {
    "backend": "typesense",
    "tookMs": 0
  }
}
```

The response also keeps old compatibility fields (`totalCount`, `limit`, `hasMore`, and `meta`) for existing callers.

Frontend request flow:

```txt
/search
  -> searchAssets()
  -> /api/public/search/assets
  -> /api/v1/search/assets
  -> Typesense alias public_assets_current
```

Rollback:

```env
NEXT_PUBLIC_USE_TYPESENSE_SEARCH=false
```

In Typesense mode, facets come from `/api/public/search/assets`; the page does not make a separate `/api/v1/assets/filters` request.

Operational note: `cities` depends on the indexed `city` facet emitted by the indexer from `photo_events.location`. Rebuild a new collection with this schema and swap `public_assets_current` before enabling the flag in production.

## What Typesense Is Used For

Typesense is used as a fast rebuildable public image metadata index for:

- public image search
- public filter/facet aggregation
- total result counts
- page-based pagination for future public search UI work

Neon/Postgres remains the source of truth for catalog state, media readiness, visibility, entitlement, audit, and all write workflows.

## What Typesense Is Not Used For

Typesense is not used as:

- the source of truth
- an authorization database
- a media storage system
- a subscriber entitlement system
- an admin mutation target
- a direct browser dependency
- a vector or semantic search provider in this PR

If the index is stale or broken, it can be rebuilt from Neon using `pnpm --dir apps/api typesense:index-public-assets`.

## VPS Installation

Current VPS search stack:

- Install directory: `/opt/fotocorp-search`
- Docker Compose file: `/opt/fotocorp-search/docker-compose.yml`
- Persistent data directory: `/opt/fotocorp-search/typesense-data`
- Snapshots directory: `/opt/fotocorp-search/typesense-snapshots`
- Container: `fotocorp-typesense`
- Image: `typesense/typesense:30.2`
- Local VPS port binding: `127.0.0.1:8108:8108`

Current index naming:

- Old collection: `public_assets_20260519`
- V2 migration collection: `public_assets_20260519_v2`
- Alias: `public_assets_current`

## Typesense Behavior This PR Relies On

- A Typesense collection is a group of indexed documents.
- The collection schema defines indexed, searchable, filterable, facetable, and sortable fields.
- Extra unindexed fields can be stored on disk and returned in search results.
- Bulk import/upsert is preferred for indexing many documents.
- A collection alias lets operators reindex into a new collection and swap the alias without application code changes.
- Search supports `filter_by`, `facet_by`, pagination, and `found` counts.

## Why The Collection Alias Is Used

The API queries `TYPESENSE_COLLECTION_ALIAS` instead of a dated collection name. Operators can rebuild a new collection, validate it, and atomically point `public_assets_current` at the new collection. The API and future web frontend do not need code or env changes for that swap.

## Indexing

Documents are indexed by:

```bash
pnpm --dir apps/api typesense:index-public-assets -- --collection public_assets_20260519_v2
```

The indexer reads public-eligible image assets from Neon/Postgres using the same public catalog derivative policy:

- `image_assets.status = ACTIVE`
- `image_assets.visibility = PUBLIC`
- `image_assets.media_type = IMAGE`
- `image_assets.original_exists_in_storage = true`
- required READY clean `CARD` derivative using the current card clean profile
- optional `THUMB` clean derivative
- optional `DETAIL` watermarked derivative

The indexer writes JSONL documents to Typesense using bulk import with `action=upsert`.

For v2, `who_is_in_picture` is a first-class indexed string field. `title` and `headline` may be stored for compatibility/display, but they are not indexed and are not queried.

## Search Request Flow

```text
Browser
  -> apps/web BFF: /api/public/search/assets
  -> apps/api Worker: /api/v1/search/assets
  -> Typesense: /collections/public_assets_current/documents/search
```

The browser does not receive the Typesense host or API key. The BFF forwards only to the API Worker. The API Worker holds `TYPESENSE_API_KEY` server-side.

Important production caveat: the production API Worker cannot reach a VPS service bound to `127.0.0.1`. The Worker runs in Cloudflare's edge runtime, not on the VPS, so `127.0.0.1:8108` would point at the Worker runtime environment rather than the VPS Typesense container.

PR-4 production access pattern:

- Keep the raw Typesense port private on the VPS (`127.0.0.1:8108:8108`).
- Expose Typesense to the Worker through Cloudflare Tunnel, for example `https://search.fotocorp.com`.
- Protect that hostname with Cloudflare Access service auth.
- Configure the API Worker with the Typesense API key plus Access service-token client id/secret.

Cloudflare Tunnel is used so there is no public inbound Typesense port to open on the VPS. Cloudflare Access service tokens are used so only callers with the configured service token can reach the Tunnel hostname, and Typesense still enforces `X-TYPESENSE-API-KEY` behind that layer.

Do not expose the raw Typesense port publicly. If a Typesense API key or Cloudflare Access secret is pasted into chat, logs, docs, screenshots, shell history, or browser-visible code, rotate it.

## Env Vars

API Worker env vars:

```env
TYPESENSE_HOST=https://search.fotocorp.com
TYPESENSE_API_KEY=change-me
TYPESENSE_COLLECTION_ALIAS=public_assets_current
TYPESENSE_SEARCH_TIMEOUT_MS=1500
TYPESENSE_CF_ACCESS_CLIENT_ID=
TYPESENSE_CF_ACCESS_CLIENT_SECRET=
```

Local dev against the VPS can use an SSH tunnel:

```bash
ssh -N -L 8108:127.0.0.1:8108 root@YOUR_VPS_IP
```

`TYPESENSE_API_KEY` must never be exposed to browser code.

Production secrets should be stored as API Worker secrets/vars in the deployment platform, not in `apps/web`, `NEXT_PUBLIC_*`, checked-in files, browser code, or public logs.

Cloudflare Access service-token behavior:

- `X-TYPESENSE-API-KEY` is always sent to Typesense.
- If both `TYPESENSE_CF_ACCESS_CLIENT_ID` and `TYPESENSE_CF_ACCESS_CLIENT_SECRET` are configured, the API also sends `CF-Access-Client-Id` and `CF-Access-Client-Secret`.
- If only one Access var is configured, the API treats Typesense as not configured and returns `503 { "error": "typesense_not_configured" }`.
- The API never returns or logs these secret values.

## Search Request

The new API route builds a GET request with `URLSearchParams`:

```text
/collections/{TYPESENSE_COLLECTION_ALIAS}/documents/search
```

Parameters:

- `q`: user query, default `*`
- `query_by`: `event_title,caption,who_is_in_picture,people,keywords,category_name,fotokey`
- `filter_by`: built from request filters plus `status:=ACTIVE && visibility:=PUBLIC`
- `sort_by`: default `image_date_ts:desc,created_at_ts:desc`
- `facet_by`: `category_name,event_title,people,keywords`
- `per_page`: parsed `limit`, default 50, max 100
- `page`: parsed `page`, default 1

`AbortController` enforces `TYPESENSE_SEARCH_TIMEOUT_MS`, default 2500ms.

## Schema-Safe Fields

Searchable fields:

- `event_title`
- `caption`
- `who_is_in_picture`
- `people`
- `keywords`
- `category_name`
- `fotokey`

Facet/filter fields:

- `event_id`
- `event_title`
- `category_id`
- `category_name`
- `keywords`
- `people`
- `source`
- `status`
- `visibility`
- `image_date_ts`

Sort fields:

- `image_date_ts`
- `created_at_ts`
- `published_at_ts`
- `rank_score`

`who_is_in_picture` is indexed because public users search for named subjects directly. It is also parsed into `people`, but the full editorial string must remain searchable so parsing does not lose context.

`event_title` is the canonical title-like search field. It carries event/title context and avoids duplicating the same purpose through a generic `title` field.

`title` is not indexed and is not used in `query_by`. If a document still includes `title`, it is stored/display compatibility only. `headline` follows the same compatibility-only rule unless a future schema PR explicitly adds it.

## V2 Collection Migration

Safe migration flow:

1. Create `public_assets_20260519_v2` with the corrected schema.
2. Reindex public assets into `public_assets_20260519_v2`.
3. Validate search manually against the concrete v2 collection.
4. Swap alias `public_assets_current` to `public_assets_20260519_v2`.
5. Keep `public_assets_20260519` in place for comparison and rollback. Do not delete it in this PR.

The alias keeps the API stable: it continues to query `/collections/public_assets_current/documents/search` while operators can swap the backing collection after validation. Future frontend cutover should happen only after the v2 collection is indexed, validated, and aliased.

The corrected v2 schema includes these indexed/searchable/facet fields:

```ts
{ name: "event_title", type: "string", facet: true, optional: true }
{ name: "caption", type: "string", optional: true }
{ name: "who_is_in_picture", type: "string", optional: true }
{ name: "people", type: "string[]", facet: true, optional: true }
{ name: "keywords", type: "string[]", facet: true, optional: true }
{ name: "category_name", type: "string", facet: true, optional: true }
{ name: "fotokey", type: "string", optional: true }
```

## Filter Mapping

Supported query params:

- `q`: Typesense `q`
- `eventId` or `event` (UUID): `event_id:=...`
- `event` (name): `event_title:=...`
- `categoryId` or `category` (UUID): `category_id:=...`
- `category` (name): `category_name:=...`
- `city`: `event_location:=...`
- `person`: `people:=...`
- `keyword`: `keywords:=...`
- `year`: Unix timestamp range over `image_date_ts`
- `month`: Unix timestamp range over `image_date_ts`, requires `year`
- `limit`: `per_page`
- `page`: `page`
- `sort`: `newest`, `oldest`, or `relevance`

All searches always include:

```text
status:=ACTIVE && visibility:=PUBLIC
```

## Pagination And Counts

Typesense page pagination is used:

- `limit` maps to `per_page`
- `page` maps to `page`
- `totalCount` maps from Typesense `found`
- `meta.outOf` maps from Typesense `out_of` when returned
- `hasMore` is calculated as `page * limit < totalCount`

## Response Shape

The API returns:

```ts
{
  items: PublicAssetDto[],
  totalCount: number,
  page: number,
  limit: number,
  hasMore: boolean,
  facets: {
    categories: Array<{ name: string; assetCount: number }>,
    events: Array<{ name: string; assetCount: number }>,
    people: Array<{ name: string; assetCount: number }>,
    keywords: Array<{ name: string; assetCount: number }>
  },
  meta: {
    source: "typesense",
    searchTimeMs?: number,
    outOf?: number
  }
}
```

Items are mapped close to the existing public asset DTO:

- `id`
- `fotokey`
- `headline`
- `caption`
- `whoIsInPicture`
- `keywords`
- `imageDate`
- `createdAt`
- `updatedAt`
- `status`
- `visibility`
- `mediaType`
- `source`
- `category`
- `event`
- `contributor`
- `previews.thumb`
- `previews.card`
- `previews.detail` only when available

Stored preview URL fields are used directly from Typesense documents:

- `preview_thumb_url`
- `preview_card_url`
- `preview_detail_url`

Missing stored fields map to `null` instead of throwing.

## Error Behavior

Missing Typesense env vars return:

```json
{ "error": "typesense_not_configured" }
```

with HTTP 503.

Typesense request failure or timeout returns:

```json
{ "error": "typesense_search_failed" }
```

with HTTP 502.

Safe logs include:

- route
- durationMs
- status
- statusCode
- q
- page
- limit
- timeout flag
- upstream status code when available

The Typesense API key is never logged.

## Files Changed

- `apps/api/src/lib/search/typesense-public-assets.ts`
- `apps/api/src/routes/public/catalog-routes.ts`
- `apps/api/src/appTypes.ts`
- `apps/api/.dev.vars.example`
- `apps/web/src/app/api/public/[...path]/route.ts`
- `context/architecture.md`
- `context/progress-tracker.md`
- `apps/api/docs/api-routing-audit.md`
- `docs/db-revamp/media-pipeline-operations.md`

## Why Existing Routes Are Not Replaced Yet

This PR adds a parallel route so the Typesense response shape, operational access, and index quality can be validated before any frontend or public contract cutover. SQL-backed `/api/v1/assets` and `/api/v1/assets/filters` remain unchanged and remain the production public search/list path until a later scoped PR.

## Verification Commands

Static check:

```bash
pnpm --dir apps/api check
```

Dry index into v2:

```bash
pnpm --dir apps/api typesense:index-public-assets -- \
  --collection public_assets_20260519_v2 \
  --batch-size 100 \
  --limit 1000 \
  --dry-run
```

Real 1,000-doc test index into v2:

```bash
pnpm --dir apps/api typesense:index-public-assets -- \
  --collection public_assets_20260519_v2 \
  --batch-size 100 \
  --limit 1000
```

Local dev with SSH tunnel:

```bash
ssh -N -L 8108:127.0.0.1:8108 root@YOUR_VPS_IP
```

Manual Typesense validation:

```bash
curl -G "http://127.0.0.1:8108/collections/public_assets_current/documents/search" \
  -H "X-TYPESENSE-API-KEY: ${TYPESENSE_API_KEY}" \
  --data-urlencode "q=*" \
  --data-urlencode "query_by=event_title,caption,who_is_in_picture,people,keywords,category_name,fotokey" \
  --data-urlencode "filter_by=status:=ACTIVE && visibility:=PUBLIC" \
  --data-urlencode "sort_by=created_at_ts:desc" \
  --data-urlencode "facet_by=category_name,event_title,people,keywords" \
  --data-urlencode "per_page=10" \
  --data-urlencode "page=1"
```

Manual validation before alias swap can target the concrete v2 collection:

```bash
curl -G "http://127.0.0.1:8108/collections/public_assets_20260519_v2/documents/search" \
  -H "X-TYPESENSE-API-KEY: ${TYPESENSE_API_KEY}" \
  --data-urlencode "q=*" \
  --data-urlencode "query_by=event_title,caption,who_is_in_picture,people,keywords,category_name,fotokey" \
  --data-urlencode "filter_by=status:=ACTIVE && visibility:=PUBLIC" \
  --data-urlencode "sort_by=created_at_ts:desc" \
  --data-urlencode "facet_by=category_name,event_title,people,keywords" \
  --data-urlencode "per_page=10" \
  --data-urlencode "page=1"
```

Alias swap after validation:

```bash
curl -X PUT "http://127.0.0.1:8108/aliases/public_assets_current" \
  -H "X-TYPESENSE-API-KEY: ${TYPESENSE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"collection_name":"public_assets_20260519_v2"}'
```

New API endpoint validation:

```bash
curl -s "http://127.0.0.1:8787/api/v1/search/assets?q=*&limit=10&page=1" | jq '{totalCount, count: (.items | length), facets, meta}'
```

BFF validation:

```bash
curl -s "http://localhost:3000/api/public/search/assets?q=*&limit=10&page=1" | jq '{totalCount, count: (.items | length), facets, meta}'
```

Smoke script validation:

```bash
pnpm --dir apps/api search:smoke-typesense
```

Local Typesense validation:

```bash
TYPESENSE_HOST=http://127.0.0.1:8108 \
pnpm --dir apps/api search:smoke-typesense
```

Cloudflare Tunnel + Access validation:

```bash
TYPESENSE_HOST=https://search.fotocorp.com \
TYPESENSE_CF_ACCESS_CLIENT_ID=... \
TYPESENSE_CF_ACCESS_CLIENT_SECRET=... \
pnpm --dir apps/api search:smoke-typesense
```

Validate from the VPS:

```bash
curl -G "http://127.0.0.1:8108/collections/public_assets_current/documents/search" \
  -H "X-TYPESENSE-API-KEY: ${TYPESENSE_API_KEY}" \
  --data-urlencode "q=*" \
  --data-urlencode "query_by=event_title,caption,who_is_in_picture,people,keywords,category_name,fotokey" \
  --data-urlencode "filter_by=status:=ACTIVE && visibility:=PUBLIC" \
  --data-urlencode "sort_by=created_at_ts:desc" \
  --data-urlencode "facet_by=category_name,event_title,people,keywords" \
  --data-urlencode "per_page=10" \
  --data-urlencode "page=1"
```

Validate from local dev against the VPS:

```bash
ssh -N -L 8108:127.0.0.1:8108 root@YOUR_VPS_IP
TYPESENSE_HOST=http://127.0.0.1:8108 pnpm --dir apps/api search:smoke-typesense
```

Validate from the deployed Worker after Tunnel + Access are configured:

```bash
curl -s "https://YOUR_API_WORKER_HOST/api/v1/search/assets?q=*&limit=10&page=1" \
  | jq '{totalCount, count: (.items | length), facets, meta}'
```

## Verification Notes From This PR

- `pnpm --dir apps/api check` passed locally.
- Dry index into `public_assets_20260519_v2` succeeded for 1,000 candidate documents without writing to Typesense.
- Real 1,000-document index into `public_assets_20260519_v2` succeeded; the indexer created the v2 collection and imported 10 batches of 100 with zero row failures.
- Manual v2 validation using `q=Paris Hilton` and corrected `query_by=event_title,caption,who_is_in_picture,people,keywords,category_name,fotokey` returned results with `who_is_in_picture` matches.
- Alias swap succeeded: `public_assets_current` now points to `public_assets_20260519_v2`.
- Post-swap alias validation returned v2 results through `public_assets_current`.
- Local API endpoint validation could not run because no API dev server was listening on `127.0.0.1:8787` in this environment.
- PR-4 added optional Cloudflare Access service-token headers for outbound Typesense fetches and a `pnpm --dir apps/api search:smoke-typesense` smoke command.
- Local smoke with `TYPESENSE_HOST=http://127.0.0.1:8108` passed against `public_assets_current` with `found=248538` and 10 returned hits.
- Tunnel + Access smoke was not run in this environment because production `https://search.fotocorp.com` service-token values were not provided here.

## Changelog

- Added dedicated operator runbook: [`../typesense-cloudflare-access-runbook.md`](../typesense-cloudflare-access-runbook.md). The runbook is now the canonical place for Typesense, Cloudflare Tunnel, Cloudflare Access Service Auth, validation commands, operational lessons, and security warnings.
