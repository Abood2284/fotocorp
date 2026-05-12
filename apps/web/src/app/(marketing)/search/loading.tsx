import { AssetGridSkeleton } from "@/components/ui/skeleton"

export default function SearchLoading() {
  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 h-36 animate-pulse rounded-2xl border border-border/70 bg-muted" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden h-[520px] animate-pulse rounded-xl border border-border bg-muted md:block" />
        <div className="space-y-4">
          <div className="h-9 w-full animate-pulse rounded-md bg-muted md:w-80" />
          <AssetGridSkeleton count={9} />
        </div>
      </div>
    </div>
  )
}
