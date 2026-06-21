"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { PublicCaricatureCard } from "@/components/caricatures/public-caricature-card"
import {
  computeJustifiedRows,
  getPreviewAspectRatio,
  type JustifiedRowsOptions,
} from "@/lib/layout/justified-rows"
import type { CaricatureSearchGridItem } from "@/lib/search/caricature-search"
import { cn } from "@/lib/utils"

const MOBILE_CONTAINER_BREAKPOINT = 640

export const CARICATURES_JUSTIFIED_OPTIONS: JustifiedRowsOptions = {
  gap: 2,
  targetRowHeight: 320,
  minRowHeight: 220,
  maxRowHeight: 500,
  justifyLastRow: false,
  minTileWidth: 200,
}

function resolveCaricaturesJustifiedOptions(containerWidth: number): JustifiedRowsOptions {
  if (containerWidth >= MOBILE_CONTAINER_BREAKPOINT) return CARICATURES_JUSTIFIED_OPTIONS

  return {
    ...CARICATURES_JUSTIFIED_OPTIONS,
    targetRowHeight: 260,
    minRowHeight: 180,
    maxRowHeight: 400,
    minTileWidth: 150,
  }
}

interface CaricatureSearchResultGridProps {
  items: CaricatureSearchGridItem[]
  priorityCount?: number
  className?: string
  justifiedOptions?: JustifiedRowsOptions
}

export function CaricatureSearchResultGrid({
  items,
  priorityCount = 8,
  className,
  justifiedOptions,
}: CaricatureSearchResultGridProps) {
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

  const layoutOptions = useMemo(
    () => justifiedOptions ?? resolveCaricaturesJustifiedOptions(containerWidth),
    [justifiedOptions, containerWidth],
  )
  const gap = layoutOptions.gap

  const layoutItems = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        aspectRatio: getPreviewAspectRatio(item.preview?.width, item.preview?.height),
      })),
    [items],
  )

  const rows = useMemo(
    () => computeJustifiedRows(layoutItems, containerWidth, layoutOptions),
    [layoutItems, containerWidth, layoutOptions],
  )

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const priorityIds = useMemo(
    () => new Set(items.slice(0, priorityCount).map((item) => item.id)),
    [items, priorityCount],
  )

  if (!items || items.length === 0) return null

  const showPlaceholder = containerWidth <= 0

  return (
    <div ref={containerRef} className={cn("w-full min-w-0", className)}>
      {showPlaceholder ? (
        <CaricaturesGridPlaceholder />
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
              const item = itemById.get(tile.id)
              if (!item) return null

              return (
                <div
                  key={tile.id}
                  className="shrink-0 overflow-hidden"
                  style={{
                    width: tile.width,
                    flex: `0 0 ${tile.width}px`,
                    height: row.height,
                  }}
                >
                  <PublicCaricatureCard
                    item={item}
                    priority={priorityIds.has(tile.id)}
                    className="h-full w-full"
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

function CaricaturesGridPlaceholder() {
  const gap = CARICATURES_JUSTIFIED_OPTIONS.gap
  const rowHeight = CARICATURES_JUSTIFIED_OPTIONS.targetRowHeight

  return (
    <div className="w-full animate-pulse" aria-hidden>
      {[0, 1, 2].map((rowIndex) => (
        <div
          key={rowIndex}
          className="flex w-full"
          style={{ gap, height: rowHeight, marginBottom: gap }}
        >
          {[1.3, 0.85, 1.1].map((flexGrow, tileIndex) => (
            <div
              key={tileIndex}
              className="h-full bg-muted"
              style={{ flex: flexGrow }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
