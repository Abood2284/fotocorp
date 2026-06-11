import { Skeleton } from "@/components/ui/skeleton"

export default function ContributorPortalLoading() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Stat cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="mt-4 h-9 w-16" />
            <Skeleton className="mt-1 h-4 w-32" />
          </div>
        ))}
      </div>

      {/* Table section skeleton */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-40" />
        </div>

        {/* Filter pills */}
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-border">
          {/* Table header */}
          <div className="flex items-center gap-4 border-b border-border bg-muted/50 px-5 py-3">
            <Skeleton className="h-3 w-12 rounded" />
            <Skeleton className="h-3 w-32 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-12 rounded" />
          </div>
          {/* Table rows */}
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-5 py-3.5"
              >
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 flex-1 rounded" />
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-4 w-12 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  )
}
