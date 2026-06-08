import { PublicEventsGrid } from "@/components/assets/public-events-grid"
import type { PublicEvent, PublicSearchEventResult } from "@/features/assets/types"

interface SearchEventResultsGridProps {
  events: PublicSearchEventResult[]
}

export function SearchEventResultsGrid({ events }: SearchEventResultsGridProps) {
  if (events.length === 0) return null

  return <PublicEventsGrid events={events.map(mapSearchEventToPublicEvent)} />
}

function mapSearchEventToPublicEvent(event: PublicSearchEventResult): PublicEvent {
  const hasPreviewDimensions = Boolean(event.previewWidth && event.previewHeight)

  return {
    id: event.eventId,
    name: event.eventTitle ?? "Untitled event",
    eventDate: event.eventDate,
    assetCount: event.matchingAssetCount,
    previewAssetId: event.representativeAssetId,
    location: event.eventLocation,
    preview: event.previewUrl
      ? {
          url: event.previewUrl,
          width: hasPreviewDimensions ? event.previewWidth! : 4,
          height: hasPreviewDimensions ? event.previewHeight! : 3,
        }
      : null,
  }
}
