/** Sales/access interest types (registration, inquiries, subscriber entitlements). Not catalog media_type. */
export const ACCESS_INTEREST_ASSET_TYPES = ["EDITORIAL", "ROYALTY_FREE", "VIDEO", "CARICATURE"] as const

export type AccessInterestAssetType = (typeof ACCESS_INTEREST_ASSET_TYPES)[number]

const LEGACY_IMAGE_ALIAS = "IMAGE"

export function normalizeAccessInterestAssetType(raw: string): AccessInterestAssetType | null {
  const upper = raw.trim().toUpperCase()
  const normalized = upper === LEGACY_IMAGE_ALIAS ? "EDITORIAL" : upper
  if (isAccessInterestAssetType(normalized)) return normalized
  return null
}

export function normalizeAccessInterestAssetTypes(raw: unknown): AccessInterestAssetType[] {
  const list: unknown[] = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",").map((s) => s.trim()) : []
  const out: AccessInterestAssetType[] = []
  for (const item of list) {
    if (typeof item !== "string") continue
    const normalized = normalizeAccessInterestAssetType(item)
    if (normalized && !out.includes(normalized)) out.push(normalized)
  }
  return out
}

export function isAccessInterestAssetType(value: string): value is AccessInterestAssetType {
  return (ACCESS_INTEREST_ASSET_TYPES as readonly string[]).includes(value)
}

export const ACCESS_INTEREST_ASSET_LABELS: Record<AccessInterestAssetType, string> = {
  EDITORIAL: "Editorial",
  ROYALTY_FREE: "Royalty Free",
  VIDEO: "Video",
  CARICATURE: "Caricature",
}

export function formatAccessInterestAssetLabel(assetType: string): string {
  const normalized = normalizeAccessInterestAssetType(assetType)
  if (normalized) return ACCESS_INTEREST_ASSET_LABELS[normalized]
  return assetType
}
