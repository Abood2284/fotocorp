"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Download, Eye, Loader2, Trash2 } from "lucide-react"
import { PreviewImage } from "@/components/assets/preview-image"
import type { FotoboxItem } from "@/lib/api/account-api"
import { formatDate } from "@/components/assets/public-asset-card"

export function FotoboxGrid({
  items,
  isSubscriber,
}: {
  items: FotoboxItem[]
  isSubscriber: boolean
}) {
  const router = useRouter()
  const [removing, setRemoving] = useState<string | null>(null)

  async function remove(assetId: string) {
    setRemoving(assetId)
    const response = await fetch(`/api/fotobox/${encodeURIComponent(assetId)}`, { method: "DELETE" }).catch(() => null)
    setRemoving(null)
    if (response?.ok) router.refresh()
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => {
        const title = item.headline || item.title || item.caption || "Fotocorp archive image"
        const preview = item.previewUrl ?? item.thumbUrl
        return (
          <article key={item.assetId} className="overflow-hidden rounded-xl border border-border bg-background">
            <Link href={`/assets/${item.assetId}`} className="group block aspect-[4/3] overflow-hidden bg-muted">
              {preview ? (
                <PreviewImage
                  src={preview.url}
                  alt={title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Preview unavailable</div>
              )}
            </Link>
            <div className="space-y-3 p-3">
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{item.savedAt ? `Saved ${formatDate(item.savedAt)}` : "Saved"}</span>
                {item.fotokey && <span className="truncate">{item.fotokey}</span>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Link
                  href={`/assets/${item.assetId}`}
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-foreground hover:bg-muted"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </Link>
                {isSubscriber ? (
                  <a
                    href={`/api/assets/${item.assetId}/download?size=large`}
                    className="inline-flex h-9 items-center justify-center gap-1 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Large
                  </a>
                ) : (
                  <Link
                    href="/account/subscription"
                    className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground hover:bg-muted"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Locked
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => remove(item.assetId)}
                  disabled={removing === item.assetId}
                  aria-label="Remove image from Fotobox"
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
                >
                  {removing === item.assetId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Remove
                </button>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
