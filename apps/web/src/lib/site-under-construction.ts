import { getCloudflareContext } from "@opennextjs/cloudflare"

export const CONSTRUCTION_PAGE_PATH = "/under-construction"

export const SITE_PREVIEW_COOKIE = "fc_site_preview"

function getRuntimeEnvVar(name: string): string | undefined {
  // In OpenNext production, Worker `vars` are available at runtime via `getCloudflareContext()`.
  // Relying only on `process.env` can get values baked in at build-time.
  try {
    const { env } = getCloudflareContext()
    const value = (env as Record<string, unknown>)[name]
    if (typeof value === "string") return value
    if (value == null) return undefined
    return String(value)
  } catch {
    // Fallback for local dev and edge-cases where Cloudflare context is unavailable.
    return process.env[name]
  }
}

export function isSiteUnderConstruction(): boolean {
  const value = getRuntimeEnvVar("SITE_UNDER_CONSTRUCTION")
  return value?.toLowerCase() === "true"
}

export function getSiteUnderConstructionBypassSecret(): string | null {
  const secret = getRuntimeEnvVar("SITE_UNDER_CONSTRUCTION_BYPASS_SECRET")?.trim()
  return secret && secret.length > 0 ? secret : null
}

export function hasSitePreviewBypass(request: {
  cookies: { get: (name: string) => { value: string } | undefined }
}): boolean {
  const secret = getSiteUnderConstructionBypassSecret()
  if (!secret) return false
  return request.cookies.get(SITE_PREVIEW_COOKIE)?.value === secret
}
