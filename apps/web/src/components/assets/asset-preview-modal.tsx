"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ExternalLink, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AssetPreviewFrame } from "@/components/assets/asset-preview-frame"
import type { AssetListItem } from "@/types"

interface AssetPreviewModalProps {
  asset: AssetListItem | null
  open: boolean
  onClose: () => void
}

export function AssetPreviewModal({ asset, open, onClose }: AssetPreviewModalProps) {
  useEffect(() => {
    if (!open) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onEscape)
    return () => window.removeEventListener("keydown", onEscape)
  }, [open, onClose])

  if (!open || !asset) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 sm:p-8 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Asset preview"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[90vw] lg:max-w-6xl overflow-hidden rounded-xl bg-zinc-950 shadow-2xl ring-1 ring-white/10 animate-in zoom-in-[0.98] duration-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          <Link href={`/assets/${asset.id}`} onClick={onClose} className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-black/40 px-4 text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-black/60">
             View details
             <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/60"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative flex max-h-[85vh] min-h-[50vh] w-full items-center justify-center bg-black">
          <AssetPreviewFrame asset={asset} />
        </div>

        <div className="flex items-center justify-between border-t border-white/10 bg-zinc-900/80 p-4 backdrop-blur-md">
          <div>
            <h3 className="text-sm font-medium text-white">{asset.title ?? asset.filename}</h3>
            <p className="mt-0.5 text-xs text-zinc-400">{asset.filename}</p>
          </div>
          <Badge variant="outline" className="border-white/20 bg-transparent text-zinc-300">Protected preview</Badge>
        </div>
      </div>
    </div>
  )
}
