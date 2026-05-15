"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import {
  completeContributorUploadFile,
  createContributorEvent,
  createContributorUploadBatch,
  ContributorApiError,
  getContributorAssetCategories,
  getContributorPortalContributors,
  humanizeContributorNetworkError,
  prepareContributorUploadFiles,
  putContributorFileToSignedUrl,
  submitContributorUploadBatch,
  type ContributorAssetCategoryDto,
  type ContributorAuthResponse,
  type ContributorPortalContributorDto,
  type ContributorPrepareUploadFileMeta,
  type ContributorPrepareUploadFilesResponse,
  type ContributorPrepareUploadItemInstruction,
} from "@/lib/api/contributor-api"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

const MAX_FILE_BYTES = 50 * 1024 * 1024
const MAX_FILES_PER_PREPARE = 100
const UPLOAD_CONCURRENCY = 3
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"])

export type FileUiStatus =
  | "queued"
  | "preparing"
  | "ready"
  | "uploading"
  | "finalizing"
  | "done"
  | "failed"

interface TrackedFile {
  key: string
  file: File
  status: FileUiStatus
  errorMessage: string | null
  itemId: string | null
  instruction: ContributorPrepareUploadItemInstruction | null
  /** 0–100 while uploading (XHR progress); otherwise null */
  uploadProgress: number | null
}

function shortId(id: string) {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase()
}

function extensionOf(name: string) {
  const base = name.trim().split(/[/\\]/).pop() ?? ""
  const m = base.match(/\.([A-Za-z0-9]{1,8})$/)
  return m ? m[1]!.toLowerCase() : ""
}

function mimeForUpload(file: File): "image/jpeg" | "image/png" | "image/webp" | null {
  const ext = extensionOf(file.name)
  const t = file.type.trim().toLowerCase()
  if (t === "image/jpeg" || t === "image/png" || t === "image/webp") return t as "image/jpeg" | "image/png" | "image/webp"
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg"
  if (ext === "png") return "image/png"
  if (ext === "webp") return "image/webp"
  return null
}

function validateFiles(files: File[]): string | null {
  if (files.length === 0) return "Select at least one image."
  for (const f of files) {
    const ext = extensionOf(f.name)
    if (!ALLOWED_EXT.has(ext)) return `Not allowed: ${f.name} (use JPG, PNG, or WebP).`
    if (f.size > MAX_FILE_BYTES) return `${f.name} exceeds 50 MB.`
    if (f.size < 1) return `${f.name} is empty.`
    if (!mimeForUpload(f)) return `${f.name} must be JPG, PNG, or WebP.`
  }
  return null
}

function portalRoleOf(session: ContributorAuthResponse) {
  return session.account.portalRole ?? "STANDARD"
}

