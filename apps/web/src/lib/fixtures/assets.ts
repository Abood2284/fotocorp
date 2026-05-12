/**
 * Fixture asset data — provisional frontend contract only.
 * Images sourced from Unsplash public CDN (no API key required for direct access).
 * Replace with API adapter when backend is ready.
 */
import type { AssetListItem } from "@/types"

const BASE = "https://images.unsplash.com"

function asset(
  id: string,
  photoId: string,
  filename: string,
  title: string,
  keywords: string[],
  category: string,
  width: number,
  height: number,
): AssetListItem {
  return {
    id,
    filename,
    title,
    thumbnailUrl: `${BASE}/photo-${photoId}?w=480&h=320&fit=crop&q=75&auto=format`,
    previewUrl: `${BASE}/photo-${photoId}?w=1200&q=80&auto=format`,
    keywords,
    category,
    width,
    height,
    orientation: width > height ? "landscape" : height > width ? "portrait" : "square",
  }
}

export const FIXTURE_ASSETS: AssetListItem[] = [
  asset(
    "asset-001",
    "1506905925346-21bda4d32df4",
    "mountain-sunrise-001.jpg",
    "Golden Hour Mountain Sunrise",
    ["nature", "mountain", "sunrise", "landscape", "golden hour", "scenic"],
    "nature",
    5184,
    3456,
  ),
  asset(
    "asset-002",
    "1441974231531-c6227db76b6e",
    "forest-light-002.jpg",
    "Misty Forest Light",
    ["nature", "forest", "mist", "trees", "light", "green"],
    "nature",
    5760,
    3840,
  ),
  asset(
    "asset-003",
    "1486325212027-8081e485255e",
    "architecture-modern-003.jpg",
    "Modern Glass Skyscraper",
    ["architecture", "building", "city", "glass", "modern", "urban"],
    "architecture",
    4000,
    6000,
  ),
  asset(
    "asset-004",
    "1507679799987-c73779587ccf",
    "business-laptop-004.jpg",
    "Productive Workspace Setup",
    ["business", "laptop", "workspace", "office", "productivity", "tech"],
    "business",
    5184,
    3456,
  ),
  asset(
    "asset-005",
    "1438761681033-6461ffad8d80",
    "portrait-professional-005.jpg",
    "Professional Portrait",
    ["people", "portrait", "professional", "headshot", "face"],
    "people",
    3456,
    5184,
  ),
  asset(
    "asset-006",
    "1469474968028-56623f02e42e",
    "landscape-valley-006.jpg",
    "Aerial Valley Landscape",
    ["nature", "landscape", "valley", "aerial", "scenic", "countryside"],
    "nature",
    6000,
    4000,
  ),
  asset(
    "asset-007",
    "1449824913935-59a10b8d2000",
    "city-night-007.jpg",
    "City Lights at Night",
    ["city", "night", "lights", "urban", "architecture", "aerial"],
    "architecture",
    5472,
    3648,
  ),
  asset(
    "asset-008",
    "1454165804606-c3d57bc86b40",
    "business-meeting-008.jpg",
    "Team Collaboration Meeting",
    ["business", "meeting", "team", "office", "collaboration", "people"],
    "business",
    5184,
    3456,
  ),
  asset(
    "asset-009",
    "1558618666-fcd25c85cd64",
    "abstract-tech-009.jpg",
    "Abstract Digital Art",
    ["abstract", "digital", "art", "technology", "creative", "design"],
    "abstract",
    4800,
    3200,
  ),
  asset(
    "asset-010",
    "1465101162946-4377e57745c3",
    "abstract-colorful-010.jpg",
    "Vibrant Color Burst",
    ["abstract", "colorful", "art", "creative", "vibrant", "design"],
    "abstract",
    4000,
    4000,
  ),
  asset(
    "asset-011",
    "1520116468816-95b69f847357",
    "food-cafe-011.jpg",
    "Artisan Coffee Flat Lay",
    ["food", "coffee", "cafe", "flat lay", "minimal", "lifestyle"],
    "food",
    5184,
    3456,
  ),
  asset(
    "asset-012",
    "1498557850523-fd3d118b962e",
    "food-healthy-012.jpg",
    "Fresh Healthy Salad Bowl",
    ["food", "healthy", "salad", "fresh", "vegetables", "lifestyle"],
    "food",
    4000,
    3000,
  ),
]

export function getAssetById(id: string): AssetListItem | undefined {
  return FIXTURE_ASSETS.find((a) => a.id === id)
}

export function getAssetsByCategory(category: string): AssetListItem[] {
  return FIXTURE_ASSETS.filter((a) => a.category === category)
}

export function searchAssets(query: string): AssetListItem[] {
  const q = query.toLowerCase().trim()
  if (!q) return FIXTURE_ASSETS
  return FIXTURE_ASSETS.filter(
    (a) =>
      a.title?.toLowerCase().includes(q) ||
      a.keywords.some((k) => k.toLowerCase().includes(q)) ||
      a.category?.toLowerCase().includes(q),
  )
}
