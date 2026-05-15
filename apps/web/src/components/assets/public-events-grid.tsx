import Link from "next/link"
import { Image as ImageIcon } from "lucide-react"
import { PreviewImage } from "@/components/assets/preview-image"
import type { PublicEvent } from "@/features/assets/types"

interface PublicEventsGridProps {
  events: PublicEvent[]
}

export function PublicEventsGrid({ events }: PublicEventsGridProps) {
  if (!events || events.length === 0) return null

  return (
    <div className="grid w-full grid-cols-1 gap-[1px] bg-background sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 auto-rows-[300px] sm:auto-rows-[400px] lg:auto-rows-[500px]">
      {events.map((event) => (
        <Link
          key={event.id}
          href={`/search?eventId=${event.id}`}
          className="group relative block h-full w-full overflow-hidden bg-muted"
        >
          {event.preview ? (
            <PreviewImage
              src={event.preview.url}
              alt={event.name || "Event preview"}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
              No preview
            </div>
          )}
          
          {event.assetCount > 0 && (
            <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-sm bg-black/50 px-2 py-1 text-[13px] font-medium text-white backdrop-blur-md">
              <ImageIcon className="h-4 w-4" strokeWidth={2} />
              <span>{event.assetCount} {event.assetCount === 1 ? 'image' : 'images'}</span>
            </div>
          )}
          
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 pt-16">
            <h3 className="mt-1 line-clamp-2 text-lg font-medium leading-snug text-white">
              {event.name || "Untitled event"}
            </h3>
          </div>
        </Link>
      ))}
    </div>
  )
}
