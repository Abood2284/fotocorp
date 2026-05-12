import type { AssetListItem } from "@/types"

export type AssetAccessLevel = "free-preview" | "licensed"

/**
 * Provisional access resolver for fixture-only UX.
 * Swap this with auth/license-aware checks later.
 */
export function getAssetAccessLevel(asset: AssetListItem): AssetAccessLevel {
  const numericPart = Number(asset.id.replace(/\D/g, ""))
  return numericPart % 3 === 0 ? "licensed" : "free-preview"
}

export function isAssetLocked(asset: AssetListItem): boolean {
  return getAssetAccessLevel(asset) === "free-preview"
}
