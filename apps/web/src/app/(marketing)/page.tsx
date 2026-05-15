import { listPublicAssets, listPublicEvents } from "@/lib/api/fotocorp-api"
import { SearchBar } from "@/components/shared/search-bar"
import { HomeCategorySection } from "@/components/marketing/home-category-section"

export const metadata = {
  title: "Fotocorp — Premium Stock Photography",
  description:
    "Millions of royalty-free stock photos, vectors and videos for creators, brands and teams.",
}

export default async function HomePage() {
  const [
    eventsResponse,
    creativeAssets,
    newsAssets,
    sportsAssets,
    entertainmentAssets,
    retroAssets,
  ] = await Promise.all([
    listPublicEvents()
      .then((result) => result.items)
      .catch(() => []),
    listPublicAssets({ limit: 50, sort: "newest" })
      .then((result) => result.items)
      .catch(() => []),
    listPublicAssets({ q: "News", limit: 15, sort: "newest" })
      .then((result) => result.items)
      .catch(() => []),
    listPublicAssets({ q: "Sports", limit: 15, sort: "newest" })
      .then((result) => result.items)
      .catch(() => []),
    listPublicAssets({ q: "Entertainment", limit: 15, sort: "newest" })
      .then((result) => result.items)
      .catch(() => []),
    listPublicAssets({ q: "Retro", limit: 15, sort: "newest" })
      .then((result) => result.items)
      .catch(() => []),
  ])

  return (
    <>
      <section className="relative w-full overflow-hidden bg-muted py-24 sm:py-32 lg:py-40">
        <div
          className="absolute inset-0 z-0 bg-[url('/images/hero_bg.png')] bg-cover bg-center bg-no-repeat"
          aria-hidden="true"
        />
        <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-col items-center px-4 sm:px-6 lg:px-8">
          <h1 className="mb-10 text-center text-[2.5rem] font-medium tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Browse editorial photos
          </h1>

          <div className="w-full max-w-4xl">
            <SearchBar size="lg" variant="pill" showTypeSelect navigate />
          </div>
        </div>
      </section>

      <HomeCategorySection 
        events={eventsResponse} 
        creativeAssets={creativeAssets} 
        newsAssets={newsAssets}
        sportsAssets={sportsAssets}
        entertainmentAssets={entertainmentAssets}
        retroAssets={retroAssets}
      />
    </>
  )
}
