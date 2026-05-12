import Link from "next/link"
import { Download, Eye, Lock } from "lucide-react"
import { PreviewImage } from "@/components/assets/preview-image"
import type { DownloadHistoryItem } from "@/lib/api/account-api"

export function DownloadHistoryList({
  items,
  isSubscriber,
}: {
  items: DownloadHistoryItem[]
  isSubscriber: boolean
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="hidden grid-cols-[96px_minmax(0,1fr)_120px_160px_190px] gap-4 border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid">
        <span>Preview</span>
        <span>Asset</span>
        <span>Size</span>
        <span>Date</span>
        <span>Actions</span>
      </div>
      <div className="divide-y divide-border">
        {items.map((item) => {
          const title = item.headline || item.title || item.caption || "Fotocorp archive image"
          const preview = item.thumbUrl ?? item.previewUrl
          const canDownload = isSubscriber && item.assetId && item.downloadSize === "LARGE"
          return (
            <article key={item.downloadId} className="grid gap-4 p-4 lg:grid-cols-[96px_minmax(0,1fr)_120px_160px_190px] lg:items-center">
              <Link href={item.assetId ? `/assets/${item.assetId}` : "/search"} className="block aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                {preview ? (
                  <PreviewImage src={preview.url} alt={title} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No preview</div>
                )}
              </Link>
              <div className="min-w-0">
                <h2 className="line-clamp-2 text-sm font-semibold text-foreground">{title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{item.fotokey || item.assetId || "Archived asset"}</p>
              </div>
              <div className="text-sm font-medium text-foreground">{item.downloadSize}</div>
              <div className="text-sm text-muted-foreground">{formatDateTime(item.downloadedAt)}</div>
              <div className="flex flex-wrap gap-2">
                {item.assetId && (
                  <Link
                    href={`/assets/${item.assetId}`}
                    className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </Link>
                )}
                {canDownload ? (
                  <a
                    href={`/api/assets/${item.assetId}/download?size=large`}
                    className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download again
                  </a>
                ) : (
                  <Link
                    href="/account/subscription"
                    className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-muted"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Locked
                  </Link>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function formatDateTime(value: string | null) {
  if (!value) return "Unknown date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown date"
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}
