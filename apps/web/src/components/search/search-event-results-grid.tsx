import { Image as ImageIcon } from "lucide-react"
import Link from "next/link"

import { PreviewImage } from "@/components/assets/preview-image"
import type { PublicSearchEventResult } from "@/features/assets/types"
import { cn, formatInteger } from "@/lib/utils"

interface SearchEventResultsGridProps {
  events: PublicSearchEventResult[]
}

export function SearchEventResultsGrid({ events }: SearchEventResultsGridProps) {
  if (events.length === 0) return null

  return (
    <div className="grid w-full grid-cols-1 gap-[1px] bg-background sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-[280px] sm:auto-rows-[320px]">
      {events.map((event) => {
        const eventDateLabel = formatEventDate(event.eventDate)

        return (
        <Link
          key={event.eventId}
          href={`/assets/${event.representativeAssetId}`}
          className="group relative block h-full w-full overflow-hidden bg-muted"
        >
          {event.previewUrl && event.previewWidth && event.previewHeight ? (
            <PreviewImage
              src={event.previewUrl}
              alt={event.eventTitle || "Event preview"}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
              No preview
            </div>
          )}

          {event.matchingAssetCount > 0 && (
            <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-sm bg-black/50 px-2 py-1 text-[13px] font-medium text-white backdrop-blur-md">
              <ImageIcon strokeWidth={2} size={16} />
              <span>{formatInteger(event.matchingAssetCount)} images</span>
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
              {event.eventTitle || "Untitled event"}
            </h3>
            {event.eventLocation && (
              <p className="mt-1 line-clamp-1 text-sm text-white/85">
                {event.eventLocation}
              </p>
            )}
          </div>
        </Link>
        )
      })}
    </div>
  )
}

function formatEventDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(date)
}
