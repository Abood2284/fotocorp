import { HomeHero } from "@/components/marketing/home-hero"
import { HomeCategorySection } from "@/components/marketing/home-category-section"
import { fetchPublicLatestEvents } from "@/lib/api/fotocorp-api"
import type { PublicHomepageEvent } from "@/features/assets/types"

export const metadata = {
  title: "Fotocorp — India's Premier News Photo Agency",
  description:
    "India's foremost news photo agency. Pan-India editorial, celebrity, sports, and archive images. Based in Mumbai.",
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export default async function HomePage() {
  let heroEvents: PublicHomepageEvent[] = []

  try {
    const res = await fetchPublicLatestEvents({ windowDays: 60, limit: 24 })
    heroEvents = shuffleArray(
      res.items.filter((e) => e.previewUrl && e.assetCount > 0),
    ).slice(0, 9)
  } catch {
    // Fall through — hero backdrop strip renders gradient placeholders when events are unavailable
  }

  return (
    <>
      <HomeHero events={heroEvents} />
      <HomeCategorySection />
    </>
  )
}
