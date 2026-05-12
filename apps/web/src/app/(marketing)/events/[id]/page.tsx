import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getPublicAssetFilters, listPublicAssets } from "@/lib/api/fotocorp-api"
import { PublicAssetCard, formatDate } from "@/components/assets/public-asset-card"
import { PlaceholderPage } from "@/components/layout/placeholder-page"

interface EventDetailPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: EventDetailPageProps) {
  const { id } = await params
  return {
    title: `Event ${id} — Fotocorp`,
  }
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params

  const [events, result] = await Promise.all([
    getPublicAssetFilters().then((response) => response.events).catch(() => []),
    listPublicAssets({ eventId: id, limit: 18, sort: "newest" }).catch(() => ({ items: [], nextCursor: null })),
  ])

  const event = events.find((item) => item.id === id)
  if (!event && result.items.length === 0) {
    return (
      <PlaceholderPage
        eyebrow="Event"
        title="Event unavailable."
        description="This event is not currently available for public browsing."
        actions={[{ label: "Browse events", href: "/events" }, { label: "Search archive", href: "/search" }]}
      />
    )
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Event</p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {event?.name ?? "Event archive"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {event?.eventDate ? `${formatDate(event.eventDate)} · ` : ""}{(event?.assetCount ?? result.items.length).toLocaleString()} public images
          </p>
        </div>
        <Link
          href={`/search?eventId=${encodeURIComponent(id)}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          Open in search <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {result.items.length > 0 ? (
        <div className="mt-8 columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4">
          {result.items.map((asset) => (
            <PublicAssetCard key={asset.id} asset={asset} className="mb-3 break-inside-avoid" />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-border bg-muted/25 p-6 text-sm text-muted-foreground">
          No public previews are available for this event right now.
        </div>
      )}
    </section>
  )
}
