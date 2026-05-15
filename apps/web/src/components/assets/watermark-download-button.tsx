"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"

interface WatermarkDownloadButtonProps {
  previewUrl: string
  assetId: string
  fotokey: string | null
}

export function WatermarkDownloadButton({ previewUrl, assetId, fotokey }: WatermarkDownloadButtonProps) {
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
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className="rounded-md bg-black/40 p-2 text-white/90 backdrop-blur-md transition-colors hover:bg-black/60 disabled:opacity-50"
      title="Download watermark preview"
      aria-label="Download watermark preview"
    >
      {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
    </button>
  )
}
