import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function SearchCategoryTabsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3 overflow-x-auto px-4 py-3 sm:px-6", className)}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-24 shrink-0 rounded-none" />
      ))}
    </div>
  )
}

export function SearchFilterPanelSkeleton() {
  return (
    <aside className="border border-border bg-background">
      <div className="border-b border-border px-4 py-4">
        <Skeleton className="h-5 w-28" />
      </div>
      <div className="space-y-4 p-4">
        <Skeleton className="h-4 w-20" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </aside>
  )
}
