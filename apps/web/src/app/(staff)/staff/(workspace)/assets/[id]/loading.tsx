export default function AdminAssetDetailLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="h-7 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <div className="h-80 animate-pulse rounded-xl border border-border bg-muted" />
          <div className="h-64 animate-pulse rounded-xl border border-border bg-muted" />
        </div>
        <div className="space-y-5">
          <div className="h-56 animate-pulse rounded-xl border border-border bg-muted" />
          <div className="h-36 animate-pulse rounded-xl border border-border bg-muted" />
        </div>
      </div>
    </div>
  )
}
