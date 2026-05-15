export type SubscriberDownloadSize = "web" | "medium" | "large"

export function qualityRank(value: string): number {
  const normalized = value.trim().toLowerCase()
  if (normalized === "low") return 1
  if (normalized === "medium") return 2
  if (normalized === "high") return 3
  return 0
}

export function downloadSizeToQualityRank(size: SubscriberDownloadSize): number {
  if (size === "web") return 1
  if (size === "medium") return 2
  return 3
}

/** True when entitlement tier meets or exceeds the minimum tier required for the requested download size. */
export function isEntitlementQualitySufficientForSize(
  entitlementQualityAccess: string,
  size: SubscriberDownloadSize
): boolean {
  return qualityRank(entitlementQualityAccess) >= downloadSizeToQualityRank(size)
}
