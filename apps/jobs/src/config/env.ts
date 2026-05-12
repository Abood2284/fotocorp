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
  r2PhotographerStagingBucket: string | undefined
  r2OriginalsBucket: string | undefined
  r2PreviewsBucket: string | undefined
}

const ENV_DATABASE_URL = "DATABASE_URL"
const ENV_R2_ACCOUNT_ID = "R2_ACCOUNT_ID"
const ENV_R2_ACCESS_KEY_ID = "R2_ACCESS_KEY_ID"
const ENV_R2_SECRET_ACCESS_KEY = "R2_SECRET_ACCESS_KEY"
const ENV_R2_CONTRIBUTOR_STAGING_BUCKET = "R2_CONTRIBUTOR_STAGING_BUCKET"
const ENV_R2_ORIGINALS_BUCKET = "R2_ORIGINALS_BUCKET"
const ENV_R2_PREVIEWS_BUCKET = "R2_PREVIEWS_BUCKET"

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
 * Loads typed job configuration from process.env.
 * When dryRun is false, all service placeholders listed below must be present.
 */
export function loadJobsEnv(dryRun: boolean): JobsEnvConfig {
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
      r2PhotographerStagingBucket: readOptionalEnv(ENV_R2_CONTRIBUTOR_STAGING_BUCKET),
      r2OriginalsBucket: readOptionalEnv(ENV_R2_ORIGINALS_BUCKET),
      r2PreviewsBucket: readOptionalEnv(ENV_R2_PREVIEWS_BUCKET)
    }
  }

  const missing = listMissingRequiredServiceEnvNames()
  if (missing.length > 0)
    throw new Error(
      `[fotocorp-jobs] missing required env vars (${missing.length}): ${missing.join(", ")}`
    )

  return {
    dryRun: false,
    databaseUrl: requireEnv(ENV_DATABASE_URL),
    r2AccountId: requireEnv(ENV_R2_ACCOUNT_ID),
    r2AccessKeyId: requireEnv(ENV_R2_ACCESS_KEY_ID),
    r2SecretAccessKey: requireEnv(ENV_R2_SECRET_ACCESS_KEY),
    r2PhotographerStagingBucket: requireEnv(ENV_R2_CONTRIBUTOR_STAGING_BUCKET),
    r2OriginalsBucket: requireEnv(ENV_R2_ORIGINALS_BUCKET),
    r2PreviewsBucket: requireEnv(ENV_R2_PREVIEWS_BUCKET)
  }
}
