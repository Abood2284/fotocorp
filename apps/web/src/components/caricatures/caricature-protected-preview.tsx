"use client"

import { ProgressiveCaricaturePreviewImage } from "@/components/caricatures/progressive-caricature-preview-image"
import type { PublicPreview } from "@/features/assets/types"
import { cn } from "@/lib/utils"

interface CaricatureProtectedPreviewProps {
  assetId: string
  preview: PublicPreview | null
  alt: string
  className?: string
}

export function CaricatureProtectedPreview({
  assetId,
  preview,
  alt,
  className,
}: CaricatureProtectedPreviewProps) {
  return (
    <figure className={cn("min-w-0", className)}>
      <div
        className={cn(
          "relative flex w-full items-center justify-center bg-background",
          !preview?.url && "min-h-[280px]",
        )}
      >
        <ProgressiveCaricaturePreviewImage
          assetId={assetId}
          blurredUrl={preview?.url ?? null}
          alt={alt}
          width={preview?.width}
          height={preview?.height}
          className="mx-auto w-full max-w-full"
          imageClassName="mx-auto block h-auto w-full max-h-[min(70vh,900px)] max-w-full object-contain"
          loading="eager"
        />
      </div>
    </figure>
  )
}