export function ContributorUploadFlow({ initialSession }: { initialSession: ContributorAuthResponse }) {
  const router = useRouter()
  const [eventId, setEventId] = useState("")
  const [batchEventName, setBatchEventName] = useState("")
  const [newEventName, setNewEventName] = useState("")
  const [categories, setCategories] = useState<ContributorAssetCategoryDto[]>([])
  const [contributors, setContributors] = useState<ContributorPortalContributorDto[]>([])
  const [targetContributorId, setTargetContributorId] = useState(initialSession.contributor.id)
  const [newCategoryId, setNewCategoryId] = useState("")
  const [createBusy, setCreateBusy] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)
  const [commonTitle, setCommonTitle] = useState("")
  const [commonCaption, setCommonCaption] = useState("")
  const [commonKeywords, setCommonKeywords] = useState("")
  const [tracked, setTracked] = useState<TrackedFile[]>([])
  const [blockingError, setBlockingError] = useState<string | null>(null)
  const [assetType, setAssetType] = useState<"IMAGE" | "VIDEO" | "CARICATURE" | null>(null)
  const [phase, setPhase] = useState<"idle" | "running">("idle")
  const [batchId, setBatchId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isPortalAdmin = portalRoleOf(initialSession) === "PORTAL_ADMIN"

  useEffect(() => {
    void getContributorAssetCategories()
      .then((r) => setCategories(r.categories))
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    if (!isPortalAdmin) return
    void getContributorPortalContributors({ limit: 100 })
      .then((r) => setContributors(r.contributors))
      .catch(() => setContributors([]))
  }, [isPortalAdmin])

  const updateTracked = useCallback((key: string, patch: Partial<TrackedFile>) => {
    setTracked((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }, [])

  const onFilesPicked = useCallback((list: FileList | null) => {
    if (!list?.length) return
    const next: TrackedFile[] = []
    for (let i = 0; i < list.length; i += 1) {
      const file = list.item(i)!
      const key = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${i}-${file.name}`
      next.push({
        key,
        file,
        status: "queued",
        errorMessage: null,
        itemId: null,
        instruction: null,
        uploadProgress: null,
      })
    }
    setTracked((prev) => [...prev, ...next])
    setBlockingError(null)
  }, [])

  const removeFile = useCallback((key: string) => {
    if (phase === "running") return
    setTracked((prev) => prev.filter((r) => r.key !== key))
  }, [phase])

  const clearAllFiles = useCallback(() => {
    if (phase === "running") return
    setTracked([])
    setBlockingError(null)
  }, [phase])

  const retryFailed = useCallback(() => {
    setTracked((prev) =>
      prev.map((r) =>
        r.status === "failed"
          ? {
              ...r,
              status: "queued" as const,
              errorMessage: null,
              uploadProgress: null,
            }
          : r,
      ),
    )
    setBlockingError(null)
  }, [])

  const handleCreateEventInline = useCallback(async () => {
    setCreateErr(null)
    const name = newEventName.trim()
    if (name.length < 2) {
      setCreateErr("Enter an event name (at least 2 characters).")
      return
    }
    if (!newCategoryId) {
      setCreateErr("Select a category.")
      return
    }
    if (isPortalAdmin && !targetContributorId) {
      setCreateErr("Select a photographer.")
      return
    }
    setCreateBusy(true)
    try {
      const res = await createContributorEvent({
        name,
        categoryId: newCategoryId,
        ...(isPortalAdmin ? { targetContributorId } : {}),
      })
      setEventId(res.event.id)
      setBatchEventName(res.event.name)
      setNewEventName("")
      setNewCategoryId("")
      setBlockingError(null)
      router.refresh()
    } catch (e) {
      setCreateErr(e instanceof ContributorApiError ? e.message : "Could not create event.")
    } finally {
      setCreateBusy(false)
    }
  }, [isPortalAdmin, newCategoryId, newEventName, router, targetContributorId])

  const runUpload = useCallback(async () => {
    setBlockingError(null)
    if (!eventId) {
      setBlockingError("Create an event for this batch first (step 1), then try again.")
      return
    }
    const files = tracked.map((t) => t.file)
    const v = validateFiles(files)
    if (v) {
      setBlockingError(v)
      return
    }

    setPhase("running")
    let currentBatchId = batchId

    try {
      if (!currentBatchId) {
        const created = await createContributorUploadBatch({
          eventId,
          assetType: assetType!,
          commonTitle: commonTitle.trim() || undefined,
          commonCaption: commonCaption.trim() || undefined,
          commonKeywords: commonKeywords.trim() || undefined,
        })
        currentBatchId = created.batch.id
        setBatchId(currentBatchId)
      }

      const work = tracked.filter(
        (t) =>
          t.status === "queued" ||
          t.status === "failed" ||
          t.status === "ready" ||
          t.status === "preparing",
      )
      if (work.length === 0) {
        setPhase("idle")
        return
      }

      const needsPrepare = work.filter((t) => !t.itemId)
      const alreadyPrepared = work.filter((t) => t.itemId && t.instruction)

      const uploadTasks: { key: string; instruction: ContributorPrepareUploadItemInstruction; file: File }[] = []

      if (needsPrepare.length > 0) {
        for (const r of needsPrepare) {
          updateTracked(r.key, { status: "preparing", errorMessage: null })
        }

        for (let offset = 0; offset < needsPrepare.length; offset += MAX_FILES_PER_PREPARE) {
          const slice = needsPrepare.slice(offset, offset + MAX_FILES_PER_PREPARE)
          const meta: ContributorPrepareUploadFileMeta[] = slice.map((r) => {
            const mime = mimeForUpload(r.file)!
            return { fileName: r.file.name, mimeType: mime, sizeBytes: r.file.size }
          })
          let prep: ContributorPrepareUploadFilesResponse
          try {
            prep = await prepareContributorUploadFiles(currentBatchId!, meta)
          } catch (e) {
            if (e instanceof ContributorApiError && e.code === "UPLOAD_STORAGE_NOT_CONFIGURED") {
              setBlockingError(
                e.message ||
                  "Upload storage is not configured for this environment. Please contact staff.",
              )
              for (const s of slice) {
                updateTracked(s.key, { status: "failed", errorMessage: "Upload storage not configured" })
              }
              setPhase("idle")
              return
            }
            throw e
          }
          if (prep.items.length !== slice.length) {
            throw new Error("Prepare response size mismatch.")
          }
          for (let i = 0; i < slice.length; i += 1) {
            const instruction = prep.items[i]!
            const row = slice[i]!
            if (instruction.uploadMethod === "NOT_CONFIGURED") {
              setBlockingError(
                "Upload storage is not configured for this environment. Please contact staff.",
              )
              for (const s of slice) {
                updateTracked(s.key, { status: "failed", errorMessage: "Upload not configured" })
              }
              setPhase("idle")
              return
            }
            updateTracked(row.key, {
              itemId: instruction.itemId,
              instruction,
              status: "ready",
              uploadProgress: null,
            })
            uploadTasks.push({ key: row.key, instruction, file: row.file })
          }
        }
      }

      for (const r of alreadyPrepared) {
        if (r.instruction?.uploadMethod === "NOT_CONFIGURED") {
          updateTracked(r.key, { status: "failed", errorMessage: "Upload not configured" })
          continue
        }
        if (r.instruction && r.file) {
          uploadTasks.push({ key: r.key, instruction: r.instruction, file: r.file })
        }
      }

      let completed = 0
      let uploadCursor = 0
      async function uploadWorker() {
        while (true) {
          const i = uploadCursor++
          if (i >= uploadTasks.length) break
          const { key, instruction, file } = uploadTasks[i]!
          if (instruction.uploadMethod !== "SIGNED_PUT" || !instruction.uploadUrl) {
            updateTracked(key, { status: "failed", errorMessage: "Missing signed upload", uploadProgress: null })
            continue
          }

          const mime = instruction.headers["content-type"] as "image/jpeg" | "image/png" | "image/webp"

          updateTracked(key, { status: "uploading", errorMessage: null, uploadProgress: 0 })
          let putRes: { ok: boolean; status: number }
          try {
            putRes = await putContributorFileToSignedUrl(instruction.uploadUrl, file, mime, (pct) => {
              updateTracked(key, { uploadProgress: pct })
            })
          } catch (e) {
            updateTracked(key, {
              status: "failed",
              uploadProgress: null,
              errorMessage: humanizeContributorNetworkError(e),
            })
            continue
          }

          if (!putRes.ok) {
            updateTracked(key, {
              status: "failed",
              uploadProgress: null,
              errorMessage: `Upload to storage failed (HTTP ${putRes.status}). Try again or use a smaller file.`,
            })
            continue
          }

          updateTracked(key, { status: "finalizing", uploadProgress: null })
          try {
            await completeContributorUploadFile(currentBatchId!, instruction.itemId)
            updateTracked(key, { status: "done", uploadProgress: null })
            completed += 1
          } catch (e) {
            const msg =
              e instanceof ContributorApiError
                ? e.message
                : humanizeContributorNetworkError(e)
            updateTracked(key, { status: "failed", errorMessage: msg, uploadProgress: null })
          }
        }
      }

      const poolSize = Math.min(UPLOAD_CONCURRENCY, Math.max(1, uploadTasks.length))
      await Promise.all(Array.from({ length: poolSize }, () => uploadWorker()))

      if (completed < 1 && work.length > 0) {
        setBlockingError("No files finished successfully. Fix errors or retry failed uploads, then try again.")
      }
      setPhase("idle")
    } catch (e) {
      const msg =
        e instanceof ContributorApiError
          ? e.message
          : humanizeContributorNetworkError(e)
      setBlockingError(msg)
      setPhase("idle")
    }
  }, [
    assetType,
    batchId,
    commonCaption,
    commonKeywords,
    commonTitle,
    eventId,
    tracked,
    updateTracked,
  ])

  const submitBatch = useCallback(async () => {
    if (!batchId) return
    setSubmitError(null)
    const done = tracked.filter((t) => t.status === "done").length
    if (done < 1) {
      setSubmitError("Upload and finalize at least one file before submitting.")
      return
    }
    setSubmitting(true)
    try {
      await submitContributorUploadBatch(batchId)
      router.push(`/contributor/uploads/${batchId}`)
      router.refresh()
    } catch (e) {
      const msg =
        e instanceof ContributorApiError
          ? e.message
          : humanizeContributorNetworkError(e)
      setSubmitError(msg)
    } finally {
      setSubmitting(false)
    }
  }, [batchId, router, tracked])

  const doneCount = tracked.filter((t) => t.status === "done").length
  const totalCount = tracked.length
  const hasRetryableFailed = tracked.some((t) => t.status === "failed")

  if (!assetType) {
    return (
      <div className="mx-auto mt-6 max-w-xl space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 md:p-8 shadow-sm text-center md:text-left">
          <h2 className="text-xl font-semibold text-foreground">What are you uploading?</h2>
          <p className="mt-2 text-sm text-muted-foreground">Select the type of media for this batch.</p>
          <div className="mt-8 space-y-4">
            <button
              onClick={() => setAssetType("IMAGE")}
              className="group flex w-full items-center justify-between rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <div>
                <p className="font-medium text-foreground transition-colors group-hover:text-primary">Images</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Photos, JPEGs, PNGs, WebP</p>
              </div>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                →
              </span>
            </button>
            <button
              disabled
              className="flex w-full items-center justify-between rounded-xl border border-border bg-muted/20 p-4 text-left opacity-60 cursor-not-allowed"
            >
              <div>
                <p className="font-medium text-foreground">Videos</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Coming soon</p>
              </div>
            </button>
            <button
              disabled
              className="flex w-full items-center justify-between rounded-xl border border-border bg-muted/20 p-4 text-left opacity-60 cursor-not-allowed"
            >
              <div>
                <p className="font-medium text-foreground">Caricatures / Illustrations</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Coming soon</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {blockingError ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {blockingError}
        </div>
      ) : null}
      {phase === "running" ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground"
        >
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
          <div>
            <p className="font-medium text-foreground">Upload in progress</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Keep this tab open. Up to {UPLOAD_CONCURRENCY} files upload at once; large images can take a while. If something fails, you will see a clear message below—generic browser errors usually mean a network or storage (CORS) issue.
            </p>
          </div>
        </div>
      ) : null}
      {submitError ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {submitError}
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Left Column: Metadata & Details */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-foreground flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[0.65rem] text-primary">1</span>
              Batch Details
            </h2>
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="mb-1.5">
                  <span className="text-sm font-medium text-foreground">Event for this batch</span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create a new event here; batches must be tied to an event before upload.
                  </p>
                </div>

                {eventId ? (
                  <div className="rounded-lg border border-border bg-muted/20 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-foreground">
                        <span className="text-muted-foreground">Event:</span>{" "}
                        <span className="font-medium">{batchEventName || "—"}</span>
                      </p>
                      <button
                        type="button"
                        className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                        disabled={phase === "running"}
                        onClick={() => {
                          setEventId("")
                          setBatchEventName("")
                          setCreateErr(null)
                        }}
                      >
                        Change
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                    {createErr ? <p className="text-xs text-destructive">{createErr}</p> : null}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground" htmlFor="new-event-name">
                        Event name <span className="text-destructive">*</span>
                      </label>
                      <input
                        id="new-event-name"
                        type="text"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="Name your new event…"
                        value={newEventName}
                        disabled={phase === "running" || createBusy}
                        onChange={(e) => {
                          setNewEventName(e.target.value)
                          setCreateErr(null)
                        }}
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground" htmlFor="inline-cat">
                        Category <span className="text-destructive">*</span>
                      </label>
                      <select
                        id="inline-cat"
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        value={newCategoryId}
                        disabled={phase === "running" || createBusy}
                        onChange={(e) => setNewCategoryId(e.target.value)}
                      >
                        <option value="">Select…</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {isPortalAdmin ? (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground" htmlFor="inline-photo">
                          Photographer <span className="text-destructive">*</span>
                        </label>
                        <select
                          id="inline-photo"
                          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                          value={targetContributorId}
                          disabled={phase === "running" || createBusy}
                          onChange={(e) => setTargetContributorId(e.target.value)}
                        >
                          {contributors.length === 0 ? (
                            <option value={initialSession.contributor.id}>{initialSession.contributor.displayName}</option>
                          ) : null}
                          {contributors.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.displayName}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Photographer:{" "}
                        <span className="font-medium text-foreground">{initialSession.contributor.displayName}</span>
                      </p>
                    )}
                    <Button
                      type="button"
                      className="w-full"
                      disabled={phase === "running" || createBusy || !categories.length}
                      onClick={() => void handleCreateEventInline()}
                    >
                      {createBusy ? "Creating…" : "Create and use for this batch"}
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-4 rounded-xl border border-border/50 bg-muted/10 p-4">
                <p className="text-xs text-muted-foreground">Common metadata applied to all images in this batch.</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm">
                    <span className="mb-1.5 block text-muted-foreground">Title</span>
                    <input
                      type="text"
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                      value={commonTitle}
                      disabled={phase === "running"}
                      onChange={(e) => setCommonTitle(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1.5 block text-muted-foreground">Keywords</span>
                    <input
                      type="text"
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                      value={commonKeywords}
                      disabled={phase === "running"}
                      onChange={(e) => setCommonKeywords(e.target.value)}
                      placeholder="Comma separated"
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-muted-foreground">Caption</span>
                  <textarea
                    className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    value={commonCaption}
                    disabled={phase === "running"}
                    onChange={(e) => setCommonCaption(e.target.value)}
                    placeholder="Optional description for the entire batch..."
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Files & Upload */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[0.65rem] text-primary">2</span>
                Files
              </h2>
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    multiple
                    className="sr-only"
                    disabled={phase === "running"}
                    onChange={(e) => {
                      onFilesPicked(e.target.files)
                      e.target.value = ""
                    }}
                  />
                  Browse files
                </label>
                {tracked.length > 0 && (
                  <Button type="button" variant="outline" size="sm" disabled={phase === "running"} onClick={clearAllFiles}>
                    Clear
                  </Button>
                )}
                {hasRetryableFailed && (
                  <Button type="button" variant="secondary" size="sm" disabled={phase === "running"} onClick={retryFailed}>
                    Retry failed
                  </Button>
                )}
              </div>
            </div>

            <div
              className={cn(
                "mb-4 flex min-h-[120px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 px-6 py-8 text-center transition-colors",
                phase !== "running" && "hover:border-primary/40 hover:bg-muted/30",
              )}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (phase === "running") return
                onFilesPicked(e.dataTransfer.files)
              }}
            >
              {tracked.length === 0 ? (
                <>
                  <p className="text-sm font-medium text-foreground">Drag and drop images here</p>
                  <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, or WebP up to 50MB</p>
                </>
              ) : (
                <p className="text-sm font-medium text-foreground">{tracked.length} files selected for upload</p>
              )}
            </div>

            {totalCount > 0 ? (
              <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{doneCount} of {totalCount} completed</span>
                <span>Max 100 files / batch</span>
              </div>
            ) : null}

            {tracked.length > 0 ? (
              <div className="max-h-[300px] overflow-y-auto rounded-lg border border-border">
                <ul className="divide-y divide-border">
                  {tracked.map((row) => (
                    <li key={row.key} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between hover:bg-muted/10 transition-colors">
                      <div className="min-w-0 flex-1 pr-4">
                        <p className="truncate font-medium text-foreground">{row.file.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                          {formatFileSize(row.file.size)} · {labelForStatus(row.status)}
                        </p>
                        {row.status === "uploading" && row.uploadProgress !== null ? (
                          <div className="mt-2 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-muted" aria-label={`Upload ${row.uploadProgress}%`}>
                            <div
                              className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                              style={{ width: `${row.uploadProgress}%` }}
                            />
                          </div>
                        ) : null}
                        {row.errorMessage && <p className="mt-1 text-[0.65rem] font-semibold text-destructive">{row.errorMessage}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider",
                            row.status === "done" && "bg-primary/20 text-primary",
                            row.status === "failed" && "bg-destructive/15 text-destructive",
                            row.status === "ready" && "bg-amber-500/15 text-amber-800 dark:text-amber-200",
                            row.status !== "done" &&
                              row.status !== "failed" &&
                              row.status !== "ready" &&
                              "bg-muted/50 text-muted-foreground",
                          )}
                        >
                          {badgeLabelForStatus(row.status)}
                        </span>
                        {phase !== "running" && row.status !== "done" && (
                          <button
                            type="button"
                            className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground hover:text-destructive transition-colors"
                            onClick={() => removeFile(row.key)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {tracked.length > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">Queued</span> = picked on your device, not sent yet.{" "}
                <span className="font-medium text-foreground">Preparing</span> = asking the server for a secure upload slot.{" "}
                <span className="font-medium text-foreground">Waiting</span> = ready to send bytes.{" "}
                <span className="font-medium text-foreground">Uploading</span> shows a progress bar to cloud storage.{" "}
                <span className="font-medium text-foreground">Finalizing</span> = registering the file after upload. Finish step 1, then use{" "}
                <span className="font-medium text-foreground">Start Upload</span>.
              </p>
            ) : null}
          </div>

          {/* Action Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[0.65rem] text-primary">3</span>
                Upload & Submit
              </h2>
              <p className="text-[0.65rem] text-muted-foreground">
                {batchId ? (
                  <>Batch <span className="font-mono">{shortId(batchId)}</span> active.</>
                ) : (
                  <>
                    Create your event in step 1, add files in step 2, then start upload. Until then, new files stay{" "}
                    <span className="font-medium text-foreground">Queued</span>.
                  </>
                )}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={
                  phase === "running" ||
                  !eventId ||
                  tracked.length === 0
                }
                title={
                  phase === "running"
                    ? undefined
                    : !eventId
                      ? "Create an event for this batch first (step 1)."
                      : tracked.length === 0
                        ? "Add at least one file (step 2)."
                        : undefined
                }
                onClick={() => void runUpload()}
              >
                {phase === "running" ? "Working…" : "Start Upload"}
              </Button>
              <Button
                type="button"
                disabled={!batchId || doneCount < 1 || phase === "running" || submitting}
                onClick={() => void submitBatch()}
              >
                {submitting ? "Submitting…" : "Submit Batch"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function labelForStatus(s: FileUiStatus) {
  if (s === "queued") return "Queued"
  if (s === "preparing") return "Preparing"
  if (s === "ready") return "Waiting to upload"
  if (s === "uploading") return "Uploading"
  if (s === "finalizing") return "Finalizing"
  if (s === "done") return "Finalized"
  if (s === "failed") return "Failed"
  return s
}

function badgeLabelForStatus(s: FileUiStatus) {
  if (s === "queued") return "Queued"
  if (s === "preparing") return "Prepare"
  if (s === "ready") return "Waiting"
  if (s === "uploading") return "Sending"
  if (s === "finalizing") return "Save"
  if (s === "done") return "Done"
  if (s === "failed") return "Failed"
  return s
}

function formatFileSize(bytes: number) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}
