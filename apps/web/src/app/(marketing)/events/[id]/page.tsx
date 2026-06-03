import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { formatDate } from "@/components/assets/public-asset-card"
import { PublicAssetGrid } from "@/components/assets/public-asset-grid"
import { PlaceholderPage } from "@/components/layout/placeholder-page"
import { listPublicAssets } from "@/lib/api/fotocorp-api"

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

  const result = await listPublicAssets({ eventId: id, limit: 18, sort: "newest" }).catch(() => ({
    items: [],
    nextCursor: null,
  }))

  const event = result.items.find((item) => item.event?.id === id)?.event ?? null
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
          {event?.eventDate ? (
            <p className="mt-2 text-sm text-muted-foreground">{formatDate(event.eventDate)}</p>
          ) : null}
        </div>
        <Link
          href={`/search?eventId=${encodeURIComponent(id)}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          Open in search <ArrowRight size={16} />
        </Link>
      </div>

      {result.items.length > 0 ? (
        <PublicAssetGrid assets={result.items} className="mt-8" />
      ) : (
        <div className="mt-8 rounded-2xl border border-border bg-muted/25 p-6 text-sm text-muted-foreground">
          No public previews are available for this event right now.
        </div>
      )}
    </section>
  )
}
