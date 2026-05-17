"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"

interface WatermarkDownloadButtonProps {
  previewUrl: string
  assetId: string
  fotokey: string | null
  hoverLabel?: string
}

export function WatermarkDownloadButton({
  previewUrl,
  assetId,
  fotokey,
  hoverLabel = "Download this image",
}: WatermarkDownloadButtonProps) {
  const [downloading, setDownloading] = useState(false)

  async function handleDownload(e: React.MouseEvent) {
    e.preventDefault()
    if (downloading) return
    
    setDownloading(true)
    try {
      const response = await fetch(previewUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      
      const fileNameBase = fotokey || assetId
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${fileNameBase}-watermarked.jpg`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      console.error("Failed to download watermark preview", error)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="rounded-md bg-black/40 p-2 text-white/90 backdrop-blur-md transition-colors hover:bg-black/60 disabled:opacity-50"
        aria-label={hoverLabel}
      >
        {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
      </button>
      <span className="pointer-events-none absolute right-0 top-full z-30 mt-2 whitespace-nowrap rounded-md bg-black/40 px-3 py-2 text-xs font-medium text-white/90 opacity-0 backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
        {hoverLabel}
      </span>
    </div>
  )
}
