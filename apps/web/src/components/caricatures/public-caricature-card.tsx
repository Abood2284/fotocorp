import Link from "next/link"

import { PreviewImage } from "@/components/assets/preview-image"
import {
  formatPublicCaricaturePublishedDate,
  isRecentlyPublishedCaricature,
} from "@/lib/caricatures/caricature-public-display"
import type { CaricatureSearchGridItem } from "@/lib/search/caricature-search"
import { buildCaricatureDetailHref } from "@/lib/search/caricature-search"
import { cn } from "@/lib/utils"

interface PublicCaricatureCardProps {
  item: CaricatureSearchGridItem
  priority?: boolean
  className?: string
}

export function PublicCaricatureCard({ item, priority = false, className }: PublicCaricatureCardProps) {
  const href = buildCaricatureDetailHref(item.id)
  const publishedLabel = formatPublicCaricaturePublishedDate(item.publishedAt)
  const isNew = isRecentlyPublishedCaricature(item.publishedAt)

  return (
    <Link
      href={href}
      className={cn(
        "group relative block h-full w-full overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {item.preview ? (
        <PreviewImage
          src={item.preview.url}
          alt={item.headline}
          className="h-full w-full object-contain transition-transform duration-700 group-hover:scale-105"
          loading={priority ? "eager" : "lazy"}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
          Preview is being prepared.
        </div>
      )}

      {item.categoryName && (
        <span className="absolute left-0 top-0 bg-black/45 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-white">
          {item.categoryName}
        </span>
      )}

      {isNew && (
        <span className="absolute right-0 top-0 bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
          New
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4 pt-16">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-white">{item.headline}</h3>

        {(item.credit || publishedLabel) && (
          <div className="mt-1 flex items-center justify-between gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            {item.credit && (
              <span className="line-clamp-1 text-[11px] text-white/80">{item.credit}</span>
            )}
            {publishedLabel && (
              <time dateTime={item.publishedAt ?? undefined} className="shrink-0 text-[11px] text-white/60">
                {publishedLabel}
              </time>
            )}
          </div>
        )}

        <p className="mt-1 text-right text-[10px] text-white/50">© Fotocorp</p>
      </div>
    </Link>
  )
}
