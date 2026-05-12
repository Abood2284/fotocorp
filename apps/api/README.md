# Fotocorp API

`apps/api` owns Fotocorp backend business schema, import tooling, R2 reconciliation, derivative generation, and secure preview delivery.

## Local Media Binding Setup

The public Worker binds two media buckets:

- `MEDIA_PREVIEWS_BUCKET`: read-only watermarked derivative reads
- `MEDIA_ORIGINALS_BUCKET`: protected admin original-image reads

Required environment:

- `DATABASE_URL`: API database connection
- `BETTER_AUTH_SECRET`: Better Auth signing/encryption secret
- `BETTER_AUTH_URL`: public web origin for Better Auth, for example `http://localhost:3000`
- `FOTOCORP_SUPER_ADMIN_EMAIL`: optional bootstrap email for the first super admin profile
- `MEDIA_PREVIEW_TOKEN_SECRET`: HMAC secret for signed preview URLs
- `CLOUDFLARE_R2_ACCOUNT_ID`: R2 account id for Node scripts
- `CLOUDFLARE_R2_ACCESS_KEY_ID`: R2 access key for Node scripts
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`: R2 secret key for Node scripts
- `CLOUDFLARE_R2_REGION`: usually `auto`
- `CLOUDFLARE_R2_ORIGINALS_BUCKET`: originals bucket, currently `fotocorp-2026-megafinal`
- `CLOUDFLARE_R2_PREVIEWS_BUCKET`: watermarked preview bucket

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
   - Generates `thumb`, `card`, and `detail`.
   - Writes watermarked WebP derivatives to `CLOUDFLARE_R2_PREVIEWS_BUCKET`.
   - Updates `asset_media_derivatives`.

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

The secure preview API validates the token, asset status, visibility, original R2 mapping status, derivative readiness, watermarking, and current watermark profile before reading from the preview bucket.

Notes:

- The secure preview API never serves original R2 objects.
- The secure preview API only serves records from `asset_media_derivatives`.
- Derivatives must be watermarked and `READY`; missing derivatives return a safe 404.
- Legacy key-based media routes are disabled so callers cannot request arbitrary R2 object keys.
- No API route writes, moves, copies, renames, or deletes R2 objects.

## Watermarked Preview Derivatives

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

The generator writes only under `previews/watermarked/<variant>/<asset-id>.webp`, upserts `asset_media_derivatives`, and never modifies original R2 objects. More details are in [scripts/media/README.md](/Users/abdulraheem/Developer/Next/fotocorp/apps/api/scripts/media/README.md:1).
