"use client"

import Image from "next/image"
import Link from "next/link"
import { Download, Eye, Heart, Images, Lock, ShieldCheck } from "lucide-react"
import { isAssetLocked as resolveAssetLocked } from "@/features/assets/access"
import type { AssetListItem } from "@/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AssetViewMode } from "@/features/assets/filter-utils"

interface AssetCardProps {
  asset: AssetListItem
  isLocked?: boolean
  viewMode?: AssetViewMode
  className?: string
  priority?: boolean
  onPreview?: (asset: AssetListItem) => void
}

export function AssetCard({
  asset,
  isLocked,
  viewMode = "grid",
  className,
  priority,
  onPreview,
}: AssetCardProps) {
  const locked = isLocked ?? resolveAssetLocked(asset)
  const displayTitle = asset.title ?? asset.filename.replace(/\.[a-z0-9]+$/i, "")
  const isGridMode = viewMode === "grid"

  return (
    <article
      className={cn(
        "group relative overflow-hidden transition-all duration-200 ease-out",
        isGridMode ? "break-inside-avoid mb-2 sm:mb-3 rounded-sm hover:-translate-y-1 hover:shadow-xl hover:z-10 focus-within:-translate-y-1 focus-within:shadow-xl focus-within:z-10 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 cursor-pointer" : "rounded-md border border-border bg-card sm:flex sm:items-stretch",
        className,
      )}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden bg-muted",
          !isGridMode && "aspect-4/3 sm:w-80 sm:shrink-0",
        )}
      >
        <Link href={`/assets/${asset.id}`} aria-label={`Open ${displayTitle}`} className="outline-none">
          {isGridMode ? (
            <Image
              src={asset.thumbnailUrl}
              alt={displayTitle}
              width={asset.width || 800}
              height={asset.height || 600}
              priority={priority}
              sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 20vw, (min-width: 1024px) 24vw, (min-width: 640px) 33vw, 50vw"
              className="h-auto w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.04] group-focus-within:scale-[1.04]"
            />
          ) : (
            <Image
              src={asset.thumbnailUrl}
              alt={displayTitle}
              fill
              priority={priority}
              sizes="(min-width: 640px) 320px, 100vw"
              className="object-cover transition-transform duration-200 ease-out group-hover:scale-[1.04] group-focus-within:scale-[1.04]"
            />
          )}
        </Link>

        {locked && (
          <div className="absolute left-2 top-2 z-10">
            <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-black/40 text-white backdrop-blur-sm">
              <Lock className="h-3 w-3" />
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-within:opacity-100" />
        
        <div className="absolute inset-x-3 bottom-3 translate-y-2 opacity-0 transition-all duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
          <div className="flex items-center justify-between">
            <button
              aria-label="Preview asset"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onPreview?.(asset);
              }}
              className="p-1.5 text-white/80 transition-all duration-200 hover:scale-110 hover:text-white drop-shadow-md"
            >
              <Eye className="h-5 w-5" />
            </button>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Save asset"
                onClick={(e) => e.preventDefault()}
                className="p-1.5 text-white/80 transition-all duration-200 hover:scale-110 hover:text-white drop-shadow-md"
              >
                <Heart className="h-5 w-5" />
              </button>
              {!locked && (
                <button
                  type="button"
                  aria-label="Download asset"
                  onClick={(e) => e.preventDefault()}
                  className="p-1.5 text-white/80 transition-all duration-200 hover:scale-110 hover:text-white drop-shadow-md"
                >
                  <Download className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {viewMode === "list" && (
        <div className="flex flex-1 flex-col p-3">
          <Link
            href={`/assets/${asset.id}`}
            className="fc-body line-clamp-1 text-sm font-medium leading-tight text-foreground hover:underline"
          >
            {displayTitle}
          </Link>
          <p className="fc-caption mt-0.5 truncate leading-tight text-muted-foreground">
            {asset.filename}
          </p>
          {asset.width && asset.height && (
            <p className="fc-caption mt-1 text-muted-foreground">
              {asset.width.toLocaleString()} × {asset.height.toLocaleString()} px
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {asset.keywords.slice(0, 6).map((keyword, keywordIndex) => (
              <Badge key={`${keyword}-${keywordIndex}`} variant="muted" className="text-[10px] capitalize">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}

