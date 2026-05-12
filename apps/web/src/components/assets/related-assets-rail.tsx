import { AssetGrid } from "@/components/search/asset-grid"
import { SectionHeader } from "@/components/layout/section"
import type { AssetListItem } from "@/types"

interface RelatedAssetsRailProps {
  assets: AssetListItem[]
}

export function RelatedAssetsRail({ assets }: RelatedAssetsRailProps) {
  if (assets.length === 0) return null

  return (
    <section className="mt-12">
      <SectionHeader
        eyebrow="Discover more"
        title="Related assets"
        description="Similar visuals from the same category and adjacent themes."
      />
      <AssetGrid
        assets={assets}
        viewMode="grid"
      />
    </section>
  )
}
