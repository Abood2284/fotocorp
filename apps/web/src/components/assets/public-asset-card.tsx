import Link from "next/link"
import { Lock } from "lucide-react"
import type { PublicAsset } from "@/features/assets/types"
import { PreviewImage } from "@/components/assets/preview-image"
import { PublicAssetSaveButton } from "@/components/assets/public-asset-save-button"
import { cn } from "@/lib/utils"

interface PublicAssetCardProps {
  asset: PublicAsset
  variant?: "mosaic" | "compact" | "list" | "grid" | "card"
  className?: string
  priority?: boolean
}

export function PublicAssetCard({
  asset,
  variant = "compact",
  className,
  priority = false,
}: PublicAssetCardProps) {
  const preview = asset.previews.card ?? asset.previews.thumb
  const title = getAssetAlt(asset)
  const href = `/assets/${asset.id}`
  const gridFrameStyle = variant === "grid"
    ? { aspectRatio: getPreviewAspectRatio(preview) }
    : undefined

  return (
    <article
      className={cn(
        "group relative overflow-hidden bg-muted text-white transition-all duration-300",
        variant === "grid" && "public-grid-card",
        variant !== "card" && variant !== "grid" && "hover:-translate-y-[2px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]",
        variant === "mosaic" ? "rounded-xl" : variant === "grid" ? "rounded-none" : "rounded-lg",
        variant === "list" && "grid grid-cols-1 border border-border bg-card text-foreground sm:grid-cols-[280px_minmax(0,1fr)]",
        variant === "card" && "rounded-none border-b border-r border-border bg-card text-foreground shadow-none",
        className,
      )}
    >
      <div
        style={gridFrameStyle}
        className={cn(
          "relative overflow-hidden bg-muted",
          variant === "list" ? "aspect-[4/3] sm:h-full sm:aspect-auto" : "h-full min-h-[220px]",
          variant === "grid" && "h-auto min-h-0 bg-background",
          variant === "card" && "m-4 mb-0 aspect-[4/3] h-auto min-h-0 bg-background",
          variant === "mosaic" && "h-auto min-h-0 aspect-[3/2]"
        )}
      >
        {preview ? (
          <PreviewImage
            src={preview.url}
            alt={title}
            className={cn(
              "block w-full transition-transform duration-700 ease-out group-hover:scale-[1.025] group-focus-within:scale-[1.025]",
              variant === "grid" ? "h-full object-contain" : "h-full object-cover",
            )}
            loading={priority ? "eager" : "lazy"}
          />
        ) : (
          <div className="flex h-full min-h-[220px] items-center justify-center px-5 text-center text-sm text-muted-foreground">
            Preview is being prepared.
          </div>
        )}

        <Link
          href={href}
          aria-label={`View ${title}`}
          className="absolute inset-0 z-10 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        />

        {variant !== "grid" && variant !== "card" && (
          <>


            <div className="absolute right-3 top-3 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-black/35 text-white opacity-80 backdrop-blur-sm md:opacity-0 md:transition-opacity md:duration-300 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
              <Lock className="h-3.5 w-3.5" />
            </div>
            
            <div className="absolute inset-x-0 bottom-0 z-20 flex h-[38px] flex-col justify-center bg-gradient-to-t from-black/90 to-transparent px-3 opacity-0 transition-opacity duration-300 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13px] font-medium text-white leading-tight">
                  {asset.event?.name || asset.category?.name || "Editorial Image"}
                </p>
                <p className="shrink-0 text-[11px] text-white/80 leading-tight">
                  {formatDate(asset.imageDate || asset.event?.eventDate)}
                </p>
              </div>
            </div>
          </>
        )}

        {variant === "grid" && (
          <>
            <div className="public-grid-card-overlay pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-black/75 via-black/15 to-black/70 opacity-0 transition-opacity duration-200">
            </div>

            <div className="public-grid-card-overlay pointer-events-none absolute left-3 top-3 z-30 flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-1 opacity-0 transition-opacity duration-200">
              <p className="line-clamp-2 max-w-[92%] text-xl font-bold leading-tight tracking-normal text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
                {title}
              </p>
              <p className="line-clamp-2 max-w-[92%] text-sm font-semibold leading-snug text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
                {asset.caption || asset.event?.name || asset.category?.name || "Editorial image"}
              </p>
            </div>

            <div className="public-grid-card-overlay absolute bottom-3 left-3 z-30 flex opacity-0 transition-opacity duration-200">
              <PublicAssetSaveButton assetId={asset.id} />
            </div>
          </>
        )}
      </div>

      {variant === "list" && (
        <div className="flex min-w-0 flex-col justify-center gap-2 p-4">
          <Link
            href={href}
            className="line-clamp-2 text-sm font-medium leading-5 text-foreground hover:underline"
          >
            {title}
          </Link>
          {asset.caption && (
            <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
              {asset.caption}
            </p>
          )}
        </div>
      )}

      {variant === "card" && (
        <div className="flex min-h-[290px] flex-col justify-start gap-3 border-t border-border p-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="flex h-9 w-9 items-center justify-center border-2 border-border-strong bg-muted-foreground text-xs font-semibold tracking-wide text-white">
              ED
            </span>
            <span className="text-sm font-medium">Editorial</span>
          </div>
          <Link
            href={href}
            className="line-clamp-3 text-xl font-medium leading-tight tracking-normal text-foreground hover:underline"
          >
            {title}
          </Link>
          <div className="space-y-1 text-sm leading-5 text-muted-foreground">
            {(asset.caption || asset.event?.name) && (
              <p className="line-clamp-2">
                {asset.event?.name ? `People: ${asset.event.name}` : asset.caption}
              </p>
            )}
            {asset.contributor?.displayName && (
              <p>
                By: <span className="font-medium text-primary">{asset.contributor.displayName}</span>
              </p>
            )}
            <p>{formatDate(asset.imageDate || asset.event?.eventDate) ?? "Date unavailable"}</p>
            <p>{asset.category?.name ?? "Fotocorp Editorial"}</p>
            {asset.fotokey && <p>{asset.fotokey}</p>}
          </div>
        </div>
      )}


    </article>
  )
}

function getAssetAlt(asset: PublicAsset) {
  return asset.headline || asset.caption || asset.title || "Fotocorp archive image"
}

function getPreviewAspectRatio(preview: PublicAsset["previews"]["card"] | PublicAsset["previews"]["thumb"] | null) {
  if (preview && preview.width > 0 && preview.height > 0) {
    return `${preview.width} / ${preview.height}`
  }

  return "4 / 3"
}

export function formatDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(date)
}
