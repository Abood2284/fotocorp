"use client"

import { HelpCircle, Plus } from "lucide-react"
import { PreviewImage } from "@/components/assets/preview-image"
import { FotoboxSaveButton } from "@/components/assets/fotobox-save-button"

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
}: AssetPreviewChromeProps) {
  const peopleLabel = whoIsInPicture?.trim()

  return (
    <div className="flex h-full w-full max-w-full flex-col gap-3 lg:gap-4">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="overflow-hidden rounded-xl shadow-sm">
          <PreviewImage
            src={src}
            alt={alt}
            width={width}
            height={height}
            className={className}
            loading={loading}
          />
        </div>
      </div>
      <div
        className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 sm:px-0"
        aria-label="Image actions"
      >
        {peopleLabel ? (
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <span
              className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground/8 text-foreground/70"
              aria-hidden
            >
              <HelpCircle className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Who is in picture
              </p>
              <p className="mt-0.5 text-sm font-medium leading-snug text-foreground">{peopleLabel}</p>
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          <span className="rounded-md bg-foreground/6 px-2.5 py-1.5 font-mono text-xs font-medium text-foreground/85">
            {fotokey ?? "Unavailable"}
          </span>
          <span className="hidden h-6 w-px bg-border/80 sm:block" aria-hidden />
          <FotoboxSaveButton
            assetId={assetId}
            stub
            variant="ghost"
            className="m-0 shrink-0"
            buttonClassName="h-9 gap-1.5 rounded-md border-0 bg-neutral-800 px-4 text-sm font-medium text-white shadow-sm hover:bg-neutral-900 hover:text-white"
            icon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
            text="Save"
            hoverLabel="Save as"
          />
        </div>
      </div>
      {peopleLabel ? (
        <span className="sr-only">Who is in this picture: {peopleLabel}</span>
      ) : null}
    </div>
  )
}
