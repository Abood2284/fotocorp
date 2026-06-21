"use client"

import { Loader2 } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  MAX_FILES_PER_PREPARE,
  UPLOAD_CONCURRENCY,
  UPLOAD_STEPS,
  type TrackedFile,
  type UploadBatchAssetType,
  type UploadWizardStep,
} from "@/components/contributor/contributor-upload-types"
import { ContributorUploadStepAssetType } from "@/components/contributor/upload/contributor-upload-step-asset-type"
import { CaricatureUploadWizardPanel } from "@/components/contributor/upload/caricature-upload-wizard-panel"
import { ContributorUploadStepEvent } from "@/components/contributor/upload/contributor-upload-step-event"
import { ContributorUploadStepFiles } from "@/components/contributor/upload/contributor-upload-step-files"
import { ContributorUploadStepMetadata } from "@/components/contributor/upload/contributor-upload-step-metadata"
import { ContributorUploadLayout } from "@/components/contributor/upload/contributor-upload-layout"
import { ContributorUploadStatusBar } from "@/components/contributor/upload/contributor-upload-status-bar"
import { ContributorUploadStepper } from "@/components/contributor/upload/contributor-upload-stepper"
import { mimeForJpegUpload, validateJpegFiles, yieldToBrowserForPaint } from "@/components/contributor/upload/contributor-upload-utils"
import {
  completeContributorUploadFile,
  createContributorEvent,
  createContributorUploadBatch,
  ContributorApiError,
  getContributorAssetCategories,
  getContributorPortalContributors,
  getContributorUploadBatch,
  humanizeContributorNetworkError,
  patchContributorUploadAssetMetadata,
  prepareContributorUploadFiles,
  putContributorFileToSignedUrl,
  submitContributorUploadBatch,
  getContributorCaricatureCategories,
  createContributorCaricatureAsset,
  updateContributorCaricatureAsset,
  type ContributorAuthResponse,
  type ContributorAssetCategoryDto,
  type ContributorPortalContributorDto,
  type ContributorPrepareUploadFileMeta,
  type ContributorPrepareUploadItemInstruction,
} from "@/lib/api/contributor-api"
import type { MetadataImportSummary } from "@/lib/contributor-upload-metadata-import"
import { useUploadWizardMetadata } from "@/lib/use-upload-wizard-metadata"
import { useToastNotify } from "@/components/staff/shared/toast"
import {
  buildResumeStateFromBatchDetail,
  clearUploadWizardDraft,
  createTrackedFileFromLocal,
  getTrackedSizeBytes,
  persistBatchIdInBrowserUrl,
  readUploadWizardDraft,
  toUploadBatchDetailLike,
  writeUploadWizardDraft,
} from "@/lib/upload-wizard-resume"
import { Button } from "@/components/ui/button"
import { isCaricatureUpload, validateCaricatureUploadFile } from "@/lib/caricatures/caricature-upload-metadata"
import type { CaricatureAssetRecord, CaricatureCategoryOption } from "@/lib/caricatures/caricature-upload-metadata"
import { uploadCaricatureOriginalViaContributorApi } from "@/lib/caricatures/caricature-original-upload-client"
import {
  caricatureUploadActionTitle,
  editorialUploadActionTitle,
  uploadStepsForAssetType,
  uploadWizardAssetTypeHint,
} from "@/lib/upload-wizard-caricature"

function portalRoleOf(session: ContributorAuthResponse) {
  return session.account.portalRole ?? "STANDARD"
}

