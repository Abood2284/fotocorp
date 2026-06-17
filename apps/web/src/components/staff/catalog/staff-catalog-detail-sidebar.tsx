"use client"

import { ExternalLink, X, Loader2, ZoomIn } from "lucide-react"
import { useEffect, useState, useTransition } from "react"

import { fetchAdminAssetAction, updateAdminAssetEditorialAction, updateAdminAssetStateAction } from "@/app/(staff)/staff/(workspace)/catalog/actions"
import type { AdminCatalogAssetItem, AdminCatalogFilters } from "@/features/assets/admin-catalog-types"
import { PreviewImage } from "@/components/assets/preview-image"
import { formatCatalogFotokeyDisplay, getCatalogImportMatchName } from "@/lib/catalog-asset-identity"

interface StaffCatalogDetailSidebarProps {
  assetId: string
  onClose: () => void
  onUpdate: () => void
  filters: AdminCatalogFilters
}

export function StaffCatalogDetailSidebar({ assetId, onClose, onUpdate, filters }: StaffCatalogDetailSidebarProps) {
  const [asset, setAsset] = useState<AdminCatalogAssetItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isZoomed, setIsZoomed] = useState(false)
  const [isSaving, startTransition] = useTransition()

  const [whoIsInPicture, setWhoIsInPicture] = useState("")
  const [caption, setCaption] = useState("")
  const [eventId, setEventId] = useState("")
  const [keywords, setKeywords] = useState("")

  useEffect(() => {
    let mounted = true
    setIsLoading(true)
    fetchAdminAssetAction(assetId).then(res => {
      if (mounted && res?.asset) {
        setAsset(res.asset)
        setWhoIsInPicture(res.asset.whoIsInPicture || "")
        setCaption(res.asset.caption || "")
        setEventId(res.asset.event?.id || "")
        setKeywords(res.asset.keywords || "")
      }
      if (mounted) setIsLoading(false)
    }).catch(() => {
      if (mounted) setIsLoading(false)
    })
    return () => { mounted = false }
  }, [assetId])

  const handleSaveMetadata = () => {
    if (!asset) return
    startTransition(async () => {
      try {
        await updateAdminAssetEditorialAction(asset.id, {
          whoIsInPicture: whoIsInPicture.trim() || null,
          headline: asset.headline,
          caption: caption || null,
          categoryId: asset.category?.id || null,
          eventId: eventId || null,
          keywords: keywords ? keywords.split(",").map(k => k.trim()).filter(Boolean) : null,
          description: asset.description,
          contributorId: asset.contributor?.id || null,
        })
        onUpdate()
      } catch (e) {
        alert("Failed to save metadata")
      }
    })
  }

  const handlePublishState = (status: "APPROVED" | "REVIEW" | "REJECTED", visibility: "PUBLIC" | "PRIVATE") => {
    if (!asset) return
    startTransition(async () => {
      try {
        await updateAdminAssetStateAction(asset.id, { status, visibility })
        setAsset(prev => prev ? { ...prev, status, visibility } : null)
        onUpdate()
      } catch (e) {
        alert("Failed to update state. Ensure preview is ready if publishing.")
      }
    })
  }

  const previewAlt = asset?.whoIsInPicture || asset?.caption || "Preview"
  const eventOptions = (() => {
    if (!asset?.event?.id) return filters.events
    const hasCurrentEvent = filters.events.some((eventOption) => eventOption.id === asset.event?.id)
    if (hasCurrentEvent) return filters.events
    return [
      {
        id: asset.event.id,
        name: asset.event.name,
        eventDate: asset.event.eventDate,
        assetCount: 0,
      },
      ...filters.events,
    ]
  })()

  return (
    <>
      {isZoomed && asset?.previewReady && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm" onClick={() => setIsZoomed(false)}>
          <button className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors" onClick={() => setIsZoomed(false)}>
            <X size={32} />
          </button>
          <img 
            src={`/staff/catalog/${asset.id}/preview-image?variant=detail`} 
            alt="Zoomed" 
            className="max-h-full max-w-full object-contain rounded-md"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
      <div className="max-h-[calc(100vh-3rem)] w-full overflow-y-auto border-l border-border bg-card p-5 lg:max-h-[calc(100vh-4rem)]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold tracking-tight">Edit Asset</h3>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted text-muted-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : !asset ? (
          <div className="p-4 text-center text-muted-foreground">Asset not found.</div>
        ) : (
          <div className="space-y-6">
            {asset.previewReady ? (
              <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg border border-border bg-muted group">
                <PreviewImage
                  src={`/staff/catalog/${asset.id}/preview-image?variant=detail`}
                  alt={previewAlt}
                  className="h-full w-full object-contain"
                />
                <button 
                  onClick={() => setIsZoomed(true)}
                  className="absolute top-2 right-2 rounded-md bg-black/50 p-1.5 text-white opacity-0 transition-all hover:bg-black/70 group-hover:opacity-100 backdrop-blur-sm"
                  title="Zoom image"
                >
                  <ZoomIn size={18} />
                </button>
              </div>
            ) : (
              <div className="flex aspect-[3/2] w-full items-center justify-center rounded-lg border border-border bg-muted">
                <span className="text-sm font-medium text-muted-foreground">Preview missing or processing</span>
              </div>
            )}

            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fotokey</p>
              <p className="mt-0.5 font-mono text-sm font-medium text-foreground">{formatCatalogFotokeyDisplay(asset.fotokey)}</p>
              {getCatalogImportMatchName(asset) ? (
                <p className="mt-1 text-xs text-muted-foreground">Import match file: {getCatalogImportMatchName(asset)}</p>
              ) : null}
            </div>

            <div className="flex items-center justify-end">
              <a 
                href={`/assets/${asset.id}`} 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                Open Public Page <ExternalLink size={12} />
              </a>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Who is in picture?</label>
                <input 
                  type="text" 
                  value={whoIsInPicture} 
                  onChange={e => setWhoIsInPicture(e.target.value)} 
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Caption</label>
                <textarea 
                  value={caption} 
                  onChange={e => setCaption(e.target.value)} 
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Category</label>
                  <p className="w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-foreground">
                    {asset.category?.name || "—"}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Event</label>
                  <select 
                    value={eventId} 
                    onChange={e => setEventId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">None</option>
                    {eventOptions.map(e => <option key={e.id} value={e.id}>{e.name || "Untitled"}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Keywords (comma separated)</label>
                <input 
                  type="text" 
                  value={keywords} 
                  onChange={e => setKeywords(e.target.value)} 
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" 
                />
              </div>

              <div className="pt-2">
                <button 
                  onClick={handleSaveMetadata} 
                  disabled={isSaving}
                  className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Metadata"}
                </button>
              </div>

              <div className="border-t border-border pt-4 mt-6">
                <h4 className="text-sm font-medium mb-3">Publish State</h4>
                <div className="flex items-center gap-3">
                  {asset.status !== "ACTIVE" || asset.visibility !== "PUBLIC" ? (
                    <button 
                      onClick={() => handlePublishState("APPROVED", "PUBLIC")}
                      disabled={isSaving || !asset.previewReady}
                      className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      Approve & Publish
                    </button>
                  ) : null}
                  {asset.visibility !== "PRIVATE" ? (
                    <button 
                      onClick={() => handlePublishState("APPROVED", "PRIVATE")}
                      disabled={isSaving}
                      className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                    >
                      Make Private
                    </button>
                  ) : null}
                  <button 
                    onClick={() => handlePublishState("REJECTED", "PRIVATE")}
                    disabled={isSaving || asset.status === "REJECTED"}
                    className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  >
                    Reject / Archive
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
