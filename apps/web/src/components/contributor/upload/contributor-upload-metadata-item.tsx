"use client"

import { useEffect, useRef, useState } from "react"
import type { TrackedFile } from "@/components/contributor/contributor-upload-types"
import { uploadFieldLabelClass, uploadInputClass } from "@/components/contributor/upload/contributor-upload-field-styles"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface MetadataDraft {
  whoIsInPicture: string
  caption: string
  keywords: string
}

interface ContributorUploadMetadataItemProps {
  row: TrackedFile
  onSave: (draft: MetadataDraft) => Promise<void>
}

const SAVE_DEBOUNCE_MS = 800

export function ContributorUploadMetadataItem({ row, onSave }: ContributorUploadMetadataItemProps) {
  const [whoIsInPicture, setWhoIsInPicture] = useState(row.whoIsInPicture)
  const [caption, setCaption] = useState(row.caption)
  const [keywords, setKeywords] = useState(row.keywords)
  const [saveState, setSaveState] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle")
  const [saveHint, setSaveHint] = useState<string | null>(null)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveGenRef = useRef(0)
  const latestDraftRef = useRef<MetadataDraft>({ whoIsInPicture, caption, keywords })

  useEffect(() => {
    setWhoIsInPicture(row.whoIsInPicture)
    setCaption(row.caption)
    setKeywords(row.keywords)
    latestDraftRef.current = {
      whoIsInPicture: row.whoIsInPicture,
      caption: row.caption,
      keywords: row.keywords,
    }
    setSaveState("idle")
    setSaveHint(null)
  }, [row.key])

  useEffect(() => {
    if (!row.saveHint) return
    setWhoIsInPicture(row.whoIsInPicture)
    setCaption(row.caption)
    setKeywords(row.keywords)
    latestDraftRef.current = {
      whoIsInPicture: row.whoIsInPicture,
      caption: row.caption,
      keywords: row.keywords,
    }
    setSaveState("error")
    setSaveHint(row.saveHint)
  }, [row.saveHint, row.whoIsInPicture, row.caption, row.keywords])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  function scheduleSave(next: MetadataDraft) {
    latestDraftRef.current = next
    setSaveState("pending")
    setSaveHint(null)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    saveTimerRef.current = setTimeout(() => {
      void flushSave()
    }, SAVE_DEBOUNCE_MS)
  }

  async function flushSave() {
    const gen = ++saveGenRef.current
    const draft = latestDraftRef.current
    setSaveState("saving")
    setSaveHint(null)
    try {
      await onSave(draft)
      if (gen !== saveGenRef.current) return
      setSaveState("saved")
      setSaveHint(null)
    } catch (e) {
      if (gen !== saveGenRef.current) return
      setSaveState("error")
      setSaveHint(e instanceof Error ? e.message : "Save failed.")
    }
  }

  function patchDraft(patch: Partial<MetadataDraft>) {
    const next = { ...latestDraftRef.current, ...patch }
    if (patch.whoIsInPicture !== undefined) setWhoIsInPicture(patch.whoIsInPicture)
    if (patch.caption !== undefined) setCaption(patch.caption)
    if (patch.keywords !== undefined) setKeywords(patch.keywords)
    scheduleSave(next)
  }

  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-muted/20 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="max-w-full truncate text-sm text-muted-foreground sm:text-base" title={row.file.name}>
            {row.file.name}
          </p>
          <SaveHint state={saveState} hint={saveHint} />
        </div>
      </div>

      <div className="flex flex-col items-center px-4 py-6 sm:px-8 sm:py-8">
        <div className="w-full max-w-2xl">
          {row.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.previewUrl}
              alt=""
              className="mx-auto max-h-[min(52vh,420px)] w-full rounded-xl border border-border object-contain bg-muted/30 shadow-sm"
            />
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-border bg-muted text-sm text-muted-foreground">
              Preview unavailable
            </div>
          )}
        </div>

        <div className="mt-8 w-full max-w-xl space-y-5 sm:mt-10 sm:space-y-6">
          <label className="block space-y-2 text-left">
            <span className={uploadFieldLabelClass}>Caption</span>
            <textarea
              className={cn(
                "min-h-[88px] w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm sm:min-h-[100px] sm:text-base",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              value={caption}
              onChange={(e) => patchDraft({ caption: e.target.value })}
              placeholder="Optional description"
            />
          </label>

          <label className="block space-y-2 text-left">
            <span className={uploadFieldLabelClass}>Keywords</span>
            <Input
              value={keywords}
              onChange={(e) => patchDraft({ keywords: e.target.value })}
              placeholder="Comma separated"
              className={uploadInputClass}
              autoComplete="off"
            />
          </label>

          <label className="block space-y-2 text-left">
            <span className={uploadFieldLabelClass}>Who is in the picture</span>
            <Input
              value={whoIsInPicture}
              onChange={(e) => patchDraft({ whoIsInPicture: e.target.value })}
              placeholder="e.g. Rahul Sharma, Priya Patel"
              className={uploadInputClass}
              autoComplete="off"
            />
            <span className="block text-xs text-muted-foreground sm:text-sm">
              One name or several, separated by commas. Spaces are allowed.
            </span>
          </label>
        </div>
      </div>
    </li>
  )
}

function SaveHint({
  state,
  hint,
}: {
  state: "idle" | "pending" | "saving" | "saved" | "error"
  hint: string | null
}) {
  if (state === "pending") return <span className="text-xs text-muted-foreground sm:text-sm">Saving soon…</span>
  if (state === "saving") return <span className="text-xs text-muted-foreground sm:text-sm">Saving…</span>
  if (state === "saved") return <span className="text-xs font-medium text-primary sm:text-sm">Saved</span>
  if (state === "error") {
    return (
      <span className={cn("text-xs text-destructive sm:text-sm", !hint && "sr-only")} title={hint ?? undefined}>
        {hint ?? "Save failed"}
      </span>
    )
  }
  return null
}

