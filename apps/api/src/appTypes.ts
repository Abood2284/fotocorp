export interface Env {
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  DATABASE_URL?: string;
  FOTOCORP_SUPER_ADMIN_EMAIL?: string;
  MEDIA_ORIGINALS_BUCKET?: R2Bucket;
  MEDIA_PREVIEWS_BUCKET: R2Bucket;
  /** Contributor upload staging bucket binding. Holds opaque pre-approval objects. Canonical Fotokey originals never live here. */
  MEDIA_CONTRIBUTOR_UPLOADS_BUCKET?: R2Bucket;
  MEDIA_PREVIEW_TOKEN_SECRET?: string;
  MEDIA_PREVIEW_TOKEN_TTL_SECONDS?: string;
  INTERNAL_API_SECRET?: string;
  LEGACY_FIXTURE_ROUTES_ENABLED?: string;
  /**
   * R2 S3 API — optional; required for contributor direct (presigned PUT) uploads, staging verification,
   * copy to canonical originals, and head/list. Prefer `R2_*` names in `apps/api/.dev.vars`; `CLOUDFLARE_R2_*` are legacy aliases.
   */
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  /** Contributor browser-upload staging bucket name (same as Worker `MEDIA_CONTRIBUTOR_UPLOADS_BUCKET` / `fotocorp-2026-contributor-uploads`). */
  R2_CONTRIBUTOR_STAGING_BUCKET?: string;
  R2_ORIGINALS_BUCKET?: string;
  CLOUDFLARE_R2_ACCOUNT_ID?: string;
  CLOUDFLARE_R2_ACCESS_KEY_ID?: string;
  CLOUDFLARE_R2_SECRET_ACCESS_KEY?: string;
  CLOUDFLARE_R2_ORIGINALS_BUCKET?: string;
  CLOUDFLARE_R2_PREVIEWS_BUCKET?: string;
  /** Legacy alias for the same bucket as `R2_CONTRIBUTOR_STAGING_BUCKET`. Do not use `R2_PHOTOGRAPHER_STAGING_BUCKET`. */
  CLOUDFLARE_R2_CONTRIBUTOR_UPLOADS_BUCKET?: string;
}
