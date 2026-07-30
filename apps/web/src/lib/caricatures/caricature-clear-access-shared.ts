export interface CaricatureEntitlementLike {
  assetType: string
  status: string
  validFrom: Date | null
  validUntil: Date | null
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
