# Fotocorp API

`apps/api` owns Fotocorp backend business schema, import tooling, R2 reconciliation, derivative generation, and secure preview delivery.

## Local Media Binding Setup

The public Worker binds media buckets (see `wrangler.jsonc`):

- `MEDIA_PREVIEWS_BUCKET`: read-only watermarked derivative reads
- `MEDIA_ORIGINALS_BUCKET`: protected admin original-image reads
- `MEDIA_CONTRIBUTOR_UPLOADS_BUCKET`: contributor upload **staging** (opaque keys; optional binding for `HeadObject` verification; browser PUT uses presigned URLs against the same bucket **name** via S3 API)

Required environment:

- `DATABASE_URL`: API database connection
- `BETTER_AUTH_SECRET`: Better Auth signing/encryption secret
- `BETTER_AUTH_URL`: public web origin for Better Auth, for example `http://localhost:3000`
- `FOTOCORP_SUPER_ADMIN_EMAIL`: optional bootstrap email for the first super admin profile
- `MEDIA_PREVIEW_TOKEN_SECRET`: HMAC secret for signed preview URLs
- **Contributor direct uploads (presigned PUT)** — set on **this** Worker (`apps/api/.dev.vars` locally), not only on `apps/jobs`: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_CONTRIBUTOR_STAGING_BUCKET` (for example `fotocorp-2026-contributor-uploads`). Legacy aliases `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, and `CLOUDFLARE_R2_CONTRIBUTOR_UPLOADS_BUCKET` are still read if the `R2_*` names are unset. Restart `wrangler dev` after changing vars.
- `CLOUDFLARE_R2_ACCOUNT_ID` (alias of `R2_ACCOUNT_ID`): also used by Node scripts
- `CLOUDFLARE_R2_ACCESS_KEY_ID` / `CLOUDFLARE_R2_SECRET_ACCESS_KEY`: R2 keys for Node scripts
- `CLOUDFLARE_R2_REGION`: usually `auto`
- `CLOUDFLARE_R2_ORIGINALS_BUCKET` (alias `R2_ORIGINALS_BUCKET`): originals bucket, currently `fotocorp-2026-megafinal`
- `CLOUDFLARE_R2_PREVIEWS_BUCKET`: watermarked preview bucket

**R2 CORS:** for browser uploads, configure CORS on the **contributor staging** bucket to allow `PUT` from your web app origin (for example `http://localhost:3000` in dev). See `apps/api/.dev.vars.example` and `docs/db-revamp/reports/photographer-bulk-upload-backend-report.md`.

Do not use `CLOUDFLARE_R2_BUCKET` for new code; it is ambiguous now that originals and previews are split.

## Local dev with `apps/web`

The Next app proxies `/api/auth/*` to this Worker using `INTERNAL_API_BASE_URL` (see `apps/web/.env.example`, default `http://127.0.0.1:8787`). From the repo root, `pnpm dev` starts both; otherwise run `pnpm dev:api` here and `pnpm dev:web` in parallel. Align `BETTER_AUTH_SECRET`, `DATABASE_URL`, and `INTERNAL_API_SECRET` between `apps/api/.dev.vars` and `apps/web/.env.local`.

After pulling changes that add or rename Drizzle migrations under `apps/api/drizzle/`, apply them to the database your `DATABASE_URL` points at: `pnpm run db:migrate` from `apps/api`. If migrations are missing, contributor login and other clean-schema routes can return `500` with Postgres `relation ... does not exist`.

## Auth

Better Auth is mounted by the API Worker through Hono under:

```text
/api/auth/*
```

The enabled auth methods are email/password signup/sign-in and username sign-in. OAuth providers, magic links, anonymous auth, passkeys, and Google One Tap are not enabled. Email verification and password reset email delivery are intentionally left as TODOs until a production mailer is added.

Signup also enforces business email eligibility. The UX pre-check route is:

```text
POST /api/v1/auth/business-email/validate
```

That route is not the security boundary. The Better Auth `/sign-up/email` before hook calls the same validation service and blocks invalid, free, disposable, or no-MX domains unless an exact email/domain override allows them.

Fotocorp-specific registration fields are stored separately from Better Auth in `fotocorp_user_profiles`. The current signed-in user plus registration profile can be read from:

```text
GET /api/v1/auth/me
```

## Media Pipeline

1. Import/mapping
   - Legacy metadata creates asset records and maps `assets.r2_original_key`.
   - It does not generate images.
   - It does not upload images.

2. R2 check
   - Confirms whether original objects exist in the originals bucket.
   - Updates `assets.r2_exists`.
   - Runs in chunks.

3. Derivative generation
   - Reads originals from `CLOUDFLARE_R2_ORIGINALS_BUCKET`.
   - Generates `thumb`, `card`, and `detail` WebP previews (`thumb` and `card` clean; `detail` watermarked).
   - Writes WebP derivatives to `CLOUDFLARE_R2_PREVIEWS_BUCKET`.
   - Updates `image_derivatives` / `asset_media_derivatives` (see [scripts/media/README.md](./scripts/media/README.md)).

4. Public API listing
   - Shows only assets with signed API preview URLs.
   - Does not expose originals.

5. Preview delivery
   - Browser receives signed API URL.
   - API validates token and DB state.
   - API reads the derivative from `MEDIA_PREVIEWS_BUCKET`.
   - Original bytes never touch the browser.

## Secure Preview Route

Request previews through the API, not through a public bucket URL:

```text
GET /api/v1/media/assets/:assetId/preview?variant=thumb|card|detail&token=...
```

The secure preview API validates the token, asset status, visibility, original R2 mapping status, derivative readiness, per-variant watermark expectations (`thumb` and `card` clean; `detail` watermarked), and expected `watermark_profile` before reading from the preview bucket.

Notes:

- The secure preview API never serves original R2 objects.
- The secure preview API only serves records from `asset_media_derivatives`.
- Derivatives must be `READY` with metadata matching the variant (thumb/card `is_watermarked=false` with clean profiles; detail `is_watermarked=true` with the detail profile); missing derivatives return a safe 404.
- Legacy key-based media routes are disabled so callers cannot request arbitrary R2 object keys.
- No API route writes, moves, copies, renames, or deletes R2 objects.

## Preview derivatives (generator)

**Thumb** and **card** are **unwatermarked** but stay under `previews/watermarked/thumb/` and `previews/watermarked/card/` for URL stability. **Detail** stays watermarked under `previews/watermarked/detail/`.

Generate a 100-image smoke batch:

```bash
pnpm --dir apps/api run media:generate-derivatives -- \
  --limit 100 \
  --batch-size 25 \
  --variants thumb,card,detail
```

Regenerate thumb/card only (overwrite objects + DB; use `--dry-run` first):

```bash
pnpm --dir apps/api run media:generate-derivatives -- \
  --dry-run --force --variants thumb,card --limit 50

pnpm --dir apps/api run media:generate-derivatives -- \
  --force --variants thumb,card --limit 500 --batch-size 25
```

Regenerate thumbs only (subset):

```bash
pnpm --dir apps/api run media:generate-derivatives -- \
  --dry-run --force --variants thumb --limit 50

pnpm --dir apps/api run media:generate-derivatives -- \
  --force --variants thumb --limit 500 --batch-size 25
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

The generator writes under `previews/watermarked/<variant>/...`, upserts `image_derivatives` / `asset_media_derivatives` (see [scripts/media/README.md](./scripts/media/README.md)), and never modifies original R2 objects.
