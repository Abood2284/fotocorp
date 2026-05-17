import type { PublicAsset } from "@/features/assets/types"
import { PublicAssetCard } from "@/components/assets/public-asset-card"
import { EmptyState } from "@/components/shared/empty-state"
import { Images } from "lucide-react"
import { cn } from "@/lib/utils"

/** Column layout for public browse grids (search, homepage sections, related assets). */
export const PUBLIC_ASSET_GRID_COLUMNS =
  "columns-2 gap-2 sm:columns-3 lg:columns-4 xl:columns-5"

export const PUBLIC_ASSET_GRID_CARD_CLASS = "mb-2 break-inside-avoid"

export interface PublicAssetGridProps {
  assets: PublicAsset[]
  /** Cap tiles rendered (default 50). */
  limit?: number
  /** How many leading images load eagerly (default 8). */
  priorityCount?: number
  /** Tighter mosaic strip (e.g. homepage “newest” band). */
  dense?: boolean
  className?: string
  emptyTitle?: string
  emptyDescription?: string
}

/**
 * Canonical public asset mosaic — same cards and layout as `/search` grid view.
 */
export function PublicAssetGrid({
  assets,
  limit = 50,
  priorityCount = 8,
  dense = false,
  className,
  emptyTitle = "Previews are being prepared",
  emptyDescription = "The public archive will appear here as soon as watermarked previews are ready.",
}: PublicAssetGridProps) {
  if (assets.length === 0) {
    return (
      <EmptyState
        icon={Images}
        title={emptyTitle}
        description={emptyDescription}
        className="rounded-lg border border-border bg-muted/20"
      />
    )
  }

  const items = assets.slice(0, limit)

  return (
    <div
      className={cn(
        dense ? "columns-2 gap-0 sm:columns-3 lg:columns-4 xl:columns-5" : PUBLIC_ASSET_GRID_COLUMNS,
        className,
      )}
    >
      {items.map((asset, index) => (
        <PublicAssetCard
          key={asset.id}
          asset={asset}
          variant="grid"
          priority={index < priorityCount}
          className={cn(
            "break-inside-avoid",
            dense ? "mb-0 !rounded-none" : PUBLIC_ASSET_GRID_CARD_CLASS,
          )}
        />
      ))}
    </div>
  )
}
