/**
 * Environment loader for the Node jobs CLI.
 * In dry-run mode, missing external-service variables do not throw.
 * In non-dry-run mode, required placeholders must be set or loading throws.
 */

export interface JobsEnvConfig {
  dryRun: boolean
  databaseUrl: string | undefined
  r2AccountId: string | undefined
  r2AccessKeyId: string | undefined
  r2SecretAccessKey: string | undefined
  r2ContributorStagingBucket: string | undefined
  r2OriginalsBucket: string | undefined
  r2PreviewsBucket: string | undefined
  r2CaricatureOriginalsBucket: string | undefined
  publicPreviewCdnBaseUrl: string | undefined
  imagePublishProcessingEnabled: boolean
  fotocorpApiBaseUrl: string | undefined
  internalApiSecret: string | undefined
}

const ENV_DATABASE_URL = "DATABASE_URL"
const ENV_R2_ACCOUNT_ID = "R2_ACCOUNT_ID"
const ENV_R2_ACCESS_KEY_ID = "R2_ACCESS_KEY_ID"
const ENV_R2_SECRET_ACCESS_KEY = "R2_SECRET_ACCESS_KEY"
const ENV_R2_CONTRIBUTOR_STAGING_BUCKET = "R2_CONTRIBUTOR_STAGING_BUCKET"
const ENV_R2_ORIGINALS_BUCKET = "R2_ORIGINALS_BUCKET"
const ENV_R2_PREVIEWS_BUCKET = "R2_PREVIEWS_BUCKET"
const ENV_R2_CARICATURE_ORIGINALS_BUCKET = "R2_CARICATURE_ORIGINALS_BUCKET"
const ENV_PUBLIC_PREVIEW_CDN_BASE_URL = "PUBLIC_PREVIEW_CDN_BASE_URL"
const ENV_IMAGE_PUBLISH_PROCESSING_ENABLED = "IMAGE_PUBLISH_PROCESSING_ENABLED"
const ENV_FOTOCORP_API_BASE_URL = "FOTOCORP_API_BASE_URL"
const ENV_INTERNAL_API_SECRET = "INTERNAL_API_SECRET"

const REQUIRED_SERVICE_ENV_NAMES = [
  ENV_DATABASE_URL,
  ENV_R2_ACCOUNT_ID,
  ENV_R2_ACCESS_KEY_ID,
  ENV_R2_SECRET_ACCESS_KEY,
  ENV_R2_CONTRIBUTOR_STAGING_BUCKET,
  ENV_R2_ORIGINALS_BUCKET,
  ENV_R2_PREVIEWS_BUCKET
] as const

function readOptionalEnv(name: string): string | undefined {
  const raw = process.env[name]
  if (raw === undefined || raw === "") return undefined
  return raw
}

function requireEnv(name: string): string {
  const value = readOptionalEnv(name)
  if (value === undefined)
    throw new Error(`[fotocorp-jobs] missing required env var: ${name}`)
  return value
}

function listMissingRequiredServiceEnvNames(): string[] {
  return REQUIRED_SERVICE_ENV_NAMES.filter((name) => readOptionalEnv(name) === undefined)
}

/**
 * IMAGE_PUBLISH_PROCESSING_ENABLED is a safety flag. Default is `false`: the worker may
 * count pending publish jobs but must not claim them and must not mutate DB rows. Set to
 * `true` on the VPS when Sharp + R2 env is configured so the worker claims queued jobs and
 * runs real contributor IMAGE publish processing (PR-16G).
 */
function readImagePublishProcessingEnabled(): boolean {
  const raw = readOptionalEnv(ENV_IMAGE_PUBLISH_PROCESSING_ENABLED)
  if (raw === undefined) return false
  const normalized = raw.trim().toLowerCase()
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true
  if (normalized === "false" || normalized === "0" || normalized === "no") return false
  console.log(
    `[fotocorp-jobs] warn: invalid ${ENV_IMAGE_PUBLISH_PROCESSING_ENABLED}=${JSON.stringify(raw)}; using false`
  )
  return false
}

