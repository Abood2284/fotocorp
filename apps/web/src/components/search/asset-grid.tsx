"use client"

import type { AssetViewMode } from "@/features/assets/filter-utils"
import { AssetCard } from "@/components/shared/asset-card"
import { cn } from "@/lib/utils"
import type { AssetListItem } from "@/types"

interface AssetGridProps {
  assets: AssetListItem[]
  viewMode?: AssetViewMode
  onPreview?: (asset: AssetListItem) => void
  className?: string
}

export function AssetGrid({
  assets,
  viewMode = "grid",
  onPreview,
  className,
}: AssetGridProps) {
  return (
    <div
      className={cn(
        viewMode === "grid"
          ? "columns-1 gap-2 sm:columns-2 lg:columns-3 xl:columns-4 sm:gap-3"
          : "flex flex-col gap-4",
        className,
      )}
    >
      {assets.map((asset, index) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          priority={index < 4}
          viewMode={viewMode}
          onPreview={onPreview}
        />
      ))}
    </div>
  )
}
