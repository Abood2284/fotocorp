"use client"

import { useEffect, useState, useTransition } from "react"
import { ExternalLink, X, Loader2 } from "lucide-react"
import { fetchAdminAssetAction, updateAdminAssetEditorialAction, updateAdminAssetStateAction } from "@/app/(staff)/staff/(workspace)/catalog/actions"
import type { AdminCatalogAssetItem, AdminCatalogFilters } from "@/features/assets/admin-catalog-types"
import { PreviewImage } from "@/components/assets/preview-image"

interface StaffCatalogDetailDrawerProps {
  assetId: string
  onClose: () => void
  onUpdate: () => void
  filters: AdminCatalogFilters
}

export function StaffCatalogDetailDrawer({ assetId, onClose, onUpdate, filters }: StaffCatalogDetailDrawerProps) {
  const [asset, setAsset] = useState<AdminCatalogAssetItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, startTransition] = useTransition()

  const [title, setTitle] = useState("")
  const [caption, setCaption] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [eventId, setEventId] = useState("")
  const [keywords, setKeywords] = useState("")

  useEffect(() => {
    let mounted = true
    setIsLoading(true)
    fetchAdminAssetAction(assetId).then(res => {
      if (mounted && res?.asset) {
        setAsset(res.asset)
        setTitle(res.asset.headline || res.asset.title || "")
        setCaption(res.asset.caption || "")
        setCategoryId(res.asset.category?.id || "")
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
          headline: title || null,
          caption: caption || null,
          categoryId: categoryId || null,
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

  return (
    <>
      <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-border bg-card p-6 shadow-2xl overflow-y-auto sm:max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold tracking-tight">Edit Asset</h3>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-muted text-muted-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !asset ? (
          <div className="p-4 text-center text-muted-foreground">Asset not found.</div>
        ) : (
          <div className="space-y-6">
            {asset.previewReady ? (
              <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg border border-border bg-muted">
                <PreviewImage
                  src={`/staff/catalog/${asset.id}/preview-image?variant=detail`}
                  alt={asset.headline || "Preview"}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex aspect-[3/2] w-full items-center justify-center rounded-lg border border-border bg-muted">
                <span className="text-sm font-medium text-muted-foreground">Preview missing or processing</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-mono text-xs text-muted-foreground">ID: {asset.legacyImageCode || asset.id}</p>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${asset.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                    {asset.status}
                  </span>
                  <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${asset.visibility === 'PUBLIC' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                    {asset.visibility}
                  </span>
                </div>
              </div>
              <a 
                href={`/assets/${asset.id}`} 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                Open Public Page <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Headline / Title</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
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
                  <select 
                    value={categoryId} 
                    onChange={e => setCategoryId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">None</option>
                    {filters.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Event</label>
                  <select 
                    value={eventId} 
                    onChange={e => setEventId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">None</option>
                    {filters.events.map(e => <option key={e.id} value={e.id}>{e.name || "Untitled"}</option>)}
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
