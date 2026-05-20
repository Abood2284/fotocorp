"use client"

import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  MAX_FILES_PER_PREPARE,
  UPLOAD_CONCURRENCY,
  UPLOAD_STEPS,
  type TrackedFile,
  type UploadWizardStep,
} from "@/components/contributor/contributor-upload-types"
import { ContributorUploadStepEvent } from "@/components/contributor/upload/contributor-upload-step-event"
import { ContributorUploadStepFiles } from "@/components/contributor/upload/contributor-upload-step-files"
import { ContributorUploadStepMetadata } from "@/components/contributor/upload/contributor-upload-step-metadata"
import { ContributorUploadLayout } from "@/components/contributor/upload/contributor-upload-layout"
import { ContributorUploadStatusBar } from "@/components/contributor/upload/contributor-upload-status-bar"
import { ContributorUploadStepper } from "@/components/contributor/upload/contributor-upload-stepper"
import { mimeForJpegUpload, validateJpegFiles } from "@/components/contributor/upload/contributor-upload-utils"
import {
  completeContributorUploadFile,
  createContributorEvent,
  createContributorUploadBatch,
  ContributorApiError,
  getContributorAssetCategories,
  getContributorPortalContributors,
  humanizeContributorNetworkError,
  patchContributorUploadAssetMetadata,
  prepareContributorUploadFiles,
  putContributorFileToSignedUrl,
  submitContributorUploadBatch,
  type ContributorAuthResponse,
  type ContributorAssetCategoryDto,
  type ContributorPortalContributorDto,
  type ContributorPrepareUploadFileMeta,
  type ContributorPrepareUploadItemInstruction,
} from "@/lib/api/contributor-api"
import type { MetadataDraft } from "@/components/contributor/upload/contributor-upload-metadata-item"
import { keywordsToTags, normalizeWhoIsInPicture, tagsToKeywords } from "@/lib/contributor-upload-metadata"
import { Button } from "@/components/ui/button"

function portalRoleOf(session: ContributorAuthResponse) {
  return session.account.portalRole ?? "STANDARD"
}

