# Media Derivative Generation

`apps/api` owns WebP preview generation for public/staff surfaces. Originals and previews are intentionally split across two R2 buckets:

- Originals bucket: `CLOUDFLARE_R2_ORIGINALS_BUCKET` (`fotocorp-2026-megafinal`)
- Preview bucket: `CLOUDFLARE_R2_PREVIEWS_BUCKET`

Original images are read by this Node script only. Public preview routes read derivatives from the Worker `PREVIEW_BUCKET` binding.

## Variants and watermarking

| Variant | Watermark on pixels | `image_derivatives.is_watermarked` | Stored `watermark_profile` (examples) | R2 key prefix (unchanged) |
|---------|---------------------|------------------------------------|---------------------------------------|---------------------------|
| `thumb` | No (clean) | `false` | `fotocorp-thumb-clean-v1` | `previews/watermarked/thumb/...` |
| `card` | No (clean) | `false` | `fotocorp-card-clean-v1` | `previews/watermarked/card/...` |
| `detail` | Yes (tiled profile) | `true` | `fotocorp-preview-v4-dense-dark-lowquality` (detail; do not rename casually) | `previews/watermarked/detail/...` |

The **folder name** `previews/watermarked/...` is intentionally unchanged for all variants so public URLs, BFF routes, and clients keep working during migration; only the bytes and DB flags/profiles reflect clean vs watermarked.

## Pipeline

1. Import/mapping
   - Legacy metadata import creates asset rows and maps `assets.r2_original_key`.
   - It does not generate images.
   - It does not upload images.

2. R2 check
   - Import/reconciliation checks whether original objects exist in the originals bucket.
   - It updates `assets.r2_exists`.
   - It should run in chunks.

3. Derivative generation
   - Reads originals from `CLOUDFLARE_R2_ORIGINALS_BUCKET`.
   - Generates `thumb`, `card`, and `detail` WebP derivatives (`thumb` and `card` clean; `detail` watermarked).
   - Writes objects to `CLOUDFLARE_R2_PREVIEWS_BUCKET` under `previews/watermarked/<variant>/...` (same paths as before).
   - Upserts `image_derivatives` with `is_watermarked` matching the table above.

4. Public API listing
   - Shows assets through signed API preview URLs.
   - Does not expose original keys, derivative keys, bucket names, or R2 URLs.

5. Preview delivery
   - Browser receives a signed API URL.
   - API validates token and DB state (including per-variant watermark expectations).
   - API reads the derivative from the preview bucket.
   - Original bytes never touch the browser.

## Idempotency

By default, the generator skips a derivative only when the DB row is `READY`, uses the **expected profile for that variant**, and **`is_watermarked` matches the variant** (`false` for thumb and card; `true` for detail). This avoids redoing already-good work while catching failed or legacy rows (for example card rows still marked watermarked).

The script may GET original objects and PUT derivative objects. It does not delete originals. For **thumb/card** regeneration it **overwrites** the existing object at the same key (no delete-first).

## Commands

Regenerate **thumb and/or card** (dry run, then real); use `--force` to overwrite existing objects and refresh DB rows. Omit `detail` unless you intend to regenerate watermarked detail:

```bash
pnpm --dir apps/api run media:generate-derivatives -- \
  --dry-run --force --variants thumb,card --limit 50

pnpm --dir apps/api run media:generate-derivatives -- \
  --force --variants thumb,card --limit 10 --batch-size 5 --asset-concurrency 2 --upload-concurrency 4
```

Regenerate **thumbs only** (subset of the above):

```bash
pnpm --dir apps/api run media:generate-derivatives -- \
  --dry-run --force --variants thumb --limit 50

pnpm --dir apps/api run media:generate-derivatives -- \
  --force --variants thumb --limit 10 --batch-size 5 --asset-concurrency 2 --upload-concurrency 4
```

Generate a 100-image smoke batch (all variants):

```bash
pnpm --dir apps/api run media:generate-derivatives -- \
  --limit 100 \
  --batch-size 25 \
  --variants thumb,card,detail
```

Larger backfill (all variants):

```bash
pnpm --dir apps/api run media:generate-derivatives -- \
  --limit 10000 \
  --batch-size 25 \
  --variants thumb,card,detail
```

Dry run:

```bash
pnpm --dir apps/api run media:generate-derivatives -- \
  --dry-run \
  --limit 10 \
  --batch-size 5 \
  --variants thumb,card,detail
```

Generate all variants for one asset:

```bash
pnpm --dir apps/api run media:generate-derivatives -- \
  --asset-id <uuid> \
  --variants thumb,card,detail
```

## R2 Safety

Originals live at the root of the originals bucket, for example `FC0101072.jpg`. Generated derivatives are written to:

```text
previews/watermarked/<variant>/<object-id>.webp
```

Per-variant **`watermark_profile`** and **`is_watermarked`** must match the table in [Variants and watermarking](#variants-and-watermarking) (thumb/card clean profiles vs detail tiled profile). Storage remains `image/webp`.
