import type { PublicAsset } from "@/features/assets/types"
import { PublicAssetCard } from "@/components/assets/public-asset-card"
import { EmptyState } from "@/components/shared/empty-state"
import { Images } from "lucide-react"

import { cn } from "@/lib/utils"

interface PublicAssetMosaicProps {
  assets: PublicAsset[]
  dense?: boolean
}

export function PublicAssetMosaic({ assets, dense = false }: PublicAssetMosaicProps) {
  if (assets.length === 0) {
    return (
      <EmptyState
        icon={Images}
        title="Previews are being prepared"
        description="The public archive will appear here as soon as watermarked previews are ready."
        className="rounded-lg border border-border bg-muted/20"
      />
    )
  }

  return (
    <div className={cn("columns-2 sm:columns-3 lg:columns-4 xl:columns-5", dense ? "gap-0" : "gap-1 sm:gap-2")}>
      {assets.slice(0, 50).map((asset) => (
        <PublicAssetCard
          key={asset.id}
          asset={asset}
          className={cn("break-inside-avoid", dense ? "mb-0 !rounded-none" : "mb-1 sm:mb-2")}
        />
      ))}
    </div>
  )
}
