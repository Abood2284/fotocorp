import { HomeHero } from "@/components/marketing/home-hero"
import { HomeCategorySection } from "@/components/marketing/home-category-section"
import { listPublicAssets } from "@/lib/api/fotocorp-api"
import type { PublicAsset } from "@/features/assets/types"
import type { HeroBackdropItem } from "@/components/marketing/hero-backdrop-strip"

export const metadata = {
  title: "Fotocorp — India's Premier News Photo Agency",
  description:
    "India's foremost news photo agency. Pan-India editorial, celebrity, sports, and archive images. Based in Mumbai.",
}

const HERO_ASSET_POOL_LIMIT = 80
const HERO_ITEMS_LIMIT = 9

export default async function HomePage() {
  let heroItems: HeroBackdropItem[] = []

  try {
    const res = await listPublicAssets({
      limit: HERO_ASSET_POOL_LIMIT,
      sort: "newest",
    })
    const candidates = normalizeHeroAssets(res.items)
    const firstMissing = res.items.find((asset) => !normalizeImageUrl(asset.previews.card?.url))

    if (process.env.NODE_ENV !== "production") {
      console.info(JSON.stringify({
        event: "homepage_hero_candidates",
        source: {
          type: "public_assets",
          poolLimit: HERO_ASSET_POOL_LIMIT,
          limit: HERO_ITEMS_LIMIT,
          sort: "newest",
        },
        hero_item_count: candidates.length,
        hero_preview_url_present_count: candidates.length,
        first_missing_reason: firstMissing ? "missing_preview_url" : null,
      }))
    }

    heroItems = shuffleArray(candidates).slice(0, HERO_ITEMS_LIMIT)
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.info(JSON.stringify({
        event: "homepage_hero_candidates",
        source: {
          type: "public_assets",
          poolLimit: HERO_ASSET_POOL_LIMIT,
          limit: HERO_ITEMS_LIMIT,
          sort: "newest",
        },
        hero_item_count: 0,
        hero_preview_url_present_count: 0,
        first_missing_reason: error instanceof Error ? error.message : "public_assets_unavailable",
      }))
    }
    // Fall through — hero backdrop strip renders gradient placeholders when events are unavailable
  }

  return (
    <>
      <HomeHero items={heroItems} />
      <HomeCategorySection />
    </>
  )
}

function normalizeHeroAssets(assets: PublicAsset[]): HeroBackdropItem[] {
  return assets.flatMap((asset) => {
    const imageUrl = normalizeImageUrl(asset.previews.card?.url)

    if (!imageUrl) return []

    return [
      {
        id: asset.id,
        title: asset.event?.name ?? asset.headline ?? asset.caption ?? asset.fotokey ?? "Fotocorp image",
        href: `/assets/${encodeURIComponent(asset.id)}`,
        imageUrl,
      },
    ]
  })
}

function normalizeImageUrl(value: string | null | undefined): string | null {
  const normalized = value?.trim()

  if (!normalized) return null
  if (normalized === "null") return null
  if (normalized === "undefined") return null

  return normalized
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
