import { PreviewImage } from "@/components/assets/preview-image"
import type { CaricatureSearchGridItem } from "@/lib/search/caricature-search"
import { cn } from "@/lib/utils"

interface CaricatureSearchResultGridProps {
  items: CaricatureSearchGridItem[]
  priorityCount?: number
  className?: string
}

export function CaricatureSearchResultGrid({
  items,
  priorityCount = 8,
  className,
}: CaricatureSearchResultGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 border-l border-t border-border bg-background sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5",
        className,
      )}
    >
      {items.map((item, index) => (
        <article
          key={item.id}
          className="group relative overflow-hidden border-b border-r border-border bg-muted text-white transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          <div
            className="relative min-h-[220px] overflow-hidden bg-background"
            style={item.preview ? { aspectRatio: getPreviewAspectRatio(item.preview) } : undefined}
          >
            {item.preview ? (
              <PreviewImage
                src={item.preview.url}
                alt={item.headline}
                className="block h-full w-full object-contain transition-transform duration-700 ease-out group-hover:scale-[1.025]"
                loading={index < priorityCount ? "eager" : "lazy"}
              />
            ) : (
              <div className="flex h-full min-h-[220px] items-center justify-center px-5 text-center text-sm text-muted-foreground">
                Preview is being prepared.
              </div>
            )}

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-black/15 to-black/70 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100" />
            <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
              <p className="line-clamp-2 text-lg font-bold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
                {item.headline}
              </p>
              {(item.credit || item.categoryName) && (
                <p className="mt-1 line-clamp-1 text-sm text-white/90">
                  {[item.credit, item.categoryName].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

function getPreviewAspectRatio(preview: NonNullable<CaricatureSearchGridItem["preview"]>) {
  if (preview.width > 0 && preview.height > 0) return `${preview.width} / ${preview.height}`
  return "4 / 5"
}