export function ContributorUploadFlow({ initialSession }: { initialSession: ContributorAuthResponse }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const resumeBatchId = searchParams.get("batchId")
  const { toast } = useToastNotify()
  const [currentStep, setCurrentStep] = useState<UploadWizardStep>(1)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => new Set())
  const [batchAssetType, setBatchAssetType] = useState<UploadBatchAssetType>("IMAGE")

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
  const [metadataImportSummary, setMetadataImportSummary] = useState<MetadataImportSummary | null>(null)
  const [metadataImportError, setMetadataImportError] = useState<string | null>(null)
  const [metadataImportBusy, setMetadataImportBusy] = useState(false)
  const [resuming, setResuming] = useState(Boolean(resumeBatchId))
  const [caricatureAssetId, setCaricatureAssetId] = useState<string | null>(null)
  const [caricatureAsset, setCaricatureAsset] = useState<CaricatureAssetRecord | null>(null)
  const [caricatureCategories, setCaricatureCategories] = useState<CaricatureCategoryOption[]>([])
  const [caricatureUploadBusy, setCaricatureUploadBusy] = useState(false)
  const [caricatureUploadProgress, setCaricatureUploadProgress] = useState<number | null>(null)

  const isCaricature = isCaricatureUpload(batchAssetType)
  const wizardSteps = useMemo(() => [...uploadStepsForAssetType(batchAssetType)], [batchAssetType])

  const trackedRef = useRef(tracked)
  trackedRef.current = tracked
  const resumeAttemptedRef = useRef(false)
  const initialResumeBatchIdRef = useRef(resumeBatchId)
  const isPortalAdmin = portalRoleOf(initialSession) === "PORTAL_ADMIN"

  useEffect(() => {
    void getContributorAssetCategories()
      .then((r) => setCategories(r.categories))
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    if (!isPortalAdmin) return
    void getContributorPortalContributors({ limit: 200 })
      .then((r) => setContributors(r.contributors))
      .catch(() => setContributors([]))
  }, [isPortalAdmin])

  useEffect(() => {
    if (!isCaricature) return
    void getContributorCaricatureCategories()
      .then((response) => setCaricatureCategories(response.categories))
      .catch(() => setCaricatureCategories([]))
  }, [isCaricature])

  useEffect(() => {
    if (resumeAttemptedRef.current) return

    const batchToResume =
      initialResumeBatchIdRef.current ?? readUploadWizardDraft("contributor")?.batchId ?? null
    if (!batchToResume) return

    resumeAttemptedRef.current = true
    if (!initialResumeBatchIdRef.current) {
      persistBatchIdInBrowserUrl(pathname, batchToResume)
    }
    setResuming(true)

    void getContributorUploadBatch(batchToResume)
      .then((detail) => {
        if (detail.batch.status !== "OPEN") {
          router.replace(`/contributor/uploads/${batchToResume}`)
          return
        }
        const resume = buildResumeStateFromBatchDetail(toUploadBatchDetailLike(detail), "contributor")
        setBatchId(resume.batchId)
        setEventId(resume.eventId)
        setBatchEventName(resume.batchEventName)
        setBatchAssetType(resume.batchAssetType)
        if (resume.targetContributorId) setTargetContributorId(resume.targetContributorId)
        setTracked(resume.tracked)
        setCurrentStep(resume.currentStep)
        setCompletedSteps(resume.completedSteps)
        setBlockingError(null)
      })
      .catch((e) => {
        const message = e instanceof ContributorApiError ? e.message : "Could not resume upload batch."
        setBlockingError(message)
      })
      .finally(() => {
        setResuming(false)
      })
  }, [pathname, router])

  useEffect(() => {
    if (resumeAttemptedRef.current) return
    const draft = readUploadWizardDraft("contributor")
    if (!draft || draft.batchId) return
    setCurrentStep(draft.currentStep)
    setCompletedSteps(new Set(draft.completedSteps))
    setBatchAssetType(draft.batchAssetType ?? "IMAGE")
    setEventId(draft.eventId)
    setBatchEventName(draft.batchEventName)
    setTargetContributorId(draft.targetContributorId || initialSession.contributor.id)
    setNewEventName(draft.newEventName)
    setNewCategoryId(draft.newCategoryId)
    setNewEventDate(draft.newEventDate)
    if (draft.batchId) setBatchId(draft.batchId)
    if (draft.caricatureAssetId) setCaricatureAssetId(draft.caricatureAssetId)
  }, [initialSession.contributor.id])

  useEffect(() => {
    if (!batchId) return
    persistBatchIdInBrowserUrl(pathname, batchId)
  }, [batchId, pathname])

  useEffect(() => {
    if (resuming) return
    const timer = window.setTimeout(() => {
      writeUploadWizardDraft("contributor", {
        version: 1,
        currentStep,
        completedSteps: [...completedSteps],
        batchAssetType,
        eventId,
        batchEventName,
        batchId,
        caricatureAssetId,
        targetContributorId,
        newEventName,
        newCategoryId,
        newEventDate,
        updatedAt: Date.now(),
      })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [
    batchAssetType,
    batchEventName,
    batchId,
    caricatureAssetId,
    completedSteps,
    currentStep,
    eventId,
    newCategoryId,
    newEventDate,
    newEventName,
    resuming,
    targetContributorId,
  ])

  useEffect(() => {
    return () => {
      for (const row of tracked) {
        if (row.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(row.previewUrl)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup on unmount only
  }, [])

  const updateTracked = useCallback((key: string, patch: Partial<TrackedFile>) => {
    setTracked((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }, [])

  /** Bulk-update multiple tracked files in a single state transition. */
  const { bulkUpdateTracked, saveMetadataItem, handleMetadataImportFile } = useUploadWizardMetadata({
    batchId,
    trackedRef,
    updateTracked,
    setTracked,
    patchMetadata: patchContributorUploadAssetMetadata,
    isConflictError: (e) => e instanceof ContributorApiError && e.code === "METADATA_CONFLICT",
    getConflictDetail: (e) =>
      e instanceof ContributorApiError && e.code === "METADATA_CONFLICT" && e.detail
        ? (e.detail as {
            whoIsInPicture?: string | null
            caption?: string | null
            keywords?: string | null
            updatedAt?: string
          })
        : undefined,
    getErrorMessage: (e) => (e instanceof ContributorApiError ? e.message : "Save failed."),
    toast,
    setMetadataImportSummary,
    setMetadataImportError,
    setMetadataImportBusy,
  })

  const markStepComplete = useCallback((step: number) => {
    setCompletedSteps((prev) => new Set(prev).add(step))
  }, [])

  const onCaricatureFilePicked = useCallback((list: FileList | null) => {
    if (!list?.length) return
    const file = list[0]!
    const validation = validateCaricatureUploadFile(file)
    if (!validation.ok) {
      setRejectedFiles([{ file, reason: validation.reason }])
      return
    }
    setRejectedFiles([])
    setTracked((prev) => {
      const existing = prev[0]
      if (existing?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(existing.previewUrl)
      return [createTrackedFileFromLocal(file, 0)]
    })
    setBlockingError(null)
  }, [])

  const onCaricatureRemoveFile = useCallback(() => {
    setTracked((prev) => {
      const row = prev[0]
      if (row?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(row.previewUrl)
      return []
    })
    setRejectedFiles([])
  }, [])

  const handleCaricatureSetupContinue = useCallback(() => {
    markStepComplete(2)
    setCurrentStep(3)
  }, [markStepComplete])

  const caricatureDefaultCredit = useMemo(() => {
    if (isPortalAdmin) {
      const contributor = contributors.find((entry) => entry.id === targetContributorId)
      return contributor?.displayName?.trim() || initialSession.contributor.displayName.trim() || "Contributor upload"
    }
    return initialSession.contributor.displayName.trim() || "Contributor upload"
  }, [contributors, initialSession.contributor.displayName, isPortalAdmin, targetContributorId])

  const handleCaricatureUploadContinue = useCallback(async () => {
    const row = tracked[0]
    if (!row?.file || caricatureUploadBusy) return
    setBlockingError(null)
    setCaricatureUploadBusy(true)
    setCaricatureUploadProgress(0)
    try {
      const result = await uploadCaricatureOriginalViaContributorApi({
        file: row.file,
        credit: caricatureDefaultCredit,
        existingAssetId: caricatureAssetId,
        onProgress: setCaricatureUploadProgress,
      })
      setCaricatureAssetId(result.assetId)
      setCaricatureAsset(result.asset)
      markStepComplete(3)
      setCurrentStep(4)
    } catch (e) {
      const msg = e instanceof ContributorApiError ? e.message : humanizeContributorNetworkError(e)
      setBlockingError(msg)
    } finally {
      setCaricatureUploadBusy(false)
    }
  }, [tracked, caricatureUploadBusy, caricatureDefaultCredit, caricatureAssetId, markStepComplete])

  const saveCaricatureMetadata = useCallback(
    async (payload: Parameters<typeof createContributorCaricatureAsset>[0]) => {
      setSubmitError(null)
      setSubmitting(true)
      try {
        if (caricatureAssetId) {
          const updated = await updateContributorCaricatureAsset(caricatureAssetId, payload)
          setCaricatureAsset(updated)
        } else {
          const created = await createContributorCaricatureAsset(payload)
          setCaricatureAssetId(created.id)
          setCaricatureAsset(created)
        }
        clearUploadWizardDraft("contributor")
        router.push("/contributor/uploads")
        router.refresh()
      } catch (e) {
        const msg = e instanceof ContributorApiError ? e.message : humanizeContributorNetworkError(e)
        setSubmitError(msg)
        throw new Error(msg)
      } finally {
        setSubmitting(false)
      }
    },
    [caricatureAssetId, router],
  )

  const onFilesPicked = useCallback((list: FileList | null) => {
    if (!list?.length) return
    const incoming = Array.from(list)
    const { accepted, rejected } = validateJpegFiles(incoming)
    if (rejected.length) setRejectedFiles((prev) => [...prev, ...rejected])
    if (!accepted.length) return

    const next = accepted.map((file, i) => createTrackedFileFromLocal(file, i))
    setTracked((prev) => [...prev, ...next])
    setBlockingError(null)
  }, [])

  const removeFile = useCallback(
    (key: string) => {
      if (phase === "running") return
      setTracked((prev) => {
        const row = prev.find((r) => r.key === key)
        if (row?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(row.previewUrl)
        return prev.filter((r) => r.key !== key)
      })
    },
    [phase],
  )

  const clearAllFiles = useCallback(() => {
    if (phase === "running") return
    setTracked((prev) => {
      for (const row of prev) {
        if (row.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(row.previewUrl)
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

  const handleAssetTypeSelect = useCallback(
    (assetType: UploadBatchAssetType) => {
      if (batchId) return
      setBatchAssetType(assetType)
      markStepComplete(1)
      setCurrentStep(2)
    },
    [batchId, markStepComplete],
  )

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
      markStepComplete(2)
      setCurrentStep(3)
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
    const localTracked = tracked.filter((row): row is TrackedFile & { file: File } => row.file !== null)
    const files = localTracked.map((row) => row.file)
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
          assetType: batchAssetType,
        })
        currentBatchId = created.batch.id
        resumeAttemptedRef.current = true
        setBatchId(currentBatchId)
        persistBatchIdInBrowserUrl(pathname, currentBatchId)
      }

      const work = localTracked.filter(
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
            return { fileName: r.fileName, mimeType: mime, sizeBytes: r.sizeBytes }
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
        markStepComplete(3)
        setCurrentStep(4)
      } else if (work.length > 0) {
        setBlockingError("No files finished successfully. Fix errors or retry failed uploads.")
      }
      setPhase("idle")
    } catch (e) {
      const msg = e instanceof ContributorApiError ? e.message : humanizeContributorNetworkError(e)
      setBlockingError(msg)
      setPhase("idle")
    }
  }, [batchAssetType, batchId, eventId, markStepComplete, pathname, tracked, updateTracked])

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
      await yieldToBrowserForPaint()
      await submitContributorUploadBatch(batchId)
      clearUploadWizardDraft("contributor")
      router.push(`/contributor/uploads/${batchId}`)
      router.refresh()
    } catch (e) {
      setSubmitError(e instanceof ContributorApiError ? e.message : humanizeContributorNetworkError(e))
      setSubmitting(false)
    }
  }, [batchId, router, tracked])

  const doneCount = tracked.filter((t) => t.status === "done").length
  const totalBytes = useMemo(() => tracked.reduce((sum, row) => sum + getTrackedSizeBytes(row), 0), [tracked])
  const fileStatuses = useMemo(() => tracked.map((t) => t.status), [tracked])
  const eventCreated = Boolean(eventId)

  const goToStep = useCallback(
    (step: number) => {
      if (phase === "running") return
      if (step === currentStep) return
      if (batchId && step === 1) return
      if (step < currentStep || completedSteps.has(step)) setCurrentStep(step as UploadWizardStep)
    },
    [batchId, completedSteps, currentStep, phase],
  )

  const rightLocked = isCaricature
    ? currentStep === 3 && tracked.length === 0
    : (currentStep === 3 && (!eventCreated || tracked.length === 0)) ||
      (currentStep === 4 && doneCount < 1)

  const actionTitle = isCaricature
    ? caricatureUploadActionTitle(currentStep)
    : editorialUploadActionTitle(currentStep)

  return (
    <div className="space-y-6">
      <ContributorUploadStepper
        steps={wizardSteps}
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

      {resuming ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-8 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" size={18} />
          Loading upload batch…
        </div>
      ) : null}

      {!resuming && currentStep === 4 && !isCaricature ? (
        <ContributorUploadStepMetadata
          active
          eventTitle={batchEventName}
          items={tracked}
          onSaveItem={saveMetadataItem}
          onBulkUpdate={bulkUpdateTracked}
          metadataImportSummary={metadataImportSummary}
          metadataImportError={metadataImportError}
          metadataImportBusy={metadataImportBusy}
          onImportMetadataFile={handleMetadataImportFile}
          onSubmitBatch={() => void submitBatch()}
          submitDisabled={!batchId || doneCount < 1 || metadataImportBusy || resuming}
          submitBusy={submitting}
          submitError={submitError}
          onDismissSubmitError={() => setSubmitError(null)}
        />
      ) : !resuming && isCaricature && currentStep > 1 ? (
        <CaricatureUploadWizardPanel
          currentStep={currentStep}
          staffMode={false}
          isPortalAdmin={isPortalAdmin}
          session={initialSession}
          contributors={contributors}
          targetContributorId={targetContributorId}
          onTargetContributorIdChange={setTargetContributorId}
          tracked={tracked}
          rejectedFiles={rejectedFiles}
          uploadBusy={caricatureUploadBusy}
          uploadProgress={caricatureUploadProgress}
          onFilePicked={onCaricatureFilePicked}
          onRemoveFile={onCaricatureRemoveFile}
          categories={caricatureCategories}
          caricatureAsset={caricatureAsset}
          defaultCredit={caricatureDefaultCredit}
          hasOriginalFile={Boolean(caricatureAsset?.hasOriginalFile)}
          onSetupContinue={handleCaricatureSetupContinue}
          onUploadContinue={handleCaricatureUploadContinue}
          onSaveMetadata={saveCaricatureMetadata}
          submitBusy={submitting}
          submitError={submitError}
          onDismissSubmitError={() => setSubmitError(null)}
        />
      ) : !resuming && currentStep === 1 ? (
        <ContributorUploadStepAssetType
          active
          selectedType={batchAssetType}
          hint={uploadWizardAssetTypeHint(batchAssetType)}
          onSelect={handleAssetTypeSelect}
        />
      ) : !resuming && !isCaricature ? (
        <ContributorUploadLayout
        rightLocked={rightLocked}
        left={
          <>
            {currentStep === 2 ? (
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
                    next.delete(2)
                    next.delete(3)
                    next.delete(4)
                    return next
                  })
                  setCurrentStep(2)
                }}
              />
            ) : null}
            {currentStep === 3 ? (
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
              {currentStep === 2 ? (
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
              {currentStep === 3 ? (
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
            {currentStep !== 2 ? (
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
      ) : null}
    </div>
  )
}
