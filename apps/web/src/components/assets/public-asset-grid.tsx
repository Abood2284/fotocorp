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
  justifyLastRow: true,
  minTileWidth: 150,
}

export const DENSE_JUSTIFIED_OPTIONS: JustifiedRowsOptions = {
  gap: 0,
  targetRowHeight: 140,
  minRowHeight: 110,
  maxRowHeight: 220,
  justifyLastRow: true,
  minTileWidth: 120,
}

const MOBILE_CONTAINER_BREAKPOINT = 640

function resolveJustifiedOptions(
  dense: boolean,
  containerWidth: number,
): JustifiedRowsOptions {
  const base = dense ? DENSE_JUSTIFIED_OPTIONS : DEFAULT_JUSTIFIED_OPTIONS
  if (containerWidth >= MOBILE_CONTAINER_BREAKPOINT) return base

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
  className?: string
  emptyTitle?: string
  emptyDescription?: string
}

/**
 * Canonical public asset browse grid — Getty/Shutterstock-style justified rows.
 */
export function PublicAssetGrid({
  assets,
  limit = 50,
  priorityCount = 8,
  dense = false,
  className,
  emptyTitle = "Previews are being prepared",
  emptyDescription = "The public archive will appear here as soon as watermarked previews are ready.",
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
  const layoutOptions = useMemo(
    () => resolveJustifiedOptions(dense, containerWidth),
    [dense, containerWidth],
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
        <JustifiedGridPlaceholder dense={dense} />
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
            {row.items.map((tile, tileIndex) => {
              const asset = assetById.get(tile.id)
              if (!asset) return null
              const isLastTile = tileIndex === row.items.length - 1

              return (
                <div
                  key={tile.id}
                  className={cn(
                    "overflow-hidden",
                    dense && "!rounded-none",
                    isLastTile ? "min-w-0 flex-1" : "shrink-0",
                  )}
                  style={
                    isLastTile
                      ? { flexBasis: tile.width, height: row.height }
                      : { width: tile.width, flex: `0 0 ${tile.width}px`, height: row.height }
                  }
                >
                  <PublicAssetCard
                    asset={asset}
                    variant="grid"
                    gridLayout="justified"
                    priority={priorityIds.has(tile.id)}
                    className={cn("h-full w-full", dense && "!rounded-none")}
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

function JustifiedGridPlaceholder({ dense }: { dense: boolean }) {
  const rowHeight = dense ? 140 : 200
  const gap = dense ? 0 : 8

  return (
    <div className="w-full animate-pulse" aria-hidden>
      {[0, 1, 2].map((rowIndex) => (
        <div
          key={rowIndex}
          className="flex w-full"
          style={{ gap, height: rowHeight, marginBottom: gap }}
        >
          <div className="h-full flex-[3] bg-muted" />
          <div className="h-full flex-[2] bg-muted" />
          <div className="h-full flex-1 bg-muted" />
        </div>
      ))}
    </div>
  )
}
