# Media Derivative Generation

`apps/api` owns watermarked preview generation. Originals and previews are intentionally split across two R2 buckets:

- Originals bucket: `CLOUDFLARE_R2_ORIGINALS_BUCKET` (`fotocorp-2026-megafinal`)
- Preview bucket: `CLOUDFLARE_R2_PREVIEWS_BUCKET`

Original images are read by this Node script only. Public preview routes read only watermarked derivatives from the Worker `PREVIEW_BUCKET` binding.

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
   - Generates `thumb`, `card`, and `detail` WebP derivatives.
   - Writes watermarked derivatives to `CLOUDFLARE_R2_PREVIEWS_BUCKET`.
   - Upserts `asset_media_derivatives`.

4. Public API listing
   - Shows assets through signed API preview URLs.
   - Does not expose original keys, derivative keys, bucket names, or R2 URLs.

5. Preview delivery
   - Browser receives a signed API URL.
   - API validates token and DB state.
   - API reads the derivative from the preview bucket.
   - Original bytes never touch the browser.

## Idempotency

By default, the generator skips a derivative only when the DB row is `READY`, watermarked, uses the current watermark profile, and the object exists in the preview bucket. This avoids redoing already-good work while catching the previous failure mode where DB rows were `READY` but R2 objects were missing.

Use `--skip-ready-head-check` only when you intentionally trust existing `READY` rows and want to avoid HEAD checks.

The script may GET original objects and PUT derivative objects. It does not delete, move, rename, copy, overwrite, or mutate original R2 objects.

## Commands

Generate a 100-image smoke batch:

```bash
pnpm --dir apps/api run media:generate-derivatives -- \
  --limit 100 \
  --batch-size 25 \
  --variants thumb,card,detail
```

Generate 10k watermarked assets:

```bash
pnpm --dir apps/api run media:generate-derivatives -- \
  --limit 10000 \
  --batch-size 25 \
  --variants thumb,card,detail
```

Continue after first 10k using offset:

```bash
pnpm --dir apps/api run media:generate-derivatives -- \
  --offset 10000 \
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

Regenerate rows whose DB state is ready but preview objects are missing:

```bash
pnpm --dir apps/api run media:generate-derivatives -- \
  --limit 1000 \
  --batch-size 25 \
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
previews/watermarked/<variant>/<asset-id>.webp
```

All generated derivatives use `watermark_profile = fotocorp_tiled_v1`, are stored as `image/webp`, and are marked `is_watermarked = true`.
