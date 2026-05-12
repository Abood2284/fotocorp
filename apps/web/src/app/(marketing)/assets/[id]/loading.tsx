export default function AssetDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 h-5 w-40 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
          <div className="aspect-[16/10] animate-pulse rounded-xl border border-border bg-muted" />
        </div>
        <div className="space-y-4">
          <div className="h-44 animate-pulse rounded-xl border border-border bg-muted" />
          <div className="h-64 animate-pulse rounded-xl border border-border bg-muted" />
        </div>
      </div>
    </div>
  )
}