/**
 * Loads typed job configuration from process.env.
 * When dryRun is false, all service placeholders listed below must be present.
 */
export function loadJobsEnv(dryRun: boolean): JobsEnvConfig {
  const imagePublishProcessingEnabled = readImagePublishProcessingEnabled()

  if (dryRun) {
    const missing = listMissingRequiredServiceEnvNames()
    if (missing.length > 0)
      console.log(
        `[fotocorp-jobs] warn: dry-run missing env (required for --once / --worker): ${missing.join(", ")}`
      )

    return {
      dryRun: true,
      databaseUrl: readOptionalEnv(ENV_DATABASE_URL),
      r2AccountId: readOptionalEnv(ENV_R2_ACCOUNT_ID),
      r2AccessKeyId: readOptionalEnv(ENV_R2_ACCESS_KEY_ID),
      r2SecretAccessKey: readOptionalEnv(ENV_R2_SECRET_ACCESS_KEY),
      r2ContributorStagingBucket: readOptionalEnv(ENV_R2_CONTRIBUTOR_STAGING_BUCKET),
      r2OriginalsBucket: readOptionalEnv(ENV_R2_ORIGINALS_BUCKET),
      r2PreviewsBucket: readOptionalEnv(ENV_R2_PREVIEWS_BUCKET),
      r2CaricatureOriginalsBucket: readOptionalEnv(ENV_R2_CARICATURE_ORIGINALS_BUCKET),
      publicPreviewCdnBaseUrl: readOptionalEnv(ENV_PUBLIC_PREVIEW_CDN_BASE_URL),
      imagePublishProcessingEnabled,
      fotocorpApiBaseUrl: readOptionalEnv(ENV_FOTOCORP_API_BASE_URL),
      internalApiSecret: readOptionalEnv(ENV_INTERNAL_API_SECRET),
    }
  }

  const missing = listMissingRequiredServiceEnvNames()
  if (missing.length > 0)
    throw new Error(
      `[fotocorp-jobs] missing required env vars (${missing.length}): ${missing.join(", ")}`
    )

  const fotocorpApiBaseUrl = readOptionalEnv(ENV_FOTOCORP_API_BASE_URL)
  const internalApiSecret = readOptionalEnv(ENV_INTERNAL_API_SECRET)
  if (!fotocorpApiBaseUrl || !internalApiSecret) {
    console.log(
      `[fotocorp-jobs] warn: ${ENV_FOTOCORP_API_BASE_URL} and/or ${ENV_INTERNAL_API_SECRET} not set; Typesense post-publish sync callbacks will be skipped`
    )
  }

  return {
    dryRun: false,
    databaseUrl: requireEnv(ENV_DATABASE_URL),
    r2AccountId: requireEnv(ENV_R2_ACCOUNT_ID),
    r2AccessKeyId: requireEnv(ENV_R2_ACCESS_KEY_ID),
    r2SecretAccessKey: requireEnv(ENV_R2_SECRET_ACCESS_KEY),
    r2ContributorStagingBucket: requireEnv(ENV_R2_CONTRIBUTOR_STAGING_BUCKET),
    r2OriginalsBucket: requireEnv(ENV_R2_ORIGINALS_BUCKET),
    r2PreviewsBucket: requireEnv(ENV_R2_PREVIEWS_BUCKET),
    r2CaricatureOriginalsBucket: readOptionalEnv(ENV_R2_CARICATURE_ORIGINALS_BUCKET),
    publicPreviewCdnBaseUrl: readOptionalEnv(ENV_PUBLIC_PREVIEW_CDN_BASE_URL),
    imagePublishProcessingEnabled,
    fotocorpApiBaseUrl,
    internalApiSecret,
  }
}
