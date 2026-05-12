import type { AssetListItem } from "@/types"

export type AssetSort = "relevance" | "newest" | "popular" | "title"
export type AssetViewMode = "grid" | "list"
export type AssetOrientation = "all" | "landscape" | "portrait" | "square"

export interface AssetFilterQuery {
  query?: string
  category?: string
  keywords?: string[]
  orientation?: AssetOrientation
  sort?: AssetSort
}

export function normalizeQuery(query?: string): string {
  return (query ?? "").trim().toLowerCase()
}

export function filterAssets({
  assets,
  filter,
}: {
  assets: AssetListItem[]
  filter: AssetFilterQuery
}): AssetListItem[] {
  const q = normalizeQuery(filter.query)
  const selectedKeywords = filter.keywords ?? []

  return assets.filter((asset) => {
    if (filter.category && filter.category !== "all" && asset.category !== filter.category) return false

    if (filter.orientation && filter.orientation !== "all" && asset.orientation !== filter.orientation) return false

    if (selectedKeywords.length > 0) {
      const hasKeyword = selectedKeywords.every((kw) => asset.keywords.includes(kw))
      if (!hasKeyword) return false
    }

    if (!q) return true

    return (
      asset.title?.toLowerCase().includes(q) ||
      asset.filename.toLowerCase().includes(q) ||
      asset.keywords.some((kw) => kw.toLowerCase().includes(q)) ||
      asset.category?.toLowerCase().includes(q)
    )
  })
}

export function sortAssets({
  assets,
  sort,
}: {
  assets: AssetListItem[]
  sort: AssetSort
}): AssetListItem[] {
  const sorted = [...assets]
  if (sort === "title")
    return sorted.sort((a, b) => (a.title ?? a.filename).localeCompare(b.title ?? b.filename))

  if (sort === "newest")
    return sorted.sort((a, b) => b.id.localeCompare(a.id))

  if (sort === "popular")
    return sorted.sort((a, b) => b.keywords.length - a.keywords.length)

  return sorted
}

export function collectTopKeywords({
  assets,
  limit = 10,
}: {
  assets: AssetListItem[]
  limit?: number
}): string[] {
  const counts = new Map<string, number>()
  for (const asset of assets)
    for (const keyword of asset.keywords)
      counts.set(keyword, (counts.get(keyword) ?? 0) + 1)

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword]) => keyword)
}
