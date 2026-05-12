import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AssetListItem } from "@/types"

interface AssetPreviewFrameProps {
  asset: AssetListItem
  className?: string
  showNotice?: boolean
}

export function AssetPreviewFrame({
  asset,
  className,
  showNotice = true,
}: AssetPreviewFrameProps) {
  return (
    <figure className={cn("rounded-xl border border-border bg-card p-2", className)}>
      <div className="relative overflow-hidden rounded-lg bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.previewUrl}
          alt={asset.title ?? asset.filename}
          className="aspect-[16/10] w-full object-cover"
          loading="eager"
          decoding="async"
        />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-black/5" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="select-none text-center text-xs font-semibold uppercase tracking-[0.35em] text-white/18 rotate-[-24deg]">
            Protected Preview
            <br />
            Protected Preview
            <br />
            Protected Preview
          </div>
        </div>
        <div className="absolute left-3 top-3">
          <Badge variant="warning">Preview only</Badge>
        </div>
      </div>
      {showNotice && (
        <figcaption className="mt-3 text-xs text-muted-foreground">
          This is a protected preview. Original high-resolution media is gated by
          subscription/license.
        </figcaption>
      )}
    </figure>
  )
}
