import { FIXTURE_ASSETS } from "@/lib/fixtures/assets"
import type { MockUserTier } from "@/features/session/mock-session-provider"
import type { AssetListItem } from "@/types"

export interface LibraryItem {
  asset: AssetListItem
  downloadedAt: string
  license: "standard" | "extended"
}

function byIds(ids: string[]): AssetListItem[] {
  const lookup = new Map(FIXTURE_ASSETS.map((asset) => [asset.id, asset]))
  return ids.map((id) => lookup.get(id)).filter((asset): asset is AssetListItem => Boolean(asset))
}

const DOWNLOADS_BY_TIER: Record<MockUserTier, LibraryItem[]> = {
  guest: [],
  free: (() => {
    const freeAsset = byIds(["asset-003"])[0]
    if (!freeAsset) return []
    return [
      {
        asset: freeAsset,
        downloadedAt: "2026-04-02",
        license: "standard",
      },
    ]
  })(),
  paid: byIds(["asset-003", "asset-006", "asset-009", "asset-011"]).map((asset, index) => ({
    asset,
    downloadedAt: `2026-04-${String(20 - index).padStart(2, "0")}`,
    license: index === 0 ? "extended" : "standard",
  })),
}

const FAVORITES_BY_TIER: Record<MockUserTier, AssetListItem[]> = {
  guest: [],
  free: byIds(["asset-002", "asset-008", "asset-010"]),
  paid: byIds(["asset-001", "asset-002", "asset-004", "asset-008", "asset-012"]),
}

export function getDownloadsByTier(tier: MockUserTier): LibraryItem[] {
  return DOWNLOADS_BY_TIER[tier]
}

export function getFavoritesByTier(tier: MockUserTier): AssetListItem[] {
  return FAVORITES_BY_TIER[tier]
}
