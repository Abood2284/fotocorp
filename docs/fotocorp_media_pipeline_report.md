# Fotocorp Media Pipeline Decision Report

**Date:** 30 April 2026  
**Project:** Fotocorp stock-image marketplace  
**Current decision stage:** Secure media pipeline, database branch strategy, and preview derivative storage before scaling beyond test batches.

---

## 1. Executive decision

Do **not** move the Neon production branch yet.

Stay on the current development Neon branch until the schema, secure preview route, derivative generation, admin media views, and public catalog behavior are stable. The schema is still moving, so switching the production branch now would create avoidable pain.

Do create the separate preview bucket **now**, before generating more watermarked derivatives. This is the right time because only a small number of derivative objects exist today. Later, after thousands or millions of preview objects exist, cleanup becomes annoying and risky.

Recommended target setup:

| Storage area | Purpose | Public? | Notes |
|---|---:|---:|---|
| `fotocorp-2026-megafinal` | Original high-resolution assets | No | Treat as production original archive. Never expose direct keys or URLs to the browser. |
| `fotocorp-2026-previews` | Watermarked preview derivatives | No | API reads from this bucket through Worker binding only. Browser still receives only signed API URLs. |

The production-grade flow should be:

```text
Original image in private R2 originals bucket
        ↓
DB asset row maps original key + metadata
        ↓
Derivative generator reads original privately
        ↓
Generator writes watermarked thumb/card/detail WebP previews to private preview bucket
        ↓
DB stores derivative metadata only: variant, width, height, mime, r2_key, status, watermark_profile
        ↓
Public API returns signed relative preview URLs only
        ↓
Media route validates token + asset status + derivative status
        ↓
API streams only watermarked preview bytes from preview bucket
```

Original files must never be streamed by public preview routes. No frontend code should ever know `r2_original_key`, derivative `r2_key`, bucket names, R2 endpoint URLs, or media secrets.

---

## 2. Current tested state

Latest DB status shared from the development branch:

| Metric | Count |
|---|---:|
| Total imported assets | 1,000 |
| Assets mapped to R2 | 999 |
| Card previews READY | 25 |
| Detail previews READY | 25 |
| Thumb previews READY | 25 |

What this means:

- The importer is working for test batches.
- R2 mapping is mostly working; one asset out of the first 1,000 is not mapped or not found.
- The derivative generator works, but only 25 assets currently have generated preview variants.
- The website can only show images that pass the public API conditions: `APPROVED`, `PUBLIC`, `IMAGE`, `r2_exists=true`, and READY watermarked derivatives.

That is why seeing only a small number of images is expected at this stage. If the homepage is showing only one image even though 25 card previews are READY, that is a separate frontend layout/query issue, not the media security pipeline itself.

---

## 3. Important security note

Live-looking credentials were pasted during debugging. Treat them as exposed.

Before production or client-facing deployment, rotate:

- Neon database password / connection string.
- Cloudflare R2 access key ID and secret access key.
- Any preview-token secret used outside local development.

Also replace placeholder secrets like `MEDIA_PREVIEW_TOKEN_SECRET=replace-with-local-preview-token-secret` with strong random values per environment.

This is not optional for a stock media platform. The whole product is built around protecting paid media.

---

## 4. Why there are multiple scripts

There are different scripts because each script owns one separate responsibility. That is good architecture. One giant magic script would be harder to debug and more dangerous.

### 4.1 Uploading originals to R2

**Purpose:** Move original high-resolution files from local/hard-drive storage into Cloudflare R2.

Typical tool: `rclone` or equivalent bulk uploader.

What it does:

- Uploads original image files.
- Preserves original filenames/keys.
- Does not create DB rows by itself.
- Does not watermark.
- Does not make files public.

Status in this project:

- The large bucket already contains hundreds of thousands of original objects.
- These are production-value assets and should be treated carefully.

### 4.2 Legacy importer: `pnpm legacy:import`

**Purpose:** Map legacy database/file metadata into the new Fotocorp database.

Example command:

```bash
pnpm legacy:import -- --only assets --skip-r2-check --offset 0 --limit 1000 --batch-size 1000 --default-ext jpg
```

What it does:

- Reads legacy CSV/JSONL exports.
- Creates or updates new DB rows such as assets, categories, events, and photographers.
- Links each DB asset to the expected R2 original key.
- Can run in chunks with `--offset`, `--limit`, and `--batch-size`.
- Can skip R2 verification for speed using `--skip-r2-check`.

What it does **not** do:

- It does not watermark images.
- It does not create previews.
- It does not upload originals.
- It should not expose R2 keys to the frontend.

### 4.3 R2 verification during import/checking

**Purpose:** Confirm whether the original object actually exists in R2.

What it does:

- Performs read-only object existence checks, usually HEAD-style checks.
- Updates DB mapping confidence such as `r2_exists=true`.
- Finds missing or mismatched objects.

