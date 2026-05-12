export default function AdminIngestionLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-7 w-56 animate-pulse rounded bg-muted" />
        <div className="h-4 w-96 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-28 animate-pulse rounded-xl border border-border bg-muted" />
        <div className="h-28 animate-pulse rounded-xl border border-border bg-muted" />
        <div className="h-28 animate-pulse rounded-xl border border-border bg-muted" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <div className="h-96 animate-pulse rounded-xl border border-border bg-muted" />
        <div className="h-96 animate-pulse rounded-xl border border-border bg-muted" />
      </div>
    </div>
  )
}
