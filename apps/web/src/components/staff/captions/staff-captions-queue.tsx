"use client"

import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { AlertCircle, Calendar, Folder, Type } from "lucide-react"
import type { AdminCatalogAssetItem } from "@/features/assets/admin-catalog-types"
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
          const isMissingTitle = !asset.headline
          const isMissingCaption = !asset.caption
          const isMissingCategory = !asset.category
          const isMissingEvent = !asset.event

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
                {asset.preview?.url ? (
                  <Image
                    src={asset.preview.url}
                    alt={asset.title || "Asset thumbnail"}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    No img
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0 py-0.5">
                <div className="text-xs font-mono text-muted-foreground truncate">
                  {asset.legacyImageCode || asset.id.split("-")[0]}
                </div>
                <div className="text-sm font-medium truncate mt-0.5">
                  {asset.headline || <span className="text-muted-foreground italic">Untitled</span>}
                </div>
                
                <div className="flex items-center gap-1.5 mt-1">
                  {(isMissingTitle || isMissingCaption) && (
                    <div title="Missing Title or Caption" className="text-destructive">
                      <Type className="h-3.5 w-3.5" />
                    </div>
                  )}
                  {isMissingEvent && (
                    <div title="No Event" className="text-amber-500">
                      <Calendar className="h-3.5 w-3.5" />
                    </div>
                  )}
                  {isMissingCategory && (
                    <div title="No Category" className="text-amber-500">
                      <Folder className="h-3.5 w-3.5" />
                    </div>
                  )}
                  {(!isMissingTitle && !isMissingCaption && !isMissingEvent && !isMissingCategory) && (
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
