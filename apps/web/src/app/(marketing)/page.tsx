import { HomeHeroBackdropLoader } from "@/components/marketing/home-hero-backdrop-loader"
import { HomeCategorySection } from "@/components/marketing/home-category-section"
import type { PublicAsset } from "@/features/assets/types"
import { getPublicAssetFilters, listPublicAssets } from "@/lib/api/fotocorp-api"

export const metadata = {
  title: "Fotocorp — India's Premier News Photo Agency",
  description:
    "India's foremost news photo agency. Pan-India editorial, celebrity, sports, and archive images. Based in Mumbai.",
}

const ROYALTY_FREE_CATEGORY_NAME = "Royalty Free"
const ROYALTY_FREE_HOMEPAGE_LIMIT = 50

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const [params, royaltyFreeAssets] = await Promise.all([
    searchParams,
    loadRoyaltyFreeHomepageAssets(),
  ])
  const initialTab = params.tab?.trim().toLowerCase() === "royalty-free" ? "Creative" : "Editorial"

  return (
    <>
      <HomeHeroBackdropLoader />
      <HomeCategorySection initialTab={initialTab} royaltyFreeAssets={royaltyFreeAssets} />
    </>
  )
}

async function loadRoyaltyFreeHomepageAssets(): Promise<PublicAsset[]> {
  try {
    const filters = await getPublicAssetFilters()
    const category = filters.categories.find(
      (item) => item.name.toLowerCase() === ROYALTY_FREE_CATEGORY_NAME.toLowerCase(),
    )
    if (!category) return []

    const response = await listPublicAssets({
      categoryId: category.id,
      limit: ROYALTY_FREE_HOMEPAGE_LIMIT,
      sort: "newest",
    })
    return response.items
  } catch {
    return []
  }
}
