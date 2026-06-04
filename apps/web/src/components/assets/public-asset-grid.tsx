"use client"

import { Images } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import type { PublicAsset } from "@/features/assets/types"
import { PublicAssetCard } from "@/components/assets/public-asset-card"
import { EmptyState } from "@/components/shared/empty-state"

import {
  computeJustifiedRows,
  getPreviewAspectRatio,
  type JustifiedRowsOptions,
} from "@/lib/layout/justified-rows"
import { cn } from "@/lib/utils"

export const DEFAULT_JUSTIFIED_OPTIONS: JustifiedRowsOptions = {
  gap: 8,
  targetRowHeight: 200,
  minRowHeight: 140,
  maxRowHeight: 320,
  justifyLastRow: false,
  minTileWidth: 150,
}

export const DENSE_JUSTIFIED_OPTIONS: JustifiedRowsOptions = {
  gap: 0,
  targetRowHeight: 140,
  minRowHeight: 110,
  maxRowHeight: 220,
  justifyLastRow: false,
  minTileWidth: 120,
}

/** Homepage Royalty Free band — fewer, larger tiles (~3–4 per row on desktop). */
export const FEATURED_JUSTIFIED_OPTIONS: JustifiedRowsOptions = {
  gap: 8,
  targetRowHeight: 280,
  minRowHeight: 220,
  maxRowHeight: 400,
  justifyLastRow: false,
  minTileWidth: 300,
}

const MOBILE_CONTAINER_BREAKPOINT = 640

function resolveJustifiedOptions(
  layout: "default" | "dense" | "featured",
  containerWidth: number,
): JustifiedRowsOptions {
  const base = layout === "dense"
    ? DENSE_JUSTIFIED_OPTIONS
    : layout === "featured"
      ? FEATURED_JUSTIFIED_OPTIONS
      : DEFAULT_JUSTIFIED_OPTIONS
  if (containerWidth >= MOBILE_CONTAINER_BREAKPOINT) return base

  if (layout === "featured") {
    return {
      ...base,
      targetRowHeight: Math.min(base.targetRowHeight, 220),
      minRowHeight: Math.min(base.minRowHeight, 180),
      maxRowHeight: Math.min(base.maxRowHeight, 320),
      minTileWidth: Math.min(base.minTileWidth ?? 300, 260),
    }
  }

  return {
    ...base,
    targetRowHeight: Math.min(base.targetRowHeight, 160),
    minRowHeight: Math.min(base.minRowHeight, 120),
    maxRowHeight: Math.min(base.maxRowHeight, 240),
    minTileWidth: Math.min(base.minTileWidth ?? 150, 130),
  }
}

export interface PublicAssetGridProps {
  assets: PublicAsset[]
  /** Cap tiles rendered (default 50). */
  limit?: number
  /** How many leading images load eagerly (default 8). */
  priorityCount?: number
  /** Tighter mosaic strip (e.g. homepage “newest” band). */
  dense?: boolean
  /** Larger tiles with ~3–4 per row (e.g. homepage Royalty Free). */
  featured?: boolean
  /** Override justified-row tuning (e.g. asset detail narrow column). */
  justifiedOptions?: JustifiedRowsOptions
  className?: string
  emptyTitle?: string
  emptyDescription?: string
  detailHrefForAsset?: (asset: PublicAsset) => string
}

/**
 * Canonical public asset browse grid — Getty/Shutterstock-style justified rows.
 */
export function PublicAssetGrid({
  assets,
  limit = 50,
  priorityCount = 8,
  dense = false,
  featured = false,
  justifiedOptions,
  className,
  emptyTitle = "Previews are being prepared",
  emptyDescription = "The public archive will appear here as soon as watermarked previews are ready.",
  detailHrefForAsset,
}: PublicAssetGridProps) {
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

  const items = useMemo(() => assets.slice(0, limit), [assets, limit])
  const layoutMode = featured ? "featured" : dense ? "dense" : "default"
  const layoutOptions = useMemo(
    () => justifiedOptions ?? resolveJustifiedOptions(layoutMode, containerWidth),
    [justifiedOptions, layoutMode, containerWidth],
  )
  const gap = layoutOptions.gap

  const layoutItems = useMemo(
    () =>
      items.map((asset) => {
        const preview = asset.previews.card ?? asset.previews.thumb
        return {
          id: asset.id,
          aspectRatio: getPreviewAspectRatio(preview?.width, preview?.height),
        }
      }),
    [items],
  )

  const rows = useMemo(
    () => computeJustifiedRows(layoutItems, containerWidth, layoutOptions),
    [layoutItems, containerWidth, layoutOptions],
  )

  const assetById = useMemo(() => new Map(items.map((asset) => [asset.id, asset])), [items])
  const priorityIds = useMemo(
    () => new Set(items.slice(0, priorityCount).map((asset) => asset.id)),
    [items, priorityCount],
  )

  if (assets.length === 0) {
    return (
      <EmptyState
        icon={Images}
        title={emptyTitle}
        description={emptyDescription}
        className="rounded-lg border border-border bg-muted/20"
      />
    )
  }

  const showPlaceholder = containerWidth <= 0

  return (
    <div ref={containerRef} className={cn("w-full min-w-0", className)}>
      {showPlaceholder ? (
        <JustifiedGridPlaceholder layoutMode={layoutMode} />
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
              const asset = assetById.get(tile.id)
              if (!asset) return null

              return (
                <div
                  key={tile.id}
                  className={cn(
                    "shrink-0 overflow-hidden",
                    (dense || featured) && "!rounded-none",
                  )}
                  style={{
                    width: tile.width,
                    flex: `0 0 ${tile.width}px`,
                    height: row.height,
                  }}
                >
                  <PublicAssetCard
                    asset={asset}
                    variant="grid"
                    gridLayout="justified"
                    priority={priorityIds.has(tile.id)}
                    detailHref={detailHrefForAsset?.(asset)}
                    className={cn("h-full w-full", (dense || featured) && "!rounded-none")}
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

function JustifiedGridPlaceholder({ layoutMode }: { layoutMode: "default" | "dense" | "featured" }) {
  const rowHeight = layoutMode === "dense" ? 140 : layoutMode === "featured" ? 280 : 200
  const gap = layoutMode === "dense" ? 0 : 8
  const tileCount = layoutMode === "featured" ? 4 : 3

  return (
    <div className="w-full animate-pulse px-4 sm:px-6 lg:px-8" aria-hidden>
      {[0, 1, 2].map((rowIndex) => (
        <div
          key={rowIndex}
          className="flex w-full"
          style={{ gap, height: rowHeight, marginBottom: gap }}
        >
          {Array.from({ length: tileCount }).map((_, tileIndex) => (
            <div
              key={tileIndex}
              className="h-full flex-1 bg-muted"
              style={{ flex: tileIndex === 0 ? 1.2 : 1 }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
