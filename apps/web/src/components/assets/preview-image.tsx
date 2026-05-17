"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface PreviewImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  loading?: "lazy" | "eager"
}

export function PreviewImage({
  src,
  alt,
  width,
  height,
  className,
  loading = "lazy",
}: PreviewImageProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className={cn("flex h-full min-h-[220px] w-full items-center justify-center bg-muted px-5 text-center text-sm text-muted-foreground", className)}>
        Preview unavailable
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}
