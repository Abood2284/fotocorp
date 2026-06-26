"use client"

interface QueueCatalogPreviewRegenerationResponse {
  ok?: boolean
  alreadyQueued?: boolean
  message?: string
  error?: { code?: string; message?: string }
}

export async function queueCatalogPreviewRegeneration(assetId: string): Promise<QueueCatalogPreviewRegenerationResponse> {
  const response = await fetch(`/api/staff/catalog/${encodeURIComponent(assetId)}/generate-previews`, {
    method: "POST",
    headers: { Accept: "application/json" },
  })

  const data = (await response.json().catch(() => ({}))) as QueueCatalogPreviewRegenerationResponse
  if (!response.ok) {
    throw new Error(data.error?.message ?? "Could not queue preview regeneration.")
  }
  return data
}

export async function pollCatalogAssetPreview(
  assetId: string,
  fetchAsset: (id: string) => Promise<{ asset?: import("@/features/assets/admin-catalog-types").AdminCatalogAssetItem | null } | null>,
  shouldStop: (asset: import("@/features/assets/admin-catalog-types").AdminCatalogAssetItem) => boolean,
  options?: { intervalMs?: number; timeoutMs?: number },
): Promise<import("@/features/assets/admin-catalog-types").AdminCatalogAssetItem | null> {
  const intervalMs = options?.intervalMs ?? 4000
  const timeoutMs = options?.timeoutMs ?? 120000
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
    const result = await fetchAsset(assetId)
    const asset = result?.asset ?? null
    if (asset && shouldStop(asset)) return asset
  }

  const finalResult = await fetchAsset(assetId)
  return finalResult?.asset ?? null
}
