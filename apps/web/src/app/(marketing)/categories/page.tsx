import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getPublicAssetFilters } from "@/lib/api/fotocorp-api"
import { PlaceholderPage } from "@/components/layout/placeholder-page"

export const metadata = {
  title: "Categories — Fotocorp",
}

export default async function CategoriesPage() {
  const categories = await getPublicAssetFilters()
    .then((result) => result.categories)
    .catch(() => [])

  if (categories.length === 0) {
    return (
      <PlaceholderPage
        eyebrow="Categories"
        title="Browse the archive by category."
        description="Explore editorial visuals across events, people, culture, business, politics, and more."
      />
    )
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Categories</p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="fc-display text-4xl tracking-tight text-foreground sm:text-5xl">Browse the archive by category.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Explore editorial visuals across events, people, culture, business, politics, and more.
          </p>
        </div>
        <Link href="/search" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          Search all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/search?categoryId=${encodeURIComponent(category.id)}`}
            className="rounded-xl border border-border bg-background p-5 transition-colors hover:bg-muted/50"
          >
            <span className="block text-lg font-semibold text-foreground">{category.name}</span>
            <span className="mt-2 block text-sm text-muted-foreground">{category.assetCount.toLocaleString()} public images</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
