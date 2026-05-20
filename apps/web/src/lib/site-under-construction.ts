export const CONSTRUCTION_PAGE_PATH = "/under-construction"

export const SITE_PREVIEW_COOKIE = "fc_site_preview"

export function isSiteUnderConstruction(): boolean {
  return process.env.SITE_UNDER_CONSTRUCTION === "true"
}

export function getSiteUnderConstructionBypassSecret(): string | null {
  const secret = process.env.SITE_UNDER_CONSTRUCTION_BYPASS_SECRET?.trim()
  return secret && secret.length > 0 ? secret : null
}

export function hasSitePreviewBypass(request: {
  cookies: { get: (name: string) => { value: string } | undefined }
}): boolean {
  const secret = getSiteUnderConstructionBypassSecret()
  if (!secret) return false
  return request.cookies.get(SITE_PREVIEW_COOKIE)?.value === secret
}
