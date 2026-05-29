"use client"

import { CircleHelp, Plus, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { PreviewImage } from "@/components/assets/preview-image"
import { FotoboxSaveButton } from "@/components/assets/fotobox-save-button"
import { cn } from "@/lib/utils"

interface AssetPreviewChromeProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  loading?: "lazy" | "eager"
  whoIsInPicture: string | null
  fotokey: string | null
  assetId: string
  // Pagination details
  currentPhotoNumber?: number
  totalPhotos?: number
  prevAssetId?: string | null
  nextAssetId?: string | null
}

export function AssetPreviewChrome({
  src,
  alt,
  width,
  height,
  className,
  loading = "lazy",
  whoIsInPicture,
  fotokey,
  assetId,
  currentPhotoNumber,
  totalPhotos,
  prevAssetId,
  nextAssetId,
}: AssetPreviewChromeProps) {
  const peopleLabel = whoIsInPicture?.trim()
  const showPagination = currentPhotoNumber !== undefined && totalPhotos !== undefined && totalPhotos > 1

  return (
    <div className="flex h-full w-full max-w-full flex-col gap-4 bg-background">
      <div
        className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border pb-3 px-1 sm:px-0"
        aria-label="Image actions"
      >
        {peopleLabel ? (
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <span
              className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-none bg-foreground/5 border border-border text-foreground/70"
              aria-hidden
            >
              <CircleHelp size={15} />
            </span>
            <div className="min-w-0">
              <p className="font-sans text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Who is in picture
              </p>
              <p className="mt-0.5 font-sans text-sm font-medium leading-snug text-foreground">{peopleLabel}</p>
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3 font-sans">
          <span className="rounded-none border border-border bg-muted/30 px-2.5 py-1.5 font-mono text-xs font-medium text-foreground/80">
            {fotokey ?? "Unavailable"}
          </span>
          <span className="hidden h-6 w-px bg-border/80 sm:block" aria-hidden />
          <FotoboxSaveButton
            assetId={assetId}
            stub
            variant="ghost"
            className="m-0 shrink-0"
            buttonClassName="h-9 gap-1.5 rounded-none border border-black bg-black px-4 text-xs font-bold uppercase tracking-wider text-white shadow-none hover:bg-neutral-800 cursor-pointer"
            icon={<Plus strokeWidth={2.5} size={14} />}
            text="Save"
            hoverLabel="Save as"
          />
        </div>
      </div>

      <div
        className="relative flex min-h-[50vh] w-full max-h-[68vh] flex-1 items-center justify-center bg-background sm:min-h-[55vh] lg:min-h-0 lg:max-h-none"
      >
        <PreviewImage
          src={src}
          alt={alt}
          width={width}
          height={height}
          className={cn(
            "h-full w-full max-h-full max-w-full object-contain",
            className,
          )}
          loading={loading}
        />

        {/* Count Badge Overlay */}
        {showPagination && (
          <div className="absolute top-4 left-4 z-20 bg-black/75 px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-wider text-white">
            Photo {currentPhotoNumber} of {totalPhotos}
          </div>
        )}

        {/* Navigation Arrows Overlay */}
        {prevAssetId && (
          <Link
            href={`/assets/${prevAssetId}`}
            scroll={false}
            className="absolute left-4 top-1/2 z-20 -translate-y-1/2 bg-black/75 p-2.5 text-white hover:bg-black transition-colors rounded-none cursor-pointer"
            aria-label="Previous image"
          >
            <ChevronLeft size={20} />
          </Link>
        )}
        {nextAssetId && (
          <Link
            href={`/assets/${nextAssetId}`}
            scroll={false}
            className="absolute right-4 top-1/2 z-20 -translate-y-1/2 bg-black/75 p-2.5 text-white hover:bg-black transition-colors rounded-none cursor-pointer"
            aria-label="Next image"
          >
            <ChevronRight size={20} />
          </Link>
        )}

        {/* View Gallery Link Overlay */}
        {showPagination && (
          <a
            href="#event-gallery-section"
            className="absolute bottom-4 right-4 z-20 bg-black/75 px-3 py-1.5 font-sans text-[10px] font-bold uppercase tracking-wider text-white hover:bg-black transition-colors rounded-none cursor-pointer"
          >
            View Gallery
          </a>
        )}
      </div>
      {peopleLabel ? (
        <span className="sr-only">Who is in this picture: {peopleLabel}</span>
      ) : null}
    </div>
  )
}
