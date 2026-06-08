"use client"

import { Image as ImageIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"

import { PreviewImage } from "@/components/assets/preview-image"
import type { PublicEvent } from "@/features/assets/types"
import {
  computeJustifiedRows,
  getPreviewAspectRatio,
  type JustifiedRowsOptions,
} from "@/lib/layout/justified-rows"
import { cn } from "@/lib/utils"

const MOBILE_CONTAINER_BREAKPOINT = 640

export const EVENTS_JUSTIFIED_OPTIONS: JustifiedRowsOptions = {
  gap: 1,
  targetRowHeight: 285,
  minRowHeight: 215,
  maxRowHeight: 420,
  justifyLastRow: false,
  minTileWidth: 210,
}

function resolveEventsJustifiedOptions(containerWidth: number): JustifiedRowsOptions {
  if (containerWidth >= MOBILE_CONTAINER_BREAKPOINT) return EVENTS_JUSTIFIED_OPTIONS

  return {
    ...EVENTS_JUSTIFIED_OPTIONS,
    targetRowHeight: 240,
    minRowHeight: 175,
    maxRowHeight: 340,
    minTileWidth: 155,
  }
}

interface PublicEventsGridProps {
  events: PublicEvent[]
  className?: string
  priorityCount?: number
  justifiedOptions?: JustifiedRowsOptions
}

function eventHref(event: PublicEvent): string {
  if (event.previewAssetId) return `/assets/${event.previewAssetId}`
  return `/search?eventId=${event.id}`
}

function formatEventDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(date)
}

export function PublicEventsGrid({
  events,
  className,
  priorityCount = 8,
  justifiedOptions,
}: PublicEventsGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const nextWidth = Math.floor(entry.contentRect.width)
      setContainerWidth((current) => (current === nextWidth ? current : nextWidth))
    })

    observer.observe(element)
    setContainerWidth(Math.floor(element.getBoundingClientRect().width))

    return () => observer.disconnect()
  }, [])

  const layoutOptions = useMemo(
    () => justifiedOptions ?? resolveEventsJustifiedOptions(containerWidth),
    [justifiedOptions, containerWidth],
  )
  const gap = layoutOptions.gap

  const layoutItems = useMemo(
    () =>
      events.map((event) => ({
        id: event.id,
        aspectRatio: getPreviewAspectRatio(event.preview?.width, event.preview?.height),
      })),
    [events],
  )

  const rows = useMemo(
    () => computeJustifiedRows(layoutItems, containerWidth, layoutOptions),
    [layoutItems, containerWidth, layoutOptions],
  )

  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events])
  const priorityIds = useMemo(
    () => new Set(events.slice(0, priorityCount).map((event) => event.id)),
    [events, priorityCount],
  )

  if (!events || events.length === 0) return null

  const showPlaceholder = containerWidth <= 0

  return (
    <div ref={containerRef} className={cn("w-full min-w-0", className)}>
      {showPlaceholder ? (
        <EventsGridPlaceholder />
      ) : (
        rows.map((row) => (
          <div
            key={row.key}
            className="flex w-full"
            style={{
              gap,
              height: row.height,
              marginBottom: gap,
            }}
          >
            {row.items.map((tile) => {
              const event = eventById.get(tile.id)
              if (!event) return null

              return (
                <div
                  key={tile.id}
                  className="shrink-0 overflow-hidden"
                  style={{
                    width: tile.width,
                    flex: `0 0 ${tile.width}px`,
                    height: row.height,
                  }}
                >
                  <PublicEventCard
                    event={event}
                    priority={priorityIds.has(tile.id)}
                    className="h-full w-full"
                  />
                </div>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}

interface PublicEventCardProps {
  event: PublicEvent
  priority?: boolean
  className?: string
}

function PublicEventCard({ event, priority = false, className }: PublicEventCardProps) {
  const eventDateLabel = formatEventDate(event.eventDate)

  return (
    <Link
      href={eventHref(event)}
      className={cn(
        "group relative block h-full w-full overflow-hidden bg-muted",
        className,
      )}
    >
      {event.preview ? (
        <PreviewImage
          src={event.preview.url}
          alt={event.name || "Event preview"}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading={priority ? "eager" : "lazy"}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
          No preview
        </div>
      )}

      {event.assetCount > 0 && (
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-sm bg-black/50 px-2 py-1 text-[13px] font-medium text-white backdrop-blur-md">
          <ImageIcon strokeWidth={2} size={16} />
          <span>
            {event.assetCount} {event.assetCount === 1 ? "image" : "images"}
          </span>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 pt-16">
        {eventDateLabel && (
          <time
            dateTime={event.eventDate ?? undefined}
            className="block line-clamp-1 text-sm font-medium text-white"
          >
            {eventDateLabel}
          </time>
        )}
        <h3 className={cn("line-clamp-2 text-lg font-medium leading-snug text-white", eventDateLabel && "mt-1")}>
          {event.name || "Untitled event"}
        </h3>
        {event.location && (
          <p className="mt-1 line-clamp-1 text-sm text-white/85">
            {event.location}
          </p>
        )}
      </div>
    </Link>
  )
}

function EventsGridPlaceholder() {
  const gap = EVENTS_JUSTIFIED_OPTIONS.gap
  const rowHeight = EVENTS_JUSTIFIED_OPTIONS.targetRowHeight

  return (
    <div className="w-full animate-pulse" aria-hidden>
      {[0, 1, 2].map((rowIndex) => (
        <div
          key={rowIndex}
          className="flex w-full"
          style={{ gap, height: rowHeight, marginBottom: gap }}
        >
          {[1.4, 0.9, 1.1].map((flexGrow, tileIndex) => (
            <div
              key={tileIndex}
              className="h-full bg-muted"
              style={{ flex: flexGrow }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
