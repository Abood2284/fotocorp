import type { PublicAssetFilterCategory } from "@/features/assets/types"

export const CATALOG_VISIBLE_CATEGORY_NAMES = [
  "Entertainment",
  "News",
  "Fashion",
  "Sports",
  "Business",
  "Retro",
  "Royalty Free",
] as const

export function filterVisibleCatalogCategories(categories: PublicAssetFilterCategory[]) {
  const categoriesByName = new Map(categories.map((category) => [category.name, category]))

  return CATALOG_VISIBLE_CATEGORY_NAMES.flatMap((name) => {
    const category = categoriesByName.get(name)
    return category ? [category] : []
  })
}
