"use client"

import { useCallback, useEffect, useState, type MouseEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"

import { PreviewImage } from "@/components/assets/preview-image"
import { cn } from "@/lib/utils"

interface CursorImagePreviewProps {
  src: string
  alt: string
  children: ReactNode
  className?: string
  previewClassName?: string
  maxWidth?: number
  maxHeight?: number
  offset?: number
}

export function CursorImagePreview({
  src,
  alt,
  children,
  className,
  previewClassName,
  maxWidth = 480,
  maxHeight = 360,
  offset = 20,
}: CursorImagePreviewProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePosition = useCallback((clientX: number, clientY: number) => {
    const padding = 12
    let x = clientX + offset
    let y = clientY + offset

    if (x + maxWidth > window.innerWidth - padding) {
      x = clientX - maxWidth - offset
    }
    if (y + maxHeight > window.innerHeight - padding) {
      y = clientY - maxHeight - offset
    }

    x = Math.max(padding, Math.min(x, window.innerWidth - maxWidth - padding))
    y = Math.max(padding, Math.min(y, window.innerHeight - maxHeight - padding))

    setPosition({ x, y })
  }, [maxHeight, maxWidth, offset])

  function handleMouseEnter(event: MouseEvent<HTMLDivElement>) {
    setVisible(true)
    updatePosition(event.clientX, event.clientY)
  }

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    updatePosition(event.clientX, event.clientY)
  }

  function handleMouseLeave() {
    setVisible(false)
  }

  return (
    <>
      <div
        className={className}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
      {mounted && visible
        ? createPortal(
            <div
              className="pointer-events-none fixed z-120 overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
              style={{ left: position.x, top: position.y, width: maxWidth, maxHeight }}
              aria-hidden
            >
              <PreviewImage
                src={src}
                alt={alt}
                className={cn("block h-full w-full object-contain", previewClassName)}
                loading="eager"
              />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
