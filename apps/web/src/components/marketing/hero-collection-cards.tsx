"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Image as ImageIcon, ArrowRight } from "lucide-react"
import { fetchPublicLatestEvents } from "@/lib/api/fotocorp-api"
import type { PublicHomepageEvent } from "@/features/assets/types"
import { PreviewImage } from "@/components/assets/preview-image"

const CARD_LABELS = ["Latest", "Editorial", "Archive", "Featured"] as const

function formatEventDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(dateStr))
  } catch {
    return null
  }
}

interface CollectionCardProps {
  event: PublicHomepageEvent
  label: string
  animationDelay: number
}

function CollectionCard({ event, label, animationDelay }: CollectionCardProps) {
  const displayDate = formatEventDate(event.eventDate ?? event.createdAt)

  return (
    <Link
      href={`/search?eventId=${event.id}`}
      className="hero-card group relative block w-full overflow-hidden rounded-2xl bg-muted"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {event.previewUrl ? (
        <PreviewImage
          src={event.previewUrl}
          alt={event.title || "Collection preview"}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-[#1a2540] to-[#263460]" />
      )}

      {/* Bottom gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Label pill — top left */}
      <div className="absolute left-3 top-3 rounded-sm bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-white backdrop-blur-sm">
        {label}
      </div>

      {/* Asset count — top right */}
      {event.assetCount > 0 && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-sm bg-black/40 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
          <ImageIcon className="h-3 w-3" strokeWidth={2} />
          <span>{event.assetCount}</span>
        </div>
      )}

      {/* Card footer */}
      <div className="absolute inset-x-0 bottom-0 p-4 pt-10">
        <h3 className="mb-1 line-clamp-2 text-base font-semibold leading-snug text-white drop-shadow-sm">
          {event.title || "Untitled collection"}
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-white/60">
            {displayDate ?? (event.assetCount > 0 ? `${event.assetCount} images` : "Collection")}
          </span>
          <span className="flex items-center gap-1 text-[12px] font-medium text-white/80 transition-colors group-hover:text-white">
            View collection
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}

function FallbackCard({ index, animationDelay }: { index: number; animationDelay: number }) {
  const label = CARD_LABELS[index % CARD_LABELS.length]
  return (
    <Link
      href="/search"
      className="hero-card group relative block w-full overflow-hidden rounded-2xl"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Static gradient background */}
      <div className="h-full w-full bg-gradient-to-br from-[#1a2540] via-[#263460] to-[#0d0f1a]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

      {/* Label */}
      <div className="absolute left-3 top-3 rounded-sm bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-white backdrop-blur-sm">
        {label}
      </div>

      {/* Footer */}
      <div className="absolute inset-x-0 bottom-0 p-4 pt-10">
        <h3 className="mb-1 text-base font-semibold leading-snug text-white">
          {index === 0 ? "Explore the archive" : "Pan-India editorial coverage"}
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-white/60">Fotocorp collection</span>
          <span className="flex items-center gap-1 text-[12px] font-medium text-white/80 transition-colors group-hover:text-white">
            View collection
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}

function CardSkeleton() {
  return (
    <div className="w-full animate-pulse rounded-2xl bg-muted" />
  )
}

export function HeroCollectionCards() {
  const [events, setEvents] = useState<PublicHomepageEvent[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    let cancelled = false

    fetchPublicLatestEvents({ windowDays: 60, limit: 8 })
      .then((res) => {
        if (cancelled) return
        // Only use events that have a preview image and non-zero asset count
        const valid = res.items.filter(
          (e) => e.previewUrl && e.assetCount > 0
        )
        setEvents(valid.slice(0, 2))
        setStatus("ready")
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (status === "loading") {
    return (
      <div className="hero-cards-grid">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  const cards = events.length >= 2 ? events : []

  if (status === "error" || cards.length < 2) {
    // Render 2 graceful fallback cards
    return (
      <div className="hero-cards-grid">
        <FallbackCard index={0} animationDelay={220} />
        <FallbackCard index={1} animationDelay={340} />
      </div>
    )
  }

  return (
    <div className="hero-cards-grid">
      {cards.map((event, i) => (
        <CollectionCard
          key={event.id}
          event={event}
          label={CARD_LABELS[i % CARD_LABELS.length]}
          animationDelay={200 + i * 120}
        />
      ))}
    </div>
  )
}