function newTrackedFile(file: File, index: number): TrackedFile {
  const key = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${index}-${file.name}`
  const previewUrl = URL.createObjectURL(file)
  return {
    key,
    file,
    status: "queued",
    errorMessage: null,
    itemId: null,
    imageAssetId: null,
    instruction: null,
    uploadProgress: null,
    previewUrl,
    whoIsInPicture: "",
    caption: "",
    keywords: "",
    assetUpdatedAt: null,
    saveState: "idle",
    saveHint: null,
  }
}

export function ContributorUploadFlow({ initialSession }: { initialSession: ContributorAuthResponse }) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<UploadWizardStep>(1)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => new Set())

  const [eventId, setEventId] = useState("")
  const [batchEventName, setBatchEventName] = useState("")
  const [newEventName, setNewEventName] = useState("")
  const [newEventDate, setNewEventDate] = useState("")
  const [categories, setCategories] = useState<ContributorAssetCategoryDto[]>([])
  const [contributors, setContributors] = useState<ContributorPortalContributorDto[]>([])
  const [targetContributorId, setTargetContributorId] = useState(initialSession.contributor.id)
  const [newCategoryId, setNewCategoryId] = useState("")
  const [createBusy, setCreateBusy] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)

  const [tracked, setTracked] = useState<TrackedFile[]>([])
  const [rejectedFiles, setRejectedFiles] = useState<{ file: File; reason: string }[]>([])
  const [blockingError, setBlockingError] = useState<string | null>(null)
  const [phase, setPhase] = useState<"idle" | "running">("idle")
  const [batchId, setBatchId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const trackedRef = useRef(tracked)
  trackedRef.current = tracked
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

  useEffect(() => {
    return () => {
      for (const row of tracked) {
        if (row.previewUrl) URL.revokeObjectURL(row.previewUrl)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup on unmount only
  }, [])

  const updateTracked = useCallback((key: string, patch: Partial<TrackedFile>) => {
    setTracked((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }, [])

  const markStepComplete = useCallback((step: number) => {
    setCompletedSteps((prev) => new Set(prev).add(step))
  }, [])

  const onFilesPicked = useCallback((list: FileList | null) => {
    if (!list?.length) return
    const incoming = Array.from(list)
    const { accepted, rejected } = validateJpegFiles(incoming)
    if (rejected.length) setRejectedFiles((prev) => [...prev, ...rejected])
    if (!accepted.length) return

    const next = accepted.map((file, i) => newTrackedFile(file, i))
    setTracked((prev) => [...prev, ...next])
    setBlockingError(null)
  }, [])

  const removeFile = useCallback(
    (key: string) => {
      if (phase === "running") return
      setTracked((prev) => {
        const row = prev.find((r) => r.key === key)
        if (row?.previewUrl) URL.revokeObjectURL(row.previewUrl)
        return prev.filter((r) => r.key !== key)
      })
    },
    [phase],
  )

  const clearAllFiles = useCallback(() => {
    if (phase === "running") return
    setTracked((prev) => {
      for (const row of prev) {
        if (row.previewUrl) URL.revokeObjectURL(row.previewUrl)
      }
      return []
    })
    setRejectedFiles([])
    setBlockingError(null)
  }, [phase])

  const retryFailed = useCallback(() => {
    setTracked((prev) =>
      prev.map((r) =>
        r.status === "failed"
          ? { ...r, status: "queued" as const, errorMessage: null, uploadProgress: null }
          : r,
      ),
    )
    setBlockingError(null)
  }, [])

  const handleCreateEvent = useCallback(async () => {
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
    if (!newEventDate.trim()) {
      setCreateErr("Event date is required.")
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
        eventDate: newEventDate.trim(),
        ...(isPortalAdmin ? { targetContributorId } : {}),
      })
      setEventId(res.event.id)
      setBatchEventName(res.event.name)
      setBlockingError(null)
      markStepComplete(1)
      setCurrentStep(2)
      router.refresh()
    } catch (e) {
      setCreateErr(e instanceof ContributorApiError ? e.message : "Could not create event.")
    } finally {
      setCreateBusy(false)
    }
  }, [isPortalAdmin, markStepComplete, newCategoryId, newEventDate, newEventName, router, targetContributorId])

  const runUpload = useCallback(async () => {
    setBlockingError(null)
    if (!eventId) {
      setBlockingError("Create an event first.")
      return
    }
    const files = tracked.map((t) => t.file)
    const { accepted, rejected } = validateJpegFiles(files)
    if (rejected.length) {
      setRejectedFiles((prev) => [...prev, ...rejected])
    }
    if (!accepted.length) {
      setBlockingError("Add at least one valid JPG file.")
      return
    }

    setPhase("running")
    let currentBatchId = batchId

    try {
      if (!currentBatchId) {
        const created = await createContributorUploadBatch({
          eventId,
          assetType: "IMAGE",
        })
        currentBatchId = created.batch.id
        setBatchId(currentBatchId)
      }

      const work = tracked.filter(
        (t) => t.status === "queued" || t.status === "failed" || t.status === "ready" || t.status === "preparing",
      )
      if (work.length === 0) {
        setPhase("idle")
        return
      }

      const needsPrepare = work.filter((t) => !t.itemId)
      const alreadyPrepared = work.filter((t) => t.itemId && t.instruction)
      const uploadTasks: { key: string; instruction: ContributorPrepareUploadItemInstruction; file: File }[] = []

      if (needsPrepare.length > 0) {
        for (const r of needsPrepare) updateTracked(r.key, { status: "preparing", errorMessage: null })

        for (let offset = 0; offset < needsPrepare.length; offset += MAX_FILES_PER_PREPARE) {
          const slice = needsPrepare.slice(offset, offset + MAX_FILES_PER_PREPARE)
          const meta: ContributorPrepareUploadFileMeta[] = slice.map((r) => {
            const mime = mimeForJpegUpload(r.file)!
            return { fileName: r.file.name, mimeType: mime, sizeBytes: r.file.size }
          })
          let prep
          try {
            prep = await prepareContributorUploadFiles(currentBatchId!, meta)
          } catch (e) {
            if (e instanceof ContributorApiError && e.code === "UPLOAD_STORAGE_NOT_CONFIGURED") {
              setBlockingError(e.message || "Upload storage is not configured. Contact staff.")
              for (const s of slice) updateTracked(s.key, { status: "failed", errorMessage: "Storage not configured" })
              setPhase("idle")
              return
            }
            throw e
          }
          if (prep.items.length !== slice.length) throw new Error("Prepare response size mismatch.")

          for (let i = 0; i < slice.length; i += 1) {
            const instruction = prep.items[i]!
            const row = slice[i]!
            if (instruction.uploadMethod === "NOT_CONFIGURED") {
              setBlockingError("Upload storage is not configured. Contact staff.")
              for (const s of slice) updateTracked(s.key, { status: "failed", errorMessage: "Upload not configured" })
              setPhase("idle")
              return
            }
            updateTracked(row.key, { itemId: instruction.itemId, instruction, status: "ready", uploadProgress: null })
            uploadTasks.push({ key: row.key, instruction, file: row.file })
          }
        }
      }

      for (const r of alreadyPrepared) {
        if (r.instruction?.uploadMethod === "NOT_CONFIGURED") {
          updateTracked(r.key, { status: "failed", errorMessage: "Upload not configured" })
          continue
        }
        if (r.instruction && r.file) uploadTasks.push({ key: r.key, instruction: r.instruction, file: r.file })
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
          const mime = instruction.headers["content-type"] as "image/jpeg"
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
              errorMessage: `Upload failed (HTTP ${putRes.status}).`,
            })
            continue
          }
          updateTracked(key, { status: "finalizing", uploadProgress: null })
          try {
            const doneRes = await completeContributorUploadFile(currentBatchId!, instruction.itemId)
            updateTracked(key, {
              status: "done",
              uploadProgress: null,
              imageAssetId: doneRes.imageAssetId ?? null,
            })
            completed += 1
          } catch (e) {
            const msg = e instanceof ContributorApiError ? e.message : humanizeContributorNetworkError(e)
            updateTracked(key, { status: "failed", errorMessage: msg, uploadProgress: null })
          }
        }
      }

      const poolSize = Math.min(UPLOAD_CONCURRENCY, Math.max(1, uploadTasks.length))
      await Promise.all(Array.from({ length: poolSize }, () => uploadWorker()))

      if (completed >= 1) {
        markStepComplete(2)
        setCurrentStep(3)
      } else if (work.length > 0) {
        setBlockingError("No files finished successfully. Fix errors or retry failed uploads.")
      }
      setPhase("idle")
    } catch (e) {
      const msg = e instanceof ContributorApiError ? e.message : humanizeContributorNetworkError(e)
      setBlockingError(msg)
      setPhase("idle")
    }
  }, [batchId, eventId, markStepComplete, tracked, updateTracked])

  const saveMetadataItem = useCallback(
    async (key: string, draft: MetadataDraft) => {
      const row = trackedRef.current.find((r) => r.key === key)
      if (!row?.imageAssetId || !batchId) return

      try {
        const res = await patchContributorUploadAssetMetadata(batchId, row.imageAssetId, {
          expectedUpdatedAt: row.assetUpdatedAt ?? undefined,
          whoIsInPicture: normalizeWhoIsInPicture(draft.whoIsInPicture),
          caption: draft.caption.trim() || null,
          keywords: tagsToKeywords(keywordsToTags(draft.keywords)),
        })
        updateTracked(key, {
          assetUpdatedAt: res.updatedAt,
          saveState: "saved",
          saveHint: null,
        })
      } catch (e) {
        if (e instanceof ContributorApiError && e.code === "METADATA_CONFLICT" && e.detail) {
          const d = e.detail as {
            whoIsInPicture?: string | null
            caption?: string | null
            keywords?: string | null
            updatedAt?: string
          }
          updateTracked(key, {
            whoIsInPicture: d.whoIsInPicture ?? "",
            caption: d.caption ?? "",
            keywords: d.keywords ?? "",
            assetUpdatedAt: d.updatedAt ?? row.assetUpdatedAt,
            saveState: "error",
            saveHint: "Updated elsewhere — form refreshed.",
          })
          throw new Error("Updated elsewhere — form refreshed.")
        }
        const message = e instanceof ContributorApiError ? e.message : "Save failed."
        updateTracked(key, { saveState: "error", saveHint: message })
        throw new Error(message)
      }
    },
    [batchId, updateTracked],
  )

  const submitBatch = useCallback(async () => {
    if (!batchId) return
    setSubmitError(null)
    const done = tracked.filter((t) => t.status === "done").length
    if (done < 1) {
      setSubmitError("Upload at least one image before submitting.")
      return
    }
    setSubmitting(true)
    try {
      await submitContributorUploadBatch(batchId)
      router.push(`/contributor/uploads/${batchId}`)
      router.refresh()
    } catch (e) {
      setSubmitError(e instanceof ContributorApiError ? e.message : humanizeContributorNetworkError(e))
    } finally {
      setSubmitting(false)
    }
  }, [batchId, router, tracked])

  const doneCount = tracked.filter((t) => t.status === "done").length
  const totalBytes = useMemo(() => tracked.reduce((sum, row) => sum + row.file.size, 0), [tracked])
  const fileStatuses = useMemo(() => tracked.map((t) => t.status), [tracked])
  const eventCreated = Boolean(eventId)

  const goToStep = useCallback(
    (step: number) => {
      if (phase === "running") return
      if (step === currentStep) return
      if (step < currentStep || completedSteps.has(step)) setCurrentStep(step as UploadWizardStep)
    },
    [completedSteps, currentStep, phase],
  )

  const rightLocked =
    (currentStep === 2 && (!eventCreated || tracked.length === 0)) ||
    (currentStep === 3 && doneCount < 1)

  const actionTitle =
    currentStep === 1 ? "Create event" : currentStep === 2 ? "Upload images" : "Submit batch"

  return (
    <div className="space-y-6">
      <ContributorUploadStepper
        steps={[...UPLOAD_STEPS]}
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={(step) => goToStep(step)}
      />

      {blockingError ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {blockingError}
        </div>
      ) : null}
      {submitError ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {submitError}
        </div>
      ) : null}

      {currentStep === 3 ? (
        <div className="space-y-8">
          <ContributorUploadStepMetadata active items={tracked} onSaveItem={saveMetadataItem} />
          <div
            className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
            data-upload-action
          >
            <h2 className="text-center text-base font-semibold text-foreground sm:text-lg">{actionTitle}</h2>
            <div className="mt-4 sm:mt-5">
              <Button
                type="button"
                className="h-11 w-full text-sm sm:h-12 sm:text-base"
                disabled={!batchId || doneCount < 1 || submitting}
                onClick={() => void submitBatch()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2  animate-spin" size={16} />
                    Submitting…
                  </>
                ) : (
                  "Submit batch"
                )}
              </Button>
            </div>
            <ContributorUploadStatusBar
              className="mt-4 sm:mt-5"
              fileCount={0}
              totalBytes={0}
              batchPhase={phase}
              fileStatuses={[]}
              batchStatus={batchId ? "OPEN" : null}
              readyImageCount={doneCount}
            />
          </div>
        </div>
      ) : (
      <ContributorUploadLayout
        rightLocked={rightLocked}
        left={
          <>
            {currentStep === 1 ? (
              <ContributorUploadStepEvent
                active
                eventCreated={eventCreated}
                batchEventName={batchEventName}
                categories={categories}
                contributors={contributors}
                isPortalAdmin={isPortalAdmin}
                session={initialSession}
                newEventName={newEventName}
                newCategoryId={newCategoryId}
                newEventDate={newEventDate}
                targetContributorId={targetContributorId}
                createBusy={createBusy}
                createErr={createErr}
                onNewEventNameChange={setNewEventName}
                onNewCategoryIdChange={setNewCategoryId}
                onNewEventDateChange={setNewEventDate}
                onTargetContributorIdChange={setTargetContributorId}
                onChangeEvent={() => {
                  setEventId("")
                  setBatchEventName("")
                  setCompletedSteps((prev) => {
                    const next = new Set(prev)
                    next.delete(1)
                    next.delete(2)
                    next.delete(3)
                    return next
                  })
                  setCurrentStep(1)
                }}
              />
            ) : null}
            {currentStep === 2 ? (
              <ContributorUploadStepFiles
                active
                tracked={tracked}
                rejectedFiles={rejectedFiles}
                phase={phase}
                onFilesPicked={onFilesPicked}
                onRemoveFile={removeFile}
                onClearAll={clearAllFiles}
                onRetryFailed={retryFailed}
              />
            ) : null}
          </>
        }
        right={
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-foreground sm:text-lg">{actionTitle}</h2>
            <div className="mt-4 sm:mt-5">
              {currentStep === 1 ? (
                <Button
                  type="button"
                  className="h-11 w-full text-sm sm:h-12 sm:text-base"
                  disabled={createBusy || eventCreated || !categories.length}
                  onClick={() => void handleCreateEvent()}
                >
                  {createBusy ? (
                    <>
                      <Loader2 className="mr-2  animate-spin" size={16} />
                      Creating…
                    </>
                  ) : eventCreated ? (
                    "Event ready"
                  ) : (
                    "Create event"
                  )}
                </Button>
              ) : null}
              {currentStep === 2 ? (
                <Button
                  type="button"
                  className="h-11 w-full text-sm sm:h-12 sm:text-base"
                  disabled={phase === "running" || !eventId || tracked.length === 0}
                  onClick={() => void runUpload()}
                >
                  {phase === "running" ? (
                    <>
                      <Loader2 className="mr-2  animate-spin" size={16} />
                      Uploading…
                    </>
                  ) : (
                    "Start upload"
                  )}
                </Button>
              ) : null}
            </div>
            {currentStep !== 1 ? (
              <ContributorUploadStatusBar
                className="mt-4 sm:mt-5"
                fileCount={tracked.length}
                totalBytes={totalBytes}
                batchPhase={phase}
                fileStatuses={fileStatuses}
                batchStatus={batchId ? "OPEN" : null}
              />
            ) : null}
          </div>
        }
      />
      )}
    </div>
  )
}
