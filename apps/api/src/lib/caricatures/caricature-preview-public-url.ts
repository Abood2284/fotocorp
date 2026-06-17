import type { Env } from "../../appTypes"
import { buildPublicPreviewCdnUrl, parsePublicPreviewCdnConfig } from "../media/public-preview-cdn-url"

export function buildCaricaturePreviewPublicUrl(env: Env, storageKey: string): string | null {
  const cdn = parsePublicPreviewCdnConfig(env)
  if (!cdn.baseUrl) return null
  return buildPublicPreviewCdnUrl({
    baseUrl: cdn.baseUrl,
    version: cdn.version,
    storageKey,
    variant: "card",
  })
}
