export interface Env {
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  DATABASE_URL?: string;
  FOTOCORP_SUPER_ADMIN_EMAIL?: string;
  MEDIA_ORIGINALS_BUCKET?: R2Bucket;
  MEDIA_PREVIEWS_BUCKET: R2Bucket;
  /** Photographer upload staging bucket. Holds opaque pre-approval objects. Canonical Fotokey originals never live here. */
  MEDIA_CONTRIBUTOR_UPLOADS_BUCKET?: R2Bucket;
  MEDIA_PREVIEW_TOKEN_SECRET?: string;
  MEDIA_PREVIEW_TOKEN_TTL_SECONDS?: string;
  INTERNAL_API_SECRET?: string;
  LEGACY_FIXTURE_ROUTES_ENABLED?: string;
  /** R2 S3 API — optional; required for photographer presigned PUT uploads, copy to canonical originals, and head/list. */
  CLOUDFLARE_R2_ACCOUNT_ID?: string;
  CLOUDFLARE_R2_ACCESS_KEY_ID?: string;
  CLOUDFLARE_R2_SECRET_ACCESS_KEY?: string;
  CLOUDFLARE_R2_ORIGINALS_BUCKET?: string;
  /** Optional staging bucket name for photographer pre-approval objects. */
  CLOUDFLARE_R2_CONTRIBUTOR_UPLOADS_BUCKET?: string;
}
