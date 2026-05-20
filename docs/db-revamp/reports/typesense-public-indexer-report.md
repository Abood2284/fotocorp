# Typesense Public Indexer Report

## Scope

PR-1 added a rebuild-only Typesense indexing script for current public searchable image assets. PR-3 corrects the searchable schema contract before frontend cutover. It does not replace `/api/v1/assets`, `/api/v1/assets/filters`, or any web search route.

## Files

- `apps/api/scripts/search/index-public-assets-typesense.ts`
- `apps/api/package.json`
- `apps/api/.dev.vars.example`

## Current Source Of Truth

Neon/Postgres remains the source of truth. The script reads from clean catalog tables and upserts documents into a Typesense collection or alias. When a concrete collection is supplied with `--collection`, real runs ensure that collection exists with the corrected v2 public asset schema before importing. Dry-runs do not create collections or write to Typesense.

Default collection target comes from:

```env
TYPESENSE_COLLECTION_ALIAS=public_assets_current
```

Current migration target:

```text
public_assets_20260519_v2
```

The public alias remains:

```text
public_assets_current
```

## Eligibility

The indexer matches the current public list gate as closely as possible:

- `image_assets.status = 'ACTIVE'`
- `image_assets.visibility = 'PUBLIC'`
- `image_assets.media_type = 'IMAGE'`
- `image_assets.original_exists_in_storage = true`
- required `CARD` row in `image_derivatives`
- `CARD.generation_status = 'READY'`
- `CARD.is_watermarked = false`
- `CARD.watermark_profile = CARD_CLEAN_PROFILE`

Optional `THUMB` and `DETAIL` derivatives are included only when they match current public profile rules.

## Query Shape

The script uses keyset pagination by `image_assets.id`, not `OFFSET`.

It joins:

- `image_assets`
- required `image_derivatives` `CARD`
- optional `image_derivatives` `THUMB`
- optional `image_derivatives` `DETAIL`
- `photo_events`
- `asset_categories` for asset category and event fallback category
- `contributors`

## Document Mapping

Each document includes asset identity, metadata, normalized keyword arrays, derived people names, event/category/contributor fields, public status fields, Unix-second timestamps, preview URLs, preview storage keys, and preview dimensions.

PR-5 also emits `city` from `photo_events.location` so the search API can return city facets from Typesense without calling the SQL filters endpoint.

The v2 indexed/searchable fields are:

```text
event_title
caption
who_is_in_picture
people
keywords
category_name
fotokey
```

`who_is_in_picture` is indexed because it is the user-facing editorial field for named subjects and needs to be directly searchable, not only parsed into `people`.

`event_title` is the canonical title-like search field for this collection. It carries the event/title context users search by.

`title` may still be emitted as a stored compatibility/display field using this fallback order, but it is not part of the v2 indexed schema and is not used in `query_by`:

```text
headline -> who_is_in_picture -> event.name -> caption snippet -> fotokey -> asset.id
```

`headline` may also be emitted as a stored compatibility/display field. It is not indexed in v2.

`people` is derived from `who_is_in_picture` using comma, semicolon, pipe, and newline splitting. If parsing would collapse the value too aggressively, the full original value is preserved.

Preview URLs prefer `PUBLIC_PREVIEW_CDN_BASE_URL` plus `image_derivatives.storage_key`. Without CDN config, they use the stable public preview path style:

```text
/api/media/assets/:assetId/preview/:variant
```

## Environment

Required:

```env
DATABASE_URL=
TYPESENSE_HOST=http://127.0.0.1:8108
TYPESENSE_API_KEY=change-me
TYPESENSE_COLLECTION_ALIAS=public_assets_current
```

Optional:

```env
PUBLIC_PREVIEW_CDN_BASE_URL=https://media.fotocorp.com
PUBLIC_PREVIEW_CDN_VERSION=v1
```

## V2 Collection Migration

Safe flow:

1. Create the new v2 collection with corrected schema.
2. Reindex public assets into the new collection.
3. Validate search manually against the concrete v2 collection.
4. Swap alias `public_assets_current` to the new collection.
5. Keep the old collection for rollback/inspection; do not delete it in this PR.

The indexer creates the concrete collection automatically on real runs when `--collection public_assets_20260519_v2` is supplied and the collection does not already exist.

The old collection is not deleted immediately so operators can compare counts/search behavior and roll the alias back if needed.

## Commands

```bash
pnpm --dir apps/api check
pnpm --dir apps/api typesense:index-public-assets -- --collection public_assets_20260519_v2 --batch-size 100 --limit 1000 --dry-run
pnpm --dir apps/api typesense:index-public-assets -- --collection public_assets_20260519_v2 --batch-size 100 --limit 1000
```

Manual validation against the v2 collection:

```bash
curl -G "http://127.0.0.1:8108/collections/public_assets_20260519_v2/documents/search" \
  -H "X-TYPESENSE-API-KEY: ${TYPESENSE_API_KEY}" \
  --data-urlencode "q=*" \
  --data-urlencode "query_by=event_title,caption,who_is_in_picture,people,keywords,category_name,fotokey" \
  --data-urlencode "filter_by=status:=ACTIVE && visibility:=PUBLIC" \
  --data-urlencode "sort_by=created_at_ts:desc" \
  --data-urlencode "facet_by=category_name,event_title,city,source" \
  --data-urlencode "per_page=10" \
  --data-urlencode "page=1"
```

Swap alias after validation:

```bash
curl -X PUT "http://127.0.0.1:8108/aliases/public_assets_current" \
  -H "X-TYPESENSE-API-KEY: ${TYPESENSE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"collection_name":"public_assets_20260519_v2"}'
```

## Risks / Notes

- `title` is stored only for compatibility/display if emitted; it must not be queried or indexed in v2.
- The indexer creates a concrete collection only when `--collection` is supplied. Default alias imports assume the alias already exists.
- It does not delete stale Typesense documents; this PR only bulk upserts current eligible public assets.
- The public API and web search still read Postgres in this PR.
- The frontend cutover must wait until the v2 collection is indexed, validated, and the alias is swapped.

## PR-3 Verification Notes

- `pnpm --dir apps/api check` passed.
- Dry index into `public_assets_20260519_v2` succeeded for 1,000 candidate documents.
- Real 1,000-document index into `public_assets_20260519_v2` succeeded and created the v2 collection.
- Manual search for `Paris Hilton` against `public_assets_20260519_v2` returned `who_is_in_picture` hits using the corrected `query_by`.
- Alias `public_assets_current` was swapped to `public_assets_20260519_v2` and validated after the swap.
