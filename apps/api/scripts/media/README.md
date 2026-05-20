# Media Derivative Generation

`apps/api` owns WebP preview generation for public/staff surfaces. Originals and previews are intentionally split across two R2 buckets:

- Originals bucket: `CLOUDFLARE_R2_ORIGINALS_BUCKET` (`fotocorp-2026-megafinal`)
- Preview bucket: `CLOUDFLARE_R2_PREVIEWS_BUCKET`

Original images are read by this Node script only. Public preview routes read derivatives from the Worker `PREVIEW_BUCKET` binding.

Shared renderer: `@fotocorp/media-preview` (`packages/media-preview/`).

## Variants and watermarking

| Variant | Protection | `image_derivatives.is_watermarked` | Stored `watermark_profile` | R2 key prefix |
|---------|------------|------------------------------------|----------------------------|---------------|
| `thumb` | Light diagonal `fotocorp` | `true` | `fotocorp_thumb_light_preview_v1` | `previews/watermarked/thumb/...` |
| `card` | Diagonal + lower-right strip | `true` | `fotocorp_card_light_preview_v1` | `previews/watermarked/card/...` |
| `detail` | Tab + diagonal + strip | `true` | `fotocorp_detail_preview_v1` | `previews/watermarked/detail/...` |

The folder segment `previews/watermarked/...` is unchanged for URL stability; only bytes and DB metadata change during migration.

## Pipeline

1. Import/mapping — legacy import maps assets; does not generate images.
2. R2 check — `media:verify-r2-originals` sets `original_exists_in_storage`.
3. Derivative generation — reads originals, writes WebP to `previews/watermarked/<variant>/...`, upserts `image_derivatives`.
4. Public API — signed or CDN preview URLs; never exposes R2 keys to the browser.

## Idempotency

Skips when DB row is `READY` with the expected profile and `is_watermarked = true` for that variant. Use `--force` to overwrite R2 objects and refresh rows.

## Commands

Mac pilot (100 assets):

```bash
pnpm --dir apps/api run media:generate-derivatives -- --scope all-verified --variants thumb,card,detail --force --limit 100 --batch-size 25 --asset-concurrency 2 --upload-concurrency 4
```

Windows shard 0 (repeat `--shard-index` 0–4, same `--shard-count 5`):

```bash
pnpm --dir apps/api run media:generate-derivatives -- --scope all-verified --variants thumb,card,detail --force --shard-count 5 --shard-index 0 --batch-size 50 --asset-concurrency 1 --upload-concurrency 3 --report-file logs/derivative-shard-0-report.json
```

Status:

```bash
pnpm --dir apps/api media:pipeline-status
```

Dry run:

```bash
pnpm --dir apps/api run media:generate-derivatives -- --dry-run --limit 10 --variants thumb,card,detail
```

## R2 safety

Originals: `FC0101072.jpg` at bucket root. Derivatives:

```text
previews/watermarked/<variant>/<object-id>.webp
```
