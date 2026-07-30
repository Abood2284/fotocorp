"use client"

import { useEffect, useState } from "react"

import { PreviewImage } from "@/components/assets/preview-image"
import { buildCaricatureClearPreviewUrl } from "@/lib/caricatures/caricature-clear-access-shared"
import { useCaricatureClearAccess } from "@/lib/caricatures/use-caricature-clear-access"
import { cn } from "@/lib/utils"

interface ProgressiveCaricaturePreviewImageProps {
  assetId: string
  blurredUrl: string | null
  alt: string
  width?: number
  height?: number
  className?: string
  imageClassName?: string
  loading?: "lazy" | "eager"
}

/**
 * Shows the public blurred preview immediately, then overlays the clear
 * original only after it has loaded — avoids blur → blank → clear flashes.
 */
export function ProgressiveCaricaturePreviewImage({
  assetId,
  blurredUrl,
  alt,
  width,
  height,
  className,
  imageClassName,
  loading = "lazy",
}: ProgressiveCaricaturePreviewImageProps) {
  const { hasClearAccess } = useCaricatureClearAccess()
  const clearUrl = hasClearAccess ? buildCaricatureClearPreviewUrl(assetId) : null
  const [clearReady, setClearReady] = useState(false)

  useEffect(() => {
    if (!clearUrl) {
      setClearReady(false)
      return
    }

    let cancelled = false
    setClearReady(false)
    const image = new Image()
    image.decoding = "async"
    image.onload = () => {
      if (!cancelled) setClearReady(true)
    }
    image.onerror = () => {
      if (!cancelled) setClearReady(false)
    }
    image.src = clearUrl

    return () => {
      cancelled = true
      image.onload = null
      image.onerror = null
      image.src = ""
    }
  }, [clearUrl])

  if (!blurredUrl && !(clearUrl && clearReady)) {
    return (
      <div className={cn("flex items-center justify-center text-sm text-muted-foreground", className)}>
        Preview is being prepared.
      </div>
    )
  }

  const showClear = Boolean(clearUrl && clearReady)

  return (
    <div className={cn("relative", className)}>
      {blurredUrl ? (
        <PreviewImage
          src={blurredUrl}
          alt={alt}
          width={width}
          height={height}
          className={cn(
            "transition-opacity duration-300",
            imageClassName,
            showClear ? "opacity-0" : "opacity-100",
          )}
          loading={loading}
        />
      ) : null}
      {showClear && clearUrl ? (
        <PreviewImage
          src={clearUrl}
          alt={alt}
          className={cn("absolute inset-0", imageClassName)}
          loading="eager"
        />
      ) : null}
    </div>
  )
}
