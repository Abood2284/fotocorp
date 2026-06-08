"use client"

import { AlignLeft, Calendar, Folder, Users } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import type { AdminCatalogAssetItem } from "@/features/assets/admin-catalog-types"
import { PreviewImage } from "@/components/assets/preview-image"
import {
  adminAssetDisplayCode,
  adminAssetDisplayTitle,
  bestAdminAssetPreviewVariant,
  hasAdminAssetEvent,
  isAdminAssetCaptionWorkComplete,
  staffCatalogPreviewImageUrl,
} from "@/lib/staff/admin-asset-preview"
import { Button } from "@/components/ui/button"

interface Props {
  assets: AdminCatalogAssetItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  nextCursor: string | null
}

export function StaffCaptionsQueue({ assets, selectedId, onSelect, nextCursor }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleNextPage() {
    if (!nextCursor) return
    const sp = new URLSearchParams(searchParams)
    sp.set("cursor", nextCursor)
    router.push(`/staff/captions?${sp.toString()}`)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {assets.map((asset) => {
          const isSelected = asset.id === selectedId
          const isMissingWhoIsInPicture = !asset.whoIsInPicture?.trim()
          const isMissingCaption = !asset.caption?.trim()
          const isMissingCategory = !asset.category
          const isMissingEvent = !hasAdminAssetEvent(asset)
          const isComplete = isAdminAssetCaptionWorkComplete(asset)
          const previewVariant = bestAdminAssetPreviewVariant(asset)

          return (
            <button
              key={asset.id}
              onClick={() => onSelect(asset.id)}
              className={`w-full text-left flex items-start gap-3 p-2 rounded-md transition-colors ${
                isSelected 
                  ? "bg-primary/10 border-primary shadow-sm" 
                  : "bg-background border-transparent hover:bg-muted"
              } border`}
            >
              <div className="relative h-16 w-16 overflow-hidden rounded bg-muted flex-shrink-0">
                {previewVariant ? (
                  <PreviewImage
                    src={staffCatalogPreviewImageUrl(asset.id, previewVariant)}
                    alt={adminAssetDisplayTitle(asset) || "Asset thumbnail"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    No img
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0 py-0.5">
                <div className="text-xs font-mono text-muted-foreground truncate">
                  {adminAssetDisplayCode(asset)}
                </div>
                <div className="text-sm font-medium truncate mt-0.5">
                  {adminAssetDisplayTitle(asset) ?? <span className="text-muted-foreground italic">Untitled</span>}
                </div>
                
                <div className="flex items-center gap-1.5 mt-1">
                  {isMissingWhoIsInPicture && (
                    <div title="Missing who is in picture" className="text-destructive">
                      <Users size={14} />
                    </div>
                  )}
                  {isMissingCaption && (
                    <div title="Missing caption" className="text-destructive">
                      <AlignLeft size={14} />
                    </div>
                  )}
                  {isMissingEvent && (
                    <div title="No event (title)" className="text-amber-500">
                      <Calendar size={14} />
                    </div>
                  )}
                  {isMissingCategory && (
                    <div title="No category" className="text-amber-500">
                      <Folder size={14} />
                    </div>
                  )}
                  {isComplete && (
                    <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                      Complete
                    </div>
                  )}
                </div>
              </div>
            </button>
          )
        })}

        {assets.length === 0 && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Queue is empty.
          </div>
        )}
      </div>

      {nextCursor && (
        <div className="p-3 border-t bg-background">
          <Button onClick={handleNextPage} variant="secondary" className="w-full text-xs" size="sm">
            Load Next Page
          </Button>
        </div>
      )}
    </div>
  )
}
