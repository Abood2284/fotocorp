"use client"

import { useState, useEffect } from "react"
import type { AdminCatalogAssetsResponse, AdminCatalogFilters, AdminCatalogAssetItem } from "@/features/assets/admin-catalog-types"
import { StaffCaptionsFilterBar } from "@/components/staff/captions/staff-captions-filter-bar"
import { StaffCaptionsQueue } from "@/components/staff/captions/staff-captions-queue"
import { StaffCaptionsEditor } from "@/components/staff/captions/staff-captions-editor"

interface Props {
  initialAssets: AdminCatalogAssetsResponse
  filters: AdminCatalogFilters
}

export function StaffCaptionsClient({ initialAssets, filters }: Props) {
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)

  // Auto-select first asset if none selected
  useEffect(() => {
    if (!selectedAssetId && initialAssets.items.length > 0) {
      setSelectedAssetId(initialAssets.items[0].id)
    } else if (initialAssets.items.length === 0) {
      setSelectedAssetId(null)
    }
  }, [initialAssets.items, selectedAssetId])

  const selectedAsset = initialAssets.items.find(a => a.id === selectedAssetId) || null

  function handleSelectNext() {
    if (!selectedAssetId) return
    const currentIndex = initialAssets.items.findIndex(a => a.id === selectedAssetId)
    if (currentIndex >= 0 && currentIndex < initialAssets.items.length - 1) {
      setSelectedAssetId(initialAssets.items[currentIndex + 1].id)
    }
  }

  function handleSelectPrevious() {
    if (!selectedAssetId) return
    const currentIndex = initialAssets.items.findIndex(a => a.id === selectedAssetId)
    if (currentIndex > 0) {
      setSelectedAssetId(initialAssets.items[currentIndex - 1].id)
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col -mt-4 -mx-4 sm:-mt-8 sm:-mx-8">
      <div className="border-b bg-background px-4 py-3 sm:px-6 flex items-center justify-between shadow-sm z-10">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Caption Queue</h1>
          <p className="text-xs text-muted-foreground">Review and edit metadata</p>
        </div>
        <StaffCaptionsFilterBar filters={filters} />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/3 flex-shrink-0 border-r bg-muted/30 flex flex-col overflow-hidden">
          <StaffCaptionsQueue 
            assets={initialAssets.items} 
            selectedId={selectedAssetId} 
            onSelect={setSelectedAssetId} 
            nextCursor={initialAssets.nextCursor}
          />
        </div>
        
        <div className="w-2/3 flex-shrink-0 bg-background overflow-y-auto">
          {selectedAsset ? (
            <StaffCaptionsEditor 
              asset={selectedAsset} 
              filters={filters}
              onSaveAndNext={handleSelectNext}
              onSkip={handleSelectNext}
              onPrevious={handleSelectPrevious}
              isFirst={initialAssets.items.findIndex(a => a.id === selectedAssetId) === 0}
              isLast={initialAssets.items.findIndex(a => a.id === selectedAssetId) === initialAssets.items.length - 1}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {initialAssets.items.length === 0 ? "No assets in the queue matching your filters." : "Select an asset to edit."}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
