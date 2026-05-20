import type { AssetViewMode } from "@/features/assets/filter-utils"
import { cn } from "@/lib/utils"

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className,
      )}
      {...props}
    />
  )
}

export function AssetCardSkeleton({ viewMode = "grid" }: { viewMode?: AssetViewMode }) {
  return (
    <div className={cn("flex flex-col gap-2", viewMode === "list" && "rounded-xl border border-border bg-card p-3 sm:flex-row")}>
      <Skeleton className={cn(viewMode === "grid" ? "aspect-4/5 w-full rounded-xl" : "aspect-4/3 w-full rounded-lg sm:w-80 sm:shrink-0")} />
      {viewMode === "list" && (
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      )}
    </div>
  )
}

function JustifiedGridSkeletonRows({ rows = 3 }: { rows?: number }) {
  const rowHeight = 200
  const gap = 8

  return (
    <div className="w-full">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex w-full"
          style={{ gap, height: rowHeight, marginBottom: gap }}
        >
          <Skeleton className="h-full flex-[3] rounded-none" />
          <Skeleton className="h-full flex-[2] rounded-none" />
          <Skeleton className="h-full flex-1 rounded-none" />
        </div>
      ))}
    </div>
  )
}

export function AssetGridSkeleton({
  count = 8,
  viewMode = "grid",
}: {
  count?: number
  viewMode?: AssetViewMode
}) {
  if (viewMode === "grid") {
    return <JustifiedGridSkeletonRows rows={Math.min(4, Math.max(2, Math.ceil(count / 4)))} />
  }

  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <AssetCardSkeleton key={i} viewMode={viewMode} />
      ))}
    </div>
  )
}
