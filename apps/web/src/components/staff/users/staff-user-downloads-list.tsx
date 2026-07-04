import Link from "next/link"
import { Eye } from "lucide-react"

import { PreviewImage } from "@/components/assets/preview-image"
import type { AdminUserDownloadItem } from "@/features/assets/admin-catalog-types"

interface StaffUserDownloadsListProps {
  items: AdminUserDownloadItem[]
}

export function StaffUserDownloadsList({ items }: StaffUserDownloadsListProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="hidden grid-cols-[96px_minmax(0,1fr)_100px_180px_120px] gap-4 border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid">
        <span>Preview</span>
        <span>Asset</span>
        <span>Size</span>
        <span>Downloaded</span>
        <span>Actions</span>
      </div>
      <div className="divide-y divide-border">
        {items.map((item) => {
          const title = item.headline || item.whoIsInPicture || item.caption || "Fotocorp archive image"
          const preview = item.thumbUrl ?? item.previewUrl
          return (
            <article
              key={item.downloadId}
              className="grid gap-4 p-4 lg:grid-cols-[96px_minmax(0,1fr)_100px_180px_120px] lg:items-center"
            >
              {item.assetId ? (
                <Link href={`/staff/catalog/${item.assetId}`} className="block aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                  {preview ? (
                    <PreviewImage src={preview.url} alt={title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No preview</div>
                  )}
                </Link>
              ) : (
                <div className="aspect-[4/3] rounded-lg bg-muted" />
              )}
              <div className="min-w-0">
                <h3 className="line-clamp-2 text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{item.fotokey || item.assetId || "Archived asset"}</p>
              </div>
              <div className="text-sm font-medium text-foreground">{item.downloadSize}</div>
              <div className="text-sm text-muted-foreground">{formatDateTime(item.downloadedAt)}</div>
              <div>
                {item.assetId ? (
                  <Link
                    href={`/staff/catalog/${item.assetId}`}
                    className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <Eye size={14} />
                    View asset
                  </Link>
                ) : null}
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
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}
