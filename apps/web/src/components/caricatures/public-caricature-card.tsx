import Link from "next/link"

import { PreviewImage } from "@/components/assets/preview-image"
import {
  buildCaricatureCardSubjectPreview,
  formatPublicCaricaturePublishedDate,
  isRecentlyPublishedCaricature,
} from "@/lib/caricatures/caricature-public-display"
import type { CaricatureSearchGridItem } from "@/lib/search/caricature-search"
import { buildCaricatureDetailHref } from "@/lib/search/caricature-search"
import { cn } from "@/lib/utils"

const LANGUAGE_SHORT: Record<string, string> = {
  ENGLISH: "EN",
  HINDI: "HI",
  MARATHI: "MR",
  URDU: "UR",
  MIXED: "MX",
}

interface PublicCaricatureCardProps {
  item: CaricatureSearchGridItem
  priority?: boolean
  className?: string
}

export function PublicCaricatureCard({ item, priority = false, className }: PublicCaricatureCardProps) {
  const href = buildCaricatureDetailHref(item.id)
  const publishedLabel = formatPublicCaricaturePublishedDate(item.publishedAt)
  const isNew = isRecentlyPublishedCaricature(item.publishedAt)
  const { visible: subjectPreviews, overflowCount } = buildCaricatureCardSubjectPreview(item.depictedSubjects, 2)
  const langShort = item.language ? (LANGUAGE_SHORT[item.language.toUpperCase()] ?? null) : null

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

      {/* Top-left: category */}
      {item.categoryName && (
        <span className="absolute left-0 top-0 bg-black/50 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-white">
          {item.categoryName}
        </span>
      )}

      {/* Top-right: "New" + language stacked */}
      <div className="absolute right-0 top-0 flex flex-col items-end">
        {isNew && (
          <span className="bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
            New
          </span>
        )}
        {langShort && (
          <span className="bg-primary/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            {langShort}
          </span>
        )}
      </div>

      {/* Bottom overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent p-3 pt-16">
        {/* Depicted subjects — who is in this caricature */}
        {subjectPreviews.length > 0 && (
          <div className="mb-1.5 flex flex-wrap items-center gap-1">
            {subjectPreviews.map((subject) => (
              <span
                key={subject}
                className="bg-white/15 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white"
              >
                {subject}
              </span>
            ))}
            {overflowCount > 0 && (
              <span className="text-[10px] text-white/50">+{overflowCount}</span>
            )}
          </div>
        )}

        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-white">{item.headline}</h3>

        {(item.credit || publishedLabel || item.hasTranslation) && (
          <div className="mt-1.5 flex items-center justify-between gap-2">
            {item.credit && (
              <span className="line-clamp-1 text-[11px] text-white/80">{item.credit}</span>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {item.hasTranslation && (
                <span className="text-[9px] font-semibold uppercase tracking-widest text-white/45">EN</span>
              )}
              {publishedLabel && (
                <time dateTime={item.publishedAt ?? undefined} className="text-[11px] text-white/60">
                  {publishedLabel}
                </time>
              )}
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}
