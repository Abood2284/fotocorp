export interface CaricatureEntitlementLike {
  assetType: string
  status: string
  validFrom: Date | null
  validUntil: Date | null
}

export interface CaricatureClearAccessState {
  hasClearAccess: boolean
  ownedAssetIds: string[]
  isContributor: boolean
}

export function isCaricatureEntitlementCurrentlyValid(
  row: Pick<CaricatureEntitlementLike, "status" | "validFrom" | "validUntil">,
  now = new Date(),
): boolean {
  if (row.status !== "ACTIVE") return false
  if (row.validFrom && row.validFrom > now) return false
  if (row.validUntil && row.validUntil <= now) return false
  return true
}

export function hasActiveCaricatureEntitlement(
  entitlements: CaricatureEntitlementLike[],
  now = new Date(),
): boolean {
  return entitlements.some(
    (row) =>
      row.assetType.toUpperCase() === "CARICATURE" && isCaricatureEntitlementCurrentlyValid(row, now),
  )
}

export function buildCaricatureClearPreviewUrl(assetId: string): string {
  return `/api/media/caricatures/${encodeURIComponent(assetId)}/clear-preview`
}

export function canShowCaricatureClearPreview(
  access: Pick<CaricatureClearAccessState, "hasClearAccess" | "ownedAssetIds" | "isContributor">,
  assetId: string,
): boolean {
  if (access.hasClearAccess) return true
  if (access.isContributor) return true
  return access.ownedAssetIds.includes(assetId)
}

export function parseCaricatureClearAccessPayload(data: unknown): CaricatureClearAccessState {
  if (!data || typeof data !== "object") {
    return { hasClearAccess: false, ownedAssetIds: [], isContributor: false }
  }

  const record = data as { hasClearAccess?: unknown; ownedAssetIds?: unknown; isContributor?: unknown }
  const ownedAssetIds = Array.isArray(record.ownedAssetIds)
    ? record.ownedAssetIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : []

  return {
    hasClearAccess: record.hasClearAccess === true,
    ownedAssetIds,
    isContributor: record.isContributor === true,
  }
}
