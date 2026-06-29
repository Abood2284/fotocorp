"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { useToastNotify } from "@/components/staff/shared/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { HelpArticleMediaItem } from "@/lib/api/staff-help-api"
import { StaffApiError } from "@/lib/api/staff-api"
import { getHelpMediaDisplayUrl } from "@/lib/staff/help-media"
import {
  defaultHelpMediaTitle,
  nextHelpMediaSortOrder,
  validateHelpMediaFile,
} from "@/lib/staff/help-media-validation"
import { uploadHelpArticleMedia } from "@/lib/staff/help-media-upload-client"
import { staffHelpClientJson } from "@/lib/staff/help-client"

interface HelpMediaManagerProps {
  articleId: string
  initialItems: HelpArticleMediaItem[]
}

interface UploadFormState {
  title: string
  description: string
  sortOrder: string
}

export function HelpMediaManager({ articleId, initialItems }: HelpMediaManagerProps) {
  const router = useRouter()
  const { toast } = useToastNotify()
  const [items, setItems] = useState(initialItems)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadForm, setUploadForm] = useState<UploadFormState>({
    title: "",
    description: "",
    sortOrder: String(nextHelpMediaSortOrder(initialItems)),
  })
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<UploadFormState>({ title: "", description: "", sortOrder: "0" })
  const [isPending, startTransition] = useTransition()

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
    [items],
  )

  function refreshList(nextItems: HelpArticleMediaItem[]) {
    setItems(nextItems)
    router.refresh()
  }

  function handleFileChange(file: File | null) {
    setSelectedFile(file)
    setError(null)
    if (!file) return
    setUploadForm((current) => ({
      ...current,
      title: current.title.trim() ? current.title : defaultHelpMediaTitle(file),
      sortOrder: String(nextHelpMediaSortOrder(items)),
    }))
  }

  async function uploadMedia() {
    if (!selectedFile) {
      setError("Choose a file to upload.")
      return
    }

    const validation = validateHelpMediaFile(selectedFile)
    if (!validation.ok) {
      setError(validation.message)
      return
    }

    setError(null)
    setUploadProgress(0)

    startTransition(async () => {
      try {
        const media = await uploadHelpArticleMedia({
          articleId,
          file: selectedFile,
          title: uploadForm.title.trim() || defaultHelpMediaTitle(selectedFile),
          description: uploadForm.description.trim() || null,
          sortOrder: Number.parseInt(uploadForm.sortOrder || "0", 10),
          existingSortOrders: items,
          onProgress: (percent) => setUploadProgress(percent),
        })

        toast({ message: "Media uploaded.", variant: "success" })
        refreshList([...items, media])
        setSelectedFile(null)
        setUploadForm({
          title: "",
          description: "",
          sortOrder: String(nextHelpMediaSortOrder([...items, media])),
        })
        setUploadProgress(null)
      } catch (caught) {
        const message = caught instanceof StaffApiError ? caught.message : "Could not upload media."
        setError(message)
        toast({ message, variant: "error" })
        setUploadProgress(null)
      }
    })
  }

  async function saveMetadata(mediaId: string) {
    startTransition(async () => {
      try {
        const response = await staffHelpClientJson<{ ok: true; media: HelpArticleMediaItem }>(
          `/articles/${articleId}/media/${mediaId}`,
          {
            method: "PATCH",
            body: {
              title: editForm.title.trim(),
              description: editForm.description.trim() || null,
              sortOrder: Number.parseInt(editForm.sortOrder || "0", 10),
            },
          },
        )
        toast({ message: "Media updated.", variant: "success" })
        refreshList(items.map((item) => (item.id === mediaId ? response.media : item)))
        setEditingId(null)
      } catch (caught) {
        const message = caught instanceof StaffApiError ? caught.message : "Could not update media."
        toast({ message, variant: "error" })
      }
    })
  }

  async function removeMedia(mediaId: string) {
    startTransition(async () => {
      try {
        await staffHelpClientJson(`/articles/${articleId}/media/${mediaId}`, { method: "DELETE" })
        toast({ message: "Media deleted.", variant: "success" })
        refreshList(items.filter((item) => item.id !== mediaId))
      } catch (caught) {
        const message = caught instanceof StaffApiError ? caught.message : "Could not delete media."
        toast({ message, variant: "error" })
      }
    })
  }

  async function saveOrder() {
    startTransition(async () => {
      try {
        const response = await staffHelpClientJson<{ ok: true; items: HelpArticleMediaItem[] }>(
          `/articles/${articleId}/media/reorder`,
          {
            method: "POST",
            body: {
              items: sortedItems.map((item) => ({ mediaId: item.id, sortOrder: item.sortOrder })),
            },
          },
        )
        toast({ message: "Media order saved.", variant: "success" })
        refreshList(response.items)
      } catch (caught) {
        const message = caught instanceof StaffApiError ? caught.message : "Could not save media order."
        toast({ message, variant: "error" })
      }
    })
  }

  return (
    <section className="space-y-6 rounded-lg border border-border bg-card p-5">
      <div>
        <h2 className="font-serif text-lg font-semibold text-foreground">Media attachments</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload screenshots or short videos to make this guide easier to follow.
        </p>
      </div>

      {!sortedItems.length ? (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          No media attached yet. Upload screenshots or short videos to make this guide easier to follow.
        </p>
      ) : (
        <div className="space-y-4">
          {sortedItems.map((item) => (
            <article key={item.id} className="rounded-md border border-border bg-muted/20 p-4">
              {editingId === item.id ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm md:col-span-2">
                    <span className="font-medium">Title</span>
                    <Input value={editForm.title} onChange={(event) => setEditForm((c) => ({ ...c, title: event.target.value }))} />
                  </label>
                  <label className="space-y-1 text-sm md:col-span-2">
                    <span className="font-medium">Description</span>
                    <textarea
                      value={editForm.description}
                      onChange={(event) => setEditForm((c) => ({ ...c, description: event.target.value }))}
                      rows={2}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Sort order</span>
                    <Input
                      type="number"
                      min={0}
                      value={editForm.sortOrder}
                      onChange={(event) => setEditForm((c) => ({ ...c, sortOrder: event.target.value }))}
                    />
                  </label>
                  <div className="flex gap-2 md:col-span-2">
                    <Button type="button" size="sm" disabled={isPending} onClick={() => saveMetadata(item.id)}>
                      Save metadata
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-foreground">{item.title ?? "Untitled media"}</h3>
                      <Badge variant="outline">{item.mediaType}</Badge>
                      {item.uploadStatus && item.uploadStatus !== "READY" ? (
                        <Badge variant="warning">{item.uploadStatus}</Badge>
                      ) : null}
                    </div>
                    {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
                    <p className="text-xs text-muted-foreground">
                      Sort {item.sortOrder}
                      {item.fileSizeBytes ? ` · ${formatBytes(item.fileSizeBytes)}` : ""}
                      {item.width && item.height ? ` · ${item.width}×${item.height}` : ""}
                      {item.durationSeconds ? ` · ${item.durationSeconds}s` : ""}
                    </p>
                    {item.uploadStatus === "READY" || !item.uploadStatus ? (
                      item.mediaType === "VIDEO" ? (
                        <video
                          controls
                          preload="metadata"
                          className="max-h-64 w-full max-w-xl rounded-md border border-border bg-black"
                          src={getHelpMediaDisplayUrl(item.id)}
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={getHelpMediaDisplayUrl(item.id)}
                          alt={item.title ?? "Help article screenshot"}
                          loading="lazy"
                          className="max-h-64 w-full max-w-xl rounded-md border border-border object-contain bg-background"
                        />
                      )
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(item.id)
                        setEditForm({
                          title: item.title ?? "",
                          description: item.description ?? "",
                          sortOrder: String(item.sortOrder),
                        })
                      }}
                    >
                      Edit metadata
                    </Button>
                    <Button type="button" size="sm" variant="secondary" disabled={isPending} onClick={() => removeMedia(item.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </article>
          ))}
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={saveOrder}>
            Save order
          </Button>
        </div>
      )}

      <div className="space-y-4 rounded-md border border-border bg-background p-4">
        <h3 className="text-sm font-semibold text-foreground">Upload media</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium">File</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium">Title</span>
            <Input value={uploadForm.title} onChange={(event) => setUploadForm((c) => ({ ...c, title: event.target.value }))} />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium">Description</span>
            <textarea
              value={uploadForm.description}
              onChange={(event) => setUploadForm((c) => ({ ...c, description: event.target.value }))}
              rows={2}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Sort order</span>
            <Input
              type="number"
              min={0}
              value={uploadForm.sortOrder}
              onChange={(event) => setUploadForm((c) => ({ ...c, sortOrder: event.target.value }))}
            />
          </label>
        </div>
        {uploadProgress != null ? (
          <p className="text-xs text-muted-foreground">Uploading… {uploadProgress}%</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="button" disabled={isPending || !selectedFile} onClick={uploadMedia}>
          Upload media
        </Button>
      </div>
    </section>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
