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
  /** Public R2 previews custom domain (no trailing slash). When set, public catalog/homepage preview URLs point here instead of API proxy routes. */
  PUBLIC_PREVIEW_CDN_BASE_URL?: string;
  /** Optional CDN path version segment for deterministic preview URLs when storage_key is unavailable. Defaults to v1. */
  PUBLIC_PREVIEW_CDN_VERSION?: string;
  /** Public web origin used to build targeted Cloudflare cache purge URLs, for example https://www.fotocorp.com. */
  PUBLIC_WEB_ORIGIN?: string;
  /** Optional Cloudflare zone id for targeted public cache purge after staff metadata edits. */
  CLOUDFLARE_CACHE_PURGE_ZONE_ID?: string;
  /** Optional Cloudflare API token with cache purge permission. */
  CLOUDFLARE_CACHE_PURGE_API_TOKEN?: string;
  /** Resend API key. Store as a Cloudflare secret; never log this value. */
  RESEND_API_KEY?: string;
  EMAIL_PROVIDER?: string;
  EMAIL_FROM_NAME?: string;
  EMAIL_FROM_ADDRESS?: string;
  EMAIL_REPLY_TO?: string;
  TYPESENSE_HOST?: string;
  TYPESENSE_API_KEY?: string;
  TYPESENSE_COLLECTION_ALIAS?: string;
  TYPESENSE_SEARCH_TIMEOUT_MS?: string;
  /** Optional higher timeout budget for grouped event search (defaults to 8000ms). */
  TYPESENSE_EVENT_SEARCH_TIMEOUT_MS?: string;
  TYPESENSE_CF_ACCESS_CLIENT_ID?: string;
  TYPESENSE_CF_ACCESS_CLIENT_SECRET?: string;
  /** Diagnostic-only flag for homepage and public catalog latency investigation logs. */
  HOMEPAGE_DEBUG_LATENCY?: string;
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
