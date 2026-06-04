"use client"

import { useState } from "react"
import Link from "next/link"
import type { PublicAsset } from "@/features/assets/types"
import { PublicAssetGrid } from "@/components/assets/public-asset-grid"
import { listPublicAssets } from "@/lib/api/fotocorp-api"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface RelatedGalleryProps {
  initialAssets: PublicAsset[]
  initialCursor: string | null
  currentAssetId: string
  eventId: string | null
  categoryId: string | null
  contributorId: string | null
  totalCount: number
  label: string
  browseHref: string
  relatedCountLabel: string | null
  /** `column` = left column on landscape detail (width stops at sidebar). `full` = below the grid. */
  placement?: "full" | "column"
}

export function RelatedGallery({
  initialAssets,
  initialCursor,
  currentAssetId,
  eventId,
  categoryId,
  contributorId,
  totalCount,
  label,
  browseHref,
  relatedCountLabel,
  placement = "full",
}: RelatedGalleryProps) {
  const [assets, setAssets] = useState<PublicAsset[]>(initialAssets)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialCursor !== null && initialAssets.length < totalCount)
  const isColumn = placement === "column"

  async function handleLoadMore() {
    if (loading || !cursor) return
    setLoading(true)

    try {
      const res = await listPublicAssets({
        eventId: eventId ?? undefined,
        categoryId: categoryId ?? undefined,
        contributorId: contributorId ?? undefined,
        cursor,
        limit: 12,
      })

      const newItems = res.items.filter((item) => item.id !== currentAssetId && !assets.some((a) => a.id === item.id))
      const nextAssets = [...assets, ...newItems]
      setAssets(nextAssets)
      setCursor(res.nextCursor)
      setHasMore(res.nextCursor !== null && nextAssets.length < totalCount)
    } catch (err) {
      console.error("Failed to load more related assets:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      id="event-gallery-section"
      className={cn(
        "scroll-mt-28 min-w-0",
        isColumn ? "mt-6 lg:mt-5" : "mt-6 border-t border-border pt-2",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{label}</h2>
        {relatedCountLabel ? (
          <span className="text-sm font-normal tabular-nums text-muted-foreground">
            ({relatedCountLabel})
          </span>
        ) : null}
        <Link
          href={browseHref}
          className="text-sm font-normal text-primary underline underline-offset-4 hover:text-primary-hover"
        >
          View all
        </Link>
      </div>

      {assets.length > 0 ? (
        <>
          <div className="mt-6">
            <PublicAssetGrid assets={assets} limit={assets.length} />
          </div>

          {loading && (
            <div className="mt-2 w-full animate-pulse" aria-hidden>
              <div className="flex w-full" style={{ gap: 8, height: 200, marginBottom: 8 }}>
                <div className="h-full flex-[3] bg-muted" />
                <div className="h-full flex-[2] bg-muted" />
                <div className="h-full flex-1 bg-muted" />
              </div>
            </div>
          )}

          {hasMore && !loading && (
            <div className="mt-8 flex justify-center">
              <Button
                type="button"
                variant="outline"
                className="button-outline-square inline-flex h-12 px-8 cursor-pointer uppercase font-sans text-xs font-bold tracking-wider hover:bg-black hover:text-white transition-colors"
                onClick={handleLoadMore}
              >
                {label.toLowerCase().includes("event")
                  ? "Load more images from this event"
                  : label.toLowerCase().includes("category")
                    ? "Load more images from this category"
                    : label.toLowerCase().includes("photographer")
                      ? "Load more images by this photographer"
                      : "Load more images"}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="mt-6 rounded-none border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          Related previews are not available right now. Use archive search to keep browsing.
        </div>
      )}
    </section>
  )
}
