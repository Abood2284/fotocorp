import type { PublicAsset } from "@/features/assets/types"
import { PublicAssetGrid, type PublicAssetGridProps } from "@/components/assets/public-asset-grid"

/** @deprecated Use `PublicAssetGrid` — kept for existing imports. */
export type PublicAssetMosaicProps = PublicAssetGridProps

/** @deprecated Use `PublicAssetGrid` — same layout as `/search` grid view. */
export function PublicAssetMosaic(props: PublicAssetMosaicProps) {
  return <PublicAssetGrid {...props} />
}