Why not always run it with import:

- It slows the importer.
- It creates extra R2 operations.
- It is easier to run verification in separate chunks after mapping.

Recommended workflow:

```text
Fast DB mapping first
        ↓
R2 verification in controlled chunks
        ↓
Derivative generation only for verified mapped assets
```

### 4.4 Watermarked derivative generator: `pnpm media:generate-derivatives`

**Purpose:** Create safe public-preview versions of original images.

Example command:

```bash
pnpm media:generate-derivatives -- --limit 25 --batch-size 10 --variants thumb,card,detail
```

What it does:

- Selects eligible assets from DB.
- Reads private originals from R2.
- Generates resized WebP preview variants.
- Applies tiled Fotocorp watermark.
- Writes generated preview objects to R2.
- Writes/updates derivative metadata in `asset_media_derivatives`.

Current derivative key format:

```text
previews/watermarked/<variant>/<asset-id>.webp
```

Recommended final bucket behavior:

```text
Originals bucket:
  FC0101072.jpg
  FC0101073.jpg
  ...

Previews bucket:
  previews/watermarked/thumb/<asset-id>.webp
  previews/watermarked/card/<asset-id>.webp
  previews/watermarked/detail/<asset-id>.webp
```

### 4.5 Preview token checker: `pnpm check:preview-token`

**Purpose:** Validate the HMAC signed-preview token behavior.

What it checks:

- Token signing works.
- Token expiry works.
- Asset ID tampering fails.
- Variant tampering fails.
- Invalid/malformed tokens fail.

This is a developer safety check, not a media processing pipeline.

### 4.6 Worker commands: `wrangler dev` and `wrangler deploy`

**Purpose:** Run or deploy the API Worker.

What happened during debugging:

- The remote Wrangler issue was not a media-code failure.
- Wrangler was trying to run remote mode and needed the correct Cloudflare account/subdomain setup.
- After deploying/registering a workers.dev subdomain, the Worker had access to the R2 binding and could serve preview bytes.

The deploy move was acceptable for debugging, but production deployment should wait until secrets are rotated and environments are cleaned up.

---

## 5. Are all steps necessary?

Yes, for the secure product we are building.

| Step | Necessary? | Why |
|---|---:|---|
| Upload originals to private R2 | Yes | R2 is the source of truth for image bytes. |
| Import/map legacy metadata to DB | Yes | Website search, filters, catalog pages, and admin all need DB records. |
| Verify R2 existence | Yes | Prevents broken previews and bad download promises. |
| Generate watermarked derivatives | Yes | Public browsing needs safe preview images without exposing originals. |
| Store derivative metadata | Yes | API needs to know which previews are READY and safe. |
| Signed preview URLs | Yes | Prevents random unauthenticated key scraping and replay abuse. |
| Admin dashboard | Yes | Needed to track import/generation progress, missing assets, failed derivatives, and approvals. |
| Full original download entitlement | Yes, later | Only subscribers/authorized purchases should get original/high-res access. |

Optional later features:

- AI/semantic image search.
- Duplicate detection.
- Face/object tagging.
- Contributor/caption-writer workflows.
- Video pipeline.

---

## 6. Should watermarked previews be stored in another R2 bucket?

Yes.

Technically, same bucket with prefixes can work. But for this project, separate buckets are cleaner and safer.

Recommended split:

- Originals bucket: only original high-resolution files.
- Previews bucket: only generated watermarked derivatives.

Benefits:

- Cleaner mental model.
- Easier cleanup if watermarking logic changes.
- Safer access boundaries.
- Easier lifecycle rules later.
- Cleaner future analytics and storage estimates.
- Lower chance of accidentally serving original objects from the preview route.

The preview bucket should still be private. Do not make it public. The browser should still go through the API route with signed tokens.

---

## 7. Will generating 700k assets bankrupt the project?

No, not if the pipeline is written correctly.

The expensive mistake would be regenerating the same derivatives repeatedly or reading originals multiple times unnecessarily.

Expected scale:

```text
700,000 assets × 3 preview variants = 2,100,000 preview objects
```

Operation behavior if implemented well:

- Read each original once.
- Generate all requested variants in memory from that original.
- Upload three preview objects.
- Write DB derivative rows.
- Skip already READY derivatives unless `watermark_profile` changes or `--force` is provided.

Cost-sensitive rules:

- Skip derivative if READY already exists with the same watermark profile.
- Only regenerate if `watermark_profile` changes.
- Only regenerate missing or FAILED variants by default.
- Use `--limit` and `--batch-size`.
- Avoid one giant unbounded run.
- Avoid checking R2 existence during every derivative run if already verified.
- Track progress with DB counts instead of guessing from terminal logs.

R2 pricing is mainly storage plus operation classes. The operation cost for one well-written first pass should be relatively small compared with the value of the project. Storage cost depends on final preview sizes, but WebP derivatives should usually be far smaller than originals.

