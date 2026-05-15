"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { ExternalLink, Check, ChevronLeft, ChevronRight } from "lucide-react"
import type { AdminCatalogAssetItem, AdminCatalogFilters } from "@/features/assets/admin-catalog-types"
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={onPrevious} disabled={isFirst}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={onSkip} disabled={isLast}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium ml-2 text-muted-foreground">
            {asset.legacyImageCode || asset.id}
          </span>
          <a href={`/staff/catalog?q=${asset.id}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-4 w-4" />
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
              {asset.preview?.url ? (
                <Image
                  src={asset.preview.url}
                  alt={asset.title || "Asset preview"}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
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
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded border border-destructive/20">
                {error}
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Title (Headline)</label>
              <Input 
                name="headline" 
                defaultValue={asset.headline || ""} 
                placeholder="Enter a short, descriptive title..." 
                className={!asset.headline ? "border-amber-500/50 focus-visible:ring-amber-500" : ""}
              />
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Category</label>
                <select 
                  name="categoryId" 
                  defaultValue={asset.category?.id || ""} 
                  className={`w-full h-9 rounded-md border bg-background px-3 text-sm ${!asset.category ? "border-amber-500/50" : "border-border"}`}
                >
                  <option value="">No Category</option>
                  {filters.categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Event</label>
                <select 
                  name="eventId" 
                  defaultValue={asset.event?.id || ""} 
                  className={`w-full h-9 rounded-md border bg-background px-3 text-sm ${!asset.event ? "border-amber-500/50" : "border-border"}`}
                >
                  <option value="">No Event</option>
                  {filters.events.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t">
              {justSaved && (
                <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Check className="h-4 w-4" /> Saved
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
