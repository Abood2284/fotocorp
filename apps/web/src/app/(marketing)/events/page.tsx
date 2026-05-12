import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getPublicAssetFilters } from "@/lib/api/fotocorp-api"
import { PlaceholderPage } from "@/components/layout/placeholder-page"

export const metadata = {
  title: "Events — Fotocorp",
}

export default async function EventsPage() {
  const events = await getPublicAssetFilters()
    .then((result) => result.events)
    .catch(() => [])

  if (events.length === 0) {
    return (
      <PlaceholderPage
        eyebrow="Events"
        title="Browse latest events."
        description="Explore date-wise image sets from recent coverage."
      />
    )
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Events</p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="fc-display text-4xl tracking-tight text-foreground sm:text-5xl">Browse latest events.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Explore date-wise image sets from recent coverage.
          </p>
        </div>
        <Link href="/search?sort=latest" className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          Latest images <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/search?eventId=${encodeURIComponent(event.id)}`}
            className="rounded-xl border border-border bg-background p-5 transition-colors hover:bg-muted/50"
          >
            <span className="block text-lg font-semibold text-foreground">{event.name ?? "Untitled event"}</span>
            <span className="mt-2 block text-sm text-muted-foreground">{event.assetCount.toLocaleString()} public images</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