---

## 8. Neon branch decision

Do not switch to production Neon yet.

Use the current development branch as the working integration branch **only if it is intended to become the production data source later**.

That means:

- Keep importing/mapping there.
- Keep generating derivative DB rows there.
- Keep migrations clean.
- Keep records consistent with the R2 buckets.
- Take snapshots/backups before large runs.

Later, when schema is stable:

### Preferred cutover strategy

```text
Development branch becomes the validated production candidate
        ↓
Freeze schema changes temporarily
        ↓
Run count/integrity checks
        ↓
Rotate secrets and configure production env
        ↓
Promote/copy/restore the validated branch as production
        ↓
Point deployed API/web to production DATABASE_URL
```

This avoids rerunning full import and watermark generation from zero.

### Risky strategy to avoid

```text
Run 700k import + 2.1M previews on development
        ↓
Throw away development branch
        ↓
Try to rebuild production manually
```

That is how teams create a self-inflicted boss fight.

---

## 9. Immediate next PRs

### PR 1 — Separate originals and previews buckets

Goal: Make storage boundaries production-grade before generating more derivatives.

Required changes:

- Add a new private R2 bucket: `fotocorp-2026-previews`.
- Keep `fotocorp-2026-megafinal` as originals bucket.
- Rename Worker bindings clearly:
  - `ORIGINALS_BUCKET` or equivalent for originals if the Worker ever needs original admin/download access.
  - `PREVIEWS_BUCKET` for public preview streaming.
- Preview route must read only from preview bucket.
- Derivative generator must read originals from originals bucket and write previews to previews bucket.
- Update env docs and `.dev.vars.example`.
- Do not expose either bucket publicly.

### PR 2 — Make derivative generator idempotent

Goal: Prevent duplicate work and runaway cost.

Required behavior:

- Skip READY derivatives if variant and `watermark_profile` already match.
- Regenerate only missing/FAILED variants by default.
- Add `--force` for intentional regeneration.
- Add `--watermark-profile` option or constant with clear versioning.
- Add progress summary at the end.
- Add dry-run output showing how many would be skipped/generated.

### PR 3 — Add media pipeline status command

Goal: One command to show current progress.

Output should include:

- Total assets.
- `r2_exists=true` assets.
- READY thumb/card/detail counts.
- FAILED derivative counts by variant.
- Missing derivative counts by variant.
- Assets eligible for public listing.
- Assets currently visible in `/api/v1/assets`.

### PR 4 — Fix homepage latest-images section

Goal: Homepage should show latest images, not category placeholders.

Expected behavior:

- Homepage pulls latest public assets from API.
- Shows as many images as the layout supports.
- Uses masonry/mosaic or editorial layout.
- Categories appear only in Explore Collections.
- Empty states should say previews are being prepared, not silently show fake category tiles.

### PR 5 — Admin media dashboard foundation

Goal: Admin can see pipeline progress without raw SQL.

Sections:

- Import status.
- R2 mapping status.
- Derivative generation status.
- Missing/failed previews.
- Recent imported assets.
- Safe rerun instructions.

---

## 10. Commands to run only after bucket split/idempotency PRs

First small test after preview bucket split:

```bash
pnpm media:generate-derivatives -- --limit 10 --batch-size 5 --variants thumb,card,detail
```

Then check counts:

```bash
node scripts/check-media-pipeline-status.js
```

Then expand safely:

```bash
pnpm media:generate-derivatives -- --limit 100 --batch-size 10 --variants thumb,card,detail
pnpm media:generate-derivatives -- --limit 1000 --batch-size 25 --variants thumb,card,detail
```

For the full run, use chunked execution and logs. Do not run one blind command for 700k assets without status tracking and resume safety.

---

## 11. Final recommendation

Current position:

- Keep Neon on development branch for now.
- Treat R2 originals bucket as production-grade storage.
- Create preview bucket now.
- Rotate leaked credentials before production exposure.
- Patch derivative script to be idempotent before generating more than the current test set.
- Do not continue frontend polishing until the homepage uses real latest images and the pipeline can create enough READY previews safely.

The order should be:

```text
1. Rotate secrets
2. Create separate private preview bucket
3. Patch code/env for originals vs previews bucket split
4. Patch derivative generator idempotency
5. Generate 100 previews and verify in browser
6. Generate 1,000 previews and verify counts/admin/public API
7. Fix homepage latest-image layout
8. Continue admin dashboard and subscriber download flows
9. Only then scale toward 700k
```

---

## 12. Reference notes

- Cloudflare R2 pricing is based on stored data plus operation classes. R2 also advertises zero egress fees from R2 storage.
- Cloudflare Workers can access R2 through R2 bucket bindings.
- Neon branches should be treated as environment/data boundaries; do not assume a test branch can be thrown away after doing production-scale import work.

