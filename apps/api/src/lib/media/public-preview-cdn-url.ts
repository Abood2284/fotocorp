import type { Env } from "../../appTypes"
import type { MediaPreviewVariant } from "./preview-token"
import { buildPublicStablePreviewPath } from "./stable-preview-path"

export type PublicPreviewVariant = MediaPreviewVariant

export interface PublicPreviewCdnConfig {
  baseUrl: string | null
  version: string | null
}

export function parsePublicPreviewCdnConfig(
  env: Pick<Env, "PUBLIC_PREVIEW_CDN_BASE_URL" | "PUBLIC_PREVIEW_CDN_VERSION">,
): PublicPreviewCdnConfig {
  const baseUrl = env.PUBLIC_PREVIEW_CDN_BASE_URL?.trim() || null
  const version = env.PUBLIC_PREVIEW_CDN_VERSION?.trim() || null
  return { baseUrl, version }
}

export function buildPublicPreviewCdnUrl(params: {
  baseUrl: string
  version?: string | null
  storageKey?: string | null
  assetId?: string | null
  variant: PublicPreviewVariant
}): string | null {
  const cleanBaseUrl = params.baseUrl?.trim().replace(/\/+$/, "")
  if (!cleanBaseUrl) return null

  if (params.storageKey) {
    const cleanStorageKey = params.storageKey.trim().replace(/^\/+/, "")
    if (!cleanStorageKey) return null
    return `${cleanBaseUrl}/${cleanStorageKey}`
  }

  if (!params.assetId) return null

  const cleanVersion = params.version?.trim() || "v1"
  return `${cleanBaseUrl}/previews/${cleanVersion}/${params.variant}/${params.assetId}.webp`
}

export function resolvePublicStablePreviewUrl(
  cdn: PublicPreviewCdnConfig,
  params: {
    storageKey?: string | null
    assetId: string
    variant: PublicPreviewVariant
  },
): string {
  const cdnUrl = params.storageKey
    ? buildPublicPreviewCdnUrl({
        baseUrl: cdn.baseUrl ?? "",
        version: cdn.version,
        storageKey: params.storageKey,
        variant: params.variant,
      })
    : null
  if (cdnUrl) return cdnUrl
  return buildPublicStablePreviewPath(params.assetId, params.variant)
}
