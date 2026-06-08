"use client"

import { ExternalLink, Check, ChevronLeft, ChevronRight } from "lucide-react"
import { useState, useEffect } from "react"
import { PreviewImage } from "@/components/assets/preview-image"

import type { AdminCatalogAssetItem, AdminCatalogFilters } from "@/features/assets/admin-catalog-types"
import {
  adminAssetDisplayCode,
  adminAssetEventOptions,
  adminAssetEventTitle,
  bestAdminAssetDetailPreviewVariant,
  isAdminAssetEventLocked,
  staffCatalogPreviewImageUrl,
} from "@/lib/staff/admin-asset-preview"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateCaptionDataAction } from "@/app/(staff)/staff/(workspace)/captions/actions"

interface Props {
  asset: AdminCatalogAssetItem
  filters: AdminCatalogFilters
  onSaveAndNext: () => void
  onSkip: () => void
  onPrevious: () => void
  isFirst: boolean
  isLast: boolean
}

export function StaffCaptionsEditor({ asset, filters, onSaveAndNext, onSkip, onPrevious, isFirst, isLast }: Props) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  // Reset states when asset changes
  useEffect(() => {
    setError(null)
    setJustSaved(false)
  }, [asset.id])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    setJustSaved(false)

    const formData = new FormData(e.currentTarget)
    
    // Check which button submitted the form
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement
    const isSaveAndNext = submitter?.name === "saveAndNext"

    try {
      const res = await updateCaptionDataAction(asset.id, formData)
      if (res.error) {
        setError(res.error)
      } else {
        if (isSaveAndNext) {
          onSaveAndNext()
        } else {
          setJustSaved(true)
          setTimeout(() => setJustSaved(false), 2000)
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to update asset.")
    } finally {
      setIsSaving(false)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if they're typing in a textarea or input unless they hold mod
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement
      
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        // We can't cleanly trigger the "Save & Next" from here without a ref to the form,
        // so we'll just let them use the button for now to keep it simple and safe.
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const previewVariant = bestAdminAssetDetailPreviewVariant(asset)
  const eventLocked = isAdminAssetEventLocked(asset)
  const eventTitle = adminAssetEventTitle(asset)
  const [eventId, setEventId] = useState(asset.event?.id ?? "")
  const eventOptions = adminAssetEventOptions(asset, filters.events)

  useEffect(() => {
    setEventId(asset.event?.id ?? "")
  }, [asset.id, asset.event?.id])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={onPrevious} disabled={isFirst}>
            <ChevronLeft size={16} />
          </Button>
          <Button variant="outline" size="icon" onClick={onSkip} disabled={isLast}>
            <ChevronRight size={16} />
          </Button>
          <span className="text-sm font-medium ml-2 text-muted-foreground font-mono">
            {adminAssetDisplayCode(asset)}
          </span>
          <a href={`/staff/catalog?q=${asset.id}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
            <ExternalLink size={16} />
          </a>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSkip}>Skip</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl grid gap-8 md:grid-cols-2">
          
          <div className="space-y-4">
            <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden relative border shadow-sm flex items-center justify-center">
              {previewVariant ? (
                <PreviewImage
                  src={staffCatalogPreviewImageUrl(asset.id, previewVariant)}
                  alt={eventTitle || asset.whoIsInPicture || "Asset preview"}
                  className="h-full w-full object-contain"
                  loading="eager"
                />
              ) : (
                <div className="text-muted-foreground">No preview available</div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
              <div>
                <span className="font-semibold">Uploaded:</span>{" "}
                {asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : "—"}
              </div>
              <div>
                <span className="font-semibold">Image Date:</span>{" "}
                {asset.imageDate ? new Date(asset.imageDate).toLocaleDateString() : "—"}
              </div>
              <div>
                <span className="font-semibold">Status:</span> {asset.status}
              </div>
              <div>
                <span className="font-semibold">Visibility:</span> {asset.visibility}
              </div>
            </div>
          </div>

          <form id="caption-form" onSubmit={handleSubmit} className="space-y-5">
            <input type="hidden" name="description" value={asset.description ?? ""} />
            <input type="hidden" name="contributorId" value={asset.contributor?.id ?? ""} />
            <input type="hidden" name="headline" value={eventTitle ?? ""} />
            {eventLocked ? <input type="hidden" name="eventId" value={asset.event?.id ?? ""} /> : null}

            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded border border-destructive/20">
                {error}
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Who is in picture?</label>
              <Input
                name="whoIsInPicture"
                defaultValue={asset.whoIsInPicture || ""}
                placeholder="Names or subjects visible in the image..."
                className={!asset.whoIsInPicture ? "border-amber-500/50 focus-visible:ring-amber-500" : ""}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Title</label>
              <div className={`rounded-md border bg-muted/30 px-3 py-2 text-sm ${!eventTitle ? "border-amber-500/50 text-muted-foreground" : "border-border"}`}>
                {eventTitle || "No event linked — assign an event below to set the title."}
              </div>
              {eventLocked ? (
                <p className="text-xs text-muted-foreground">Title comes from the linked event and cannot be changed here.</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Caption</label>
              <textarea 
                name="caption" 
                defaultValue={asset.caption || ""} 
                placeholder="Enter detailed caption..." 
                rows={5}
                className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${!asset.caption ? "border-amber-500/50 focus-visible:ring-amber-500" : "border-border"}`}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Keywords</label>
              <Input 
                name="keywords" 
                defaultValue={asset.keywords || ""} 
                placeholder="keyword1, keyword2, keyword3..." 
              />
              <p className="text-xs text-muted-foreground">Comma separated values.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Category</label>
              <select
                name="categoryId"
                defaultValue={asset.category?.id || ""}
                className={`w-full h-9 rounded-md border bg-background px-3 text-sm ${!asset.category ? "border-amber-500/50" : "border-border"}`}
              >
                <option value="">No Category</option>
                {filters.categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>

            {!eventLocked ? (
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Event</label>
                <select
                  name="eventId"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className={`w-full h-9 rounded-md border bg-background px-3 text-sm ${!eventId ? "border-amber-500/50" : "border-border"}`}
                >
                  <option value="">No Event</option>
                  {eventOptions.map((event) => (
                    <option key={event.id} value={event.id}>{event.name ?? "Untitled event"}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Assign the event once — it becomes the title and cannot be changed later.</p>
              </div>
            ) : null}

            <div className="pt-4 flex items-center justify-end gap-3 border-t">
              {justSaved && (
                <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Check size={16} /> Saved
                </span>
              )}
              <Button type="submit" name="save" variant="secondary" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
              <Button type="submit" name="saveAndNext" disabled={isSaving}>
                Save & Next
              </Button>
            </div>
          </form>

        </div>
      </div>
    </div>
  )
}
