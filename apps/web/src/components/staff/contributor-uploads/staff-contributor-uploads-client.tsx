"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  HelpCircle,
  ImageOff,
  Loader2,
  Upload,
  X,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type {
  StaffContributorUploadDto,
  StaffContributorUploadsListResponse,
} from "@/lib/api/staff-contributor-uploads-api"
import type { AdminCatalogFilters } from "@/features/assets/admin-catalog-types"

interface StaffContributorUploadsClientProps {
  initialResponse: StaffContributorUploadsListResponse
  filters: AdminCatalogFilters | null
  currentParams: {
    status: "SUBMITTED" | "APPROVED" | "ACTIVE" | "all"
    eventId?: string
    contributorId?: string
    batchId?: string
    q?: string
    from?: string
    to?: string
    assetType?: "IMAGE" | "VIDEO" | "CARICATURE" | "all"
    sort?: "submitted" | "contributor" | "event"
    order?: "asc" | "desc"
    limit: number
    offset: number
  }
}

export function StaffContributorUploadsClient({
  initialResponse,
  filters,
  currentParams,
}: StaffContributorUploadsClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [localPatch, setLocalPatch] = useState<Record<string, Partial<StaffContributorUploadDto>>>({})
  const [previewBust, setPreviewBust] = useState<Record<string, string>>({})
  const [statusMessage, setStatusMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null)
  const [panelSave, setPanelSave] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [panelSaveHint, setPanelSaveHint] = useState<string | null>(null)

  const [draftTitle, setDraftTitle] = useState("")
  const [draftCaption, setDraftCaption] = useState("")
  const [draftKeywordTags, setDraftKeywordTags] = useState<string[]>([])
  const [draftKeywordInput, setDraftKeywordInput] = useState("")

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveGenRef = useRef(0)
  const replaceInputRef = useRef<HTMLInputElement | null>(null)

  const uploads = useMemo(
    () => initialResponse.uploads.map((u) => ({ ...u, ...localPatch[u.imageAssetId] })),
    [initialResponse.uploads, localPatch],
  )

  const uploadsRef = useRef(uploads)
  uploadsRef.current = uploads

  const selectedUpload = useMemo(
    () => (selectedId ? uploads.find((u) => u.imageAssetId === selectedId) ?? null : null),
    [uploads, selectedId],
  )

  useEffect(() => {
    if (!selectedUpload) {
      setDraftTitle("")
      setDraftCaption("")
      setDraftKeywordTags([])
      setDraftKeywordInput("")
      setPanelSave("idle")
      setPanelSaveHint(null)
      return
    }
    setDraftTitle(selectedUpload.title ?? "")
    setDraftCaption(selectedUpload.caption ?? "")
    setDraftKeywordTags(keywordsToTags(selectedUpload.keywords))
    setDraftKeywordInput("")
    setPanelSave("idle")
    setPanelSaveHint(null)
  }, [selectedId])

  const effectiveSort = currentParams.sort ?? "submitted"
  const effectiveOrder = currentParams.order ?? "desc"

  function clearSelection() {
    setSelected({})
  }

  function toggleSelectAll(checked: boolean) {
    if (!checked) {
      clearSelection()
      return
    }
    const next: Record<string, boolean> = {}
    for (const upload of uploads) {
      if (upload.canApprove) next[upload.imageAssetId] = true
    }
    setSelected(next)
  }

  function toggleSelect(imageAssetId: string, canApprove: boolean) {
    if (!canApprove) return
    setSelected((prev) => {
      const next = { ...prev }
      if (next[imageAssetId]) delete next[imageAssetId]
      else next[imageAssetId] = true
      return next
    })
  }

  async function approveIds(ids: string[]) {
    if (ids.length === 0) return
    setIsApproving(true)
    setStatusMessage(null)
    try {
      const response = await fetch("/api/staff/contributor-uploads/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageAssetIds: ids }),
        cache: "no-store",
      })

      if (!response.ok) {
        const errorBody = await safeJson(response)
        const message = errorBody?.error?.message ?? "Approve failed."
        setStatusMessage({ kind: "error", text: message })
        return
      }

      const body = (await response.json()) as {
        ok: true
        approvedCount: number
        publishJobId?: string | null
        items?: Array<{ imageAssetId: string; fotokey: string; status: "APPROVED" }>
        skipped: Array<{ imageAssetId: string; reason: string }>
      }
      const approved = body.approvedCount
      const skipped = body.skipped.length
      const skipReasonSummary = summarizeSkipReasons(body.skipped)
      const queueNote =
        approved > 0
          ? "Images approved and queued for derivative generation. They will go live after required previews are ready."
          : ""
      const skippedNote = skipped > 0 ? ` ${skipped} skipped.` : ""
      const skipDebug =
        approved === 0 && skipped > 0 && skipReasonSummary
          ? ` ${skipReasonSummary}`
          : ""
      const message =
        approved > 0
          ? `${queueNote}${skippedNote}`
          : skipped > 0
            ? `0 approved.${skippedNote}${skipDebug}`
            : "Nothing to approve."
      setStatusMessage({ kind: approved > 0 ? "ok" : "error", text: message })
      clearSelection()
      setSelectedId(null)
      startTransition(() => router.refresh())
    } catch {
      setStatusMessage({ kind: "error", text: "Approve request failed." })
    } finally {
      setIsApproving(false)
    }
  }

  async function rejectIds(ids: string[]) {
    if (ids.length === 0) return
    setIsRejecting(true)
    setStatusMessage(null)
    try {
      const response = await fetch("/api/staff/contributor-uploads/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageAssetIds: ids }),
        cache: "no-store",
      })
      if (!response.ok) {
        const errorBody = await safeJson(response)
        setStatusMessage({ kind: "error", text: errorBody?.error?.message ?? "Reject failed." })
        return
      }
      const body = (await response.json()) as {
        ok: true
        rejectedCount: number
        skipped: Array<{ imageAssetId: string; reason: string }>
      }
      const skipped = body.skipped.length
      const skippedNote = skipped > 0 ? ` ${skipped} skipped.` : ""
      setStatusMessage({
        kind: body.rejectedCount > 0 ? "ok" : "error",
        text:
          body.rejectedCount > 0
            ? `${body.rejectedCount} rejected.${skippedNote}`
            : `Nothing rejected.${skippedNote}`,
      })
      clearSelection()
      setSelectedId(null)
      startTransition(() => router.refresh())
    } catch {
      setStatusMessage({ kind: "error", text: "Reject request failed." })
    } finally {
      setIsRejecting(false)
    }
  }

  function buildQuery(overrides: Partial<StaffContributorUploadsClientProps["currentParams"]> = {}) {
    const next = new URLSearchParams()
    const merged = { ...currentParams, ...overrides }
    if (merged.status && merged.status !== "SUBMITTED") next.set("status", merged.status)
    if (merged.eventId) next.set("eventId", merged.eventId)
    if (merged.contributorId) next.set("contributorId", merged.contributorId)
    if (merged.batchId) next.set("batchId", merged.batchId)
    if (merged.q) next.set("q", merged.q)
    if (merged.from) next.set("from", merged.from)
    if (merged.to) next.set("to", merged.to)
    if (merged.assetType && merged.assetType !== "all") next.set("assetType", merged.assetType)
    if (merged.sort) next.set("sort", merged.sort)
    if (merged.order) next.set("order", merged.order)
    if (merged.limit && merged.limit !== 24) next.set("limit", String(merged.limit))
    if (merged.offset && merged.offset > 0) next.set("offset", String(merged.offset))
    return next.toString()
  }

  function hrefForSort(column: "submitted" | "contributor" | "event") {
    const isActive = effectiveSort === column
    const nextOrder = isActive && effectiveOrder === "desc" ? "asc" : "desc"
    return `/staff/contributor-uploads?${buildQuery({ sort: column, order: nextOrder, offset: 0 })}`
  }

  const saveMetadata = useCallback(async () => {
    if (!selectedUpload?.canApprove) return
    const expectedUpdatedAt = selectedUpload.updatedAt
    const title = draftTitle.trim() || null
    const caption = draftCaption.trim() || null
    const keywords = draftKeywordTags.length > 0 ? draftKeywordTags : null

    const baselineTitle = selectedUpload.title ?? ""
    const baselineCaption = selectedUpload.caption ?? ""
    const baselineKw = keywordsToTags(selectedUpload.keywords).join("\u0000")

    const dirty =
      title !== (selectedUpload.title ?? null) ||
      caption !== (selectedUpload.caption ?? null) ||
      draftKeywordTags.join("\u0000") !== baselineKw
    if (!dirty) {
      setPanelSave("idle")
      return
    }

    const gen = ++saveGenRef.current
    setPanelSave("saving")
    setPanelSaveHint(null)
    try {
      const response = await fetch(
        `/api/staff/contributor-uploads/${encodeURIComponent(selectedUpload.imageAssetId)}/metadata`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedUpdatedAt,
            title,
            caption,
            keywords,
          }),
          cache: "no-store",
        },
      )
      const body = (await response.json().catch(() => null)) as ConflictPatchBody | null
      if (gen !== saveGenRef.current) return

      if (response.status === 409 && body && "error" in body && body.error?.code === "METADATA_CONFLICT") {
        const d = body.error.detail as
          | { title: string | null; caption: string | null; keywords: string | null; updatedAt: string }
          | undefined
        if (d) {
          setLocalPatch((prev) => ({
            ...prev,
            [selectedUpload.imageAssetId]: {
              ...prev[selectedUpload.imageAssetId],
              title: d.title,
              caption: d.caption,
              keywords: d.keywords,
              updatedAt: d.updatedAt,
            },
          }))
          setDraftTitle(d.title ?? "")
          setDraftCaption(d.caption ?? "")
          setDraftKeywordTags(keywordsToTags(d.keywords))
        }
        setPanelSave("error")
        setPanelSaveHint("Another editor saved first — form was refreshed from the server.")
        return
      }

      if (!response.ok) {
        setPanelSave("error")
        setPanelSaveHint(
          body && typeof body === "object" && "error" in body
            ? (body as { error?: { message?: string } }).error?.message ?? "Save failed."
            : "Save failed.",
        )
        return
      }

      const ok = body as {
        ok: true
        title: string | null
        caption: string | null
        keywords: string | null
        updatedAt: string
      }
      setLocalPatch((prev) => ({
        ...prev,
        [selectedUpload.imageAssetId]: {
          ...prev[selectedUpload.imageAssetId],
          title: ok.title,
          caption: ok.caption,
          keywords: ok.keywords,
          updatedAt: ok.updatedAt,
        },
      }))
      setPanelSave("saved")
      setPanelSaveHint("Saved")
      setTimeout(() => {
        setPanelSave((s) => (s === "saved" ? "idle" : s))
        setPanelSaveHint(null)
      }, 2000)
    } catch {
      if (gen !== saveGenRef.current) return
      setPanelSave("error")
      setPanelSaveHint("Save request failed.")
    }
  }, [
    draftCaption,
    draftKeywordTags,
    draftTitle,
    selectedUpload?.canApprove,
    selectedUpload?.caption,
    selectedUpload?.imageAssetId,
    selectedUpload?.keywords,
    selectedUpload?.title,
    selectedUpload?.updatedAt,
  ])

  useEffect(() => {
    if (!selectedUpload?.canApprove) return
    const baselineTitle = selectedUpload.title ?? ""
    const baselineCaption = selectedUpload.caption ?? ""
    const baselineKw = keywordsToTags(selectedUpload.keywords).join("\u0000")
    const dirty =
      draftTitle !== baselineTitle ||
      draftCaption !== baselineCaption ||
      draftKeywordTags.join("\u0000") !== baselineKw
    if (!dirty) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void saveMetadata()
    }, 520)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [
    draftCaption,
    draftKeywordTags,
    draftTitle,
    saveMetadata,
    selectedUpload?.canApprove,
    selectedUpload?.caption,
    selectedUpload?.keywords,
    selectedUpload?.title,
  ])

  const approvableSelected = useMemo(
    () => uploads.filter((upload) => selected[upload.imageAssetId] && upload.canApprove),
    [uploads, selected],
  )

  const visibleSelectableCount = uploads.filter((upload) => upload.canApprove).length
  const allSelectableSelected = visibleSelectableCount > 0 && approvableSelected.length === visibleSelectableCount

  const pagination = initialResponse.pagination
  const total = pagination.total
  const nextOffset = pagination.offset + pagination.limit
  const prevOffset = Math.max(0, pagination.offset - pagination.limit)
  const hasMore = nextOffset < total
  const hasPrev = pagination.offset > 0

  function moveSelection(delta: number) {
    const list = uploadsRef.current
    if (list.length === 0) return
    setSelectedId((prev) => {
      const idx = prev ? list.findIndex((u) => u.imageAssetId === prev) : -1
      const start = idx >= 0 ? idx : 0
      const next = Math.min(list.length - 1, Math.max(0, start + delta))
      return list[next]!.imageAssetId
    })
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t?.closest("input, textarea, select, [contenteditable=true]")) return
      if (e.key === "ArrowDown") {
        e.preventDefault()
        moveSelection(1)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        moveSelection(-1)
      } else if (e.key === "Enter" && selectedId) {
        e.preventDefault()
        document.getElementById("contributor-upload-detail-panel")?.focus()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectedId])

  const completeness =
    selectedUpload &&
    (() => {
      const parts = [
        (draftTitle.trim().length > 0 ? 1 : 0) as number,
        (draftCaption.trim().length > 0 ? 1 : 0) as number,
        (draftKeywordTags.length > 0 ? 1 : 0) as number,
      ]
      const sum = parts.reduce((a, b) => a + b, 0)
      return Math.round((sum / 3) * 100)
    })()

  async function onReplaceFilePick(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file || !selectedUpload?.canApprove) return
    setStatusMessage(null)
    try {
      const presignRes = await fetch(
        `/api/staff/contributor-uploads/${encodeURIComponent(selectedUpload.imageAssetId)}/replace-presign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: file.type || "application/octet-stream" }),
          cache: "no-store",
        },
      )
      const presignBody = (await presignRes.json().catch(() => null)) as
        | { error?: { message?: string }; uploadUrl?: string }
        | null
      if (!presignRes.ok) {
        setStatusMessage({
          kind: "error",
          text: presignBody?.error?.message ?? "Could not prepare upload URL.",
        })
        return
      }
      const { uploadUrl } = presignBody as { uploadUrl: string }
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      })
      if (!putRes.ok) {
        setStatusMessage({ kind: "error", text: "Upload to storage failed." })
        return
      }
      const completeRes = await fetch(
        `/api/staff/contributor-uploads/${encodeURIComponent(selectedUpload.imageAssetId)}/replace-complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedUpdatedAt: selectedUpload.updatedAt,
            mimeType: file.type || undefined,
            sizeBytes: file.size,
            originalFileName: file.name,
          }),
          cache: "no-store",
        },
      )
      const completeBody = (await completeRes.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null
      if (completeRes.status === 409) {
        setStatusMessage({
          kind: "error",
          text: completeBody?.error?.message ?? "Conflict while completing replace — refresh and retry.",
        })
        startTransition(() => router.refresh())
        return
      }
      if (!completeRes.ok) {
        setStatusMessage({
          kind: "error",
          text: completeBody?.error?.message ?? "Replace complete failed.",
        })
        return
      }
      const ok = completeBody as {
        ok: true
        originalFileName: string
        mimeType: string | null
        sizeBytes: number | null
        updatedAt: string
      }
      setLocalPatch((prev) => ({
        ...prev,
        [selectedUpload.imageAssetId]: {
          ...prev[selectedUpload.imageAssetId],
          originalFileName: ok.originalFileName,
          mimeType: ok.mimeType,
          sizeBytes: ok.sizeBytes,
          updatedAt: ok.updatedAt,
        },
      }))
      setPreviewBust((prev) => ({ ...prev, [selectedUpload.imageAssetId]: ok.updatedAt }))
      setStatusMessage({ kind: "ok", text: "File replaced. Preview updated." })
    } catch {
      setStatusMessage({ kind: "error", text: "Replace failed." })
    } finally {
      if (replaceInputRef.current) replaceInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-5 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="fc-heading-2 text-xl font-semibold tracking-tight">Contributor Uploads</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review submitted contributor assets before publishing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative inline-flex" title="Keyboard: Arrow keys move selection, Enter focuses detail">
            <HelpCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="sr-only">Arrow keys change row, Enter focuses the detail panel</span>
          </span>
          <Button
            type="button"
            variant="default"
            disabled={approvableSelected.length === 0 || isApproving || isPending}
            onClick={() => approveIds(approvableSelected.map((upload) => upload.imageAssetId))}
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {isApproving
              ? "Queueing…"
              : `Approve & Queue Publish (${approvableSelected.length})`}
          </Button>
        </div>
      </header>

      {statusMessage ? (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            statusMessage.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
          role="status"
        >
          {statusMessage.text}
        </div>
      ) : null}

      <FilterBar filters={filters} currentParams={currentParams} buildQuery={buildQuery} />

      <ActiveFilterChips currentParams={currentParams} buildQuery={buildQuery} />

      {uploads.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-6 py-16 text-center">
          <ImageOff className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 text-base font-semibold">No contributor uploads to review</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try changing filters or check that contributors have submitted batches.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="w-10 px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      aria-label="Select all approvable on this page"
                      checked={allSelectableSelected}
                      onChange={(event) => toggleSelectAll(event.target.checked)}
                    />
                  </th>
                  <Th>
                    <SortLink
                      label="Filename"
                      href={hrefForSort("submitted")}
                      active={effectiveSort === "submitted"}
                      order={effectiveOrder}
                    />
                  </Th>
                  <Th>
                    <SortLink
                      label="Contributor"
                      href={hrefForSort("contributor")}
                      active={effectiveSort === "contributor"}
                      order={effectiveOrder}
                    />
                  </Th>
                  <Th>
                    <SortLink
                      label="Event"
                      href={hrefForSort("event")}
                      active={effectiveSort === "event"}
                      order={effectiveOrder}
                    />
                  </Th>
                  <Th>Asset Type</Th>
                  <Th>Submitted</Th>
                  <Th>Fotokey</Th>
                  <Th>Status</Th>
                  <Th>Visibility</Th>
                  <Th className="text-right">Batch</Th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((upload) => {
                  const isChecked = Boolean(selected[upload.imageAssetId])
                  const isRowSelected = selectedId === upload.imageAssetId
                  return (
                    <tr
                      key={upload.imageAssetId}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(upload.imageAssetId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          setSelectedId(upload.imageAssetId)
                        }
                      }}
                      className={`cursor-pointer border-t border-border align-top outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring ${
                        isRowSelected ? "bg-muted/50" : ""
                      } ${isChecked ? "bg-accent-wash/30" : ""}`}
                    >
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${upload.originalFileName}`}
                          checked={isChecked}
                          disabled={!upload.canApprove}
                          onChange={() => toggleSelect(upload.imageAssetId, upload.canApprove)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium">{upload.originalFileName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {upload.mimeType ?? "—"} · {formatSize(upload.sizeBytes)}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        <p>{upload.contributor.displayName}</p>
                        {upload.contributor.legacyPhotographerId !== null ? (
                          <p className="text-xs text-muted-foreground">
                            Legacy ID #{upload.contributor.legacyPhotographerId}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <p>{upload.event?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(upload.event?.eventDate ?? null)}
                          {upload.event?.city ? ` · ${upload.event.city}` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {upload.assetType ?? "IMAGE"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {formatDateTime(upload.batch.submittedAt ?? upload.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {upload.fotokey ? (
                          <span className="font-mono text-foreground">{upload.fotokey}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone="neutral">{upload.status}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={upload.visibility === "PUBLIC" ? "ok" : "warn"}>{upload.visibility}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/staff/contributor-uploads/batches/${upload.batchId}`}
                          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {selectedUpload ? (
            <aside
              id="contributor-upload-detail-panel"
              tabIndex={-1}
              className="w-full shrink-0 border border-border bg-card lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:w-[min(100%,420px)] lg:overflow-y-auto lg:rounded-lg"
            >
              <div className="border-b border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{selectedUpload.originalFileName}</h3>
                    <p className="text-xs text-muted-foreground">
                      {selectedUpload.contributor.displayName}
                      {selectedUpload.event ? ` · ${selectedUpload.event.name}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Close detail panel"
                    onClick={() => setSelectedId(null)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a
                      href={`${getOriginalUrl(selectedUpload.imageAssetId)}?v=${encodeURIComponent(previewBust[selectedUpload.imageAssetId] ?? selectedUpload.updatedAt)}`}
                      download={selectedUpload.originalFileName}
                    >
                      <Download className="mr-1 h-3.5 w-3.5" />
                      Download
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!selectedUpload.canApprove}
                    onClick={() => replaceInputRef.current?.click()}
                  >
                    <Upload className="mr-1 h-3.5 w-3.5" />
                    Replace file
                  </Button>
                  <input
                    ref={replaceInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => void onReplaceFilePick(e.target.files)}
                  />
                </div>
              </div>

              <div className="border-b border-border bg-muted/30 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${getOriginalUrl(selectedUpload.imageAssetId)}?v=${encodeURIComponent(previewBust[selectedUpload.imageAssetId] ?? selectedUpload.updatedAt)}`}
                  alt=""
                  className="mx-auto max-h-[40vh] w-auto max-w-full rounded border border-border bg-background object-contain"
                />
              </div>

              <div className="space-y-4 p-3">
                {typeof completeness === "number" ? (
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Metadata completeness</span>
                      <span>{completeness}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-foreground/70 transition-all"
                        style={{ width: `${completeness}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {panelSave === "saving" ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving…
                    </>
                  ) : panelSave === "saved" ? (
                    <>Saved</>
                  ) : panelSave === "error" ? (
                    <span className="text-rose-700">{panelSaveHint ?? "Error"}</span>
                  ) : panelSaveHint ? (
                    <span>{panelSaveHint}</span>
                  ) : null}
                </div>

                <label className="block text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FieldDot ok={draftTitle.trim().length > 0} />
                    Title
                  </span>
                  <Input
                    className="mt-1"
                    value={draftTitle}
                    disabled={!selectedUpload.canApprove}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Add a descriptive title…"
                  />
                </label>

                <label className="block text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FieldDot ok={draftCaption.trim().length > 0} />
                    Caption
                  </span>
                  <textarea
                    className="mt-1 min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={draftCaption}
                    disabled={!selectedUpload.canApprove}
                    onChange={(e) => setDraftCaption(e.target.value)}
                    placeholder="Describe the scene, subject, context…"
                  />
                </label>

                <div>
                  <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <FieldDot ok={draftKeywordTags.length > 0} />
                    Keywords
                  </span>
                  <div className="mt-1 flex min-h-9 flex-wrap gap-1 rounded-md border border-input bg-background px-2 py-1.5">
                    {draftKeywordTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded border border-border bg-muted/60 px-2 py-0.5 text-xs"
                      >
                        {tag}
                        {selectedUpload.canApprove ? (
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={`Remove ${tag}`}
                            onClick={() =>
                              setDraftKeywordTags((prev) => prev.filter((t) => t !== tag))
                            }
                          >
                            <X className="h-3 w-3" />
                          </button>
                        ) : null}
                      </span>
                    ))}
                    {selectedUpload.canApprove ? (
                      <input
                        className="min-w-32 flex-1 border-0 bg-transparent text-sm outline-none"
                        value={draftKeywordInput}
                        placeholder="Type keyword, Enter"
                        onChange={(e) => setDraftKeywordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            const v = draftKeywordInput.trim()
                            if (!v) return
                            setDraftKeywordTags((prev) =>
                              prev.includes(v) ? prev : [...prev, v].slice(0, 80),
                            )
                            setDraftKeywordInput("")
                          }
                          if (e.key === "Backspace" && draftKeywordInput === "") {
                            setDraftKeywordTags((prev) => prev.slice(0, -1))
                          }
                        }}
                      />
                    ) : null}
                  </div>
                </div>

                <dl className="grid gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                  <div className="flex justify-between gap-2">
                    <dt>Contributor</dt>
                    <dd className="text-right text-foreground">{selectedUpload.contributor.displayName}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Event</dt>
                    <dd className="text-right text-foreground">{selectedUpload.event?.name ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Format</dt>
                    <dd className="text-right text-foreground">
                      {selectedUpload.mimeType ?? "—"} · {formatSize(selectedUpload.sizeBytes)}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!selectedUpload.canApprove || isRejecting}
                    onClick={() => rejectIds([selectedUpload.imageAssetId])}
                  >
                    <XCircle className="mr-1 h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    disabled={!selectedUpload.canApprove || isApproving}
                    onClick={() => approveIds([selectedUpload.imageAssetId])}
                  >
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Approve
                  </Button>
                </div>
              </div>
            </aside>
          ) : null}
        </div>
      )}

      <footer className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Showing {uploads.length} of {total.toLocaleString()} ({pagination.offset + 1}-
          {Math.min(pagination.offset + uploads.length, total)})
        </p>
        <div className="flex items-center gap-2">
          <Link
            aria-disabled={!hasPrev}
            tabIndex={hasPrev ? 0 : -1}
            href={`/staff/contributor-uploads?${buildQuery({ offset: prevOffset })}`}
            className={`inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs font-medium ${
              hasPrev ? "hover:bg-muted" : "pointer-events-none opacity-50"
            }`}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </Link>
          <Link
            aria-disabled={!hasMore}
            tabIndex={hasMore ? 0 : -1}
            href={`/staff/contributor-uploads?${buildQuery({ offset: nextOffset })}`}
            className={`inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs font-medium ${
              hasMore ? "hover:bg-muted" : "pointer-events-none opacity-50"
            }`}
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </footer>

      {approvableSelected.length > 0 ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-backdrop-filter:bg-background/80">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {approvableSelected.length} selected
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRejecting}
                onClick={() => rejectIds(approvableSelected.map((u) => u.imageAssetId))}
              >
                <XCircle className="mr-1 h-4 w-4" />
                {isRejecting ? "Rejecting…" : "Reject selected"}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isApproving}
                onClick={() => approveIds(approvableSelected.map((u) => u.imageAssetId))}
              >
                <CheckCircle2 className="mr-1 h-4 w-4" />
                {isApproving ? "Queueing…" : "Approve selected"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function getOriginalUrl(imageAssetId: string) {
  return `/staff/contributor-uploads/${encodeURIComponent(imageAssetId)}/original`
}

function FieldDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${ok ? "bg-foreground/50" : "bg-muted-foreground/40"}`}
      aria-hidden
    />
  )
}

function SortLink({
  label,
  href,
  active,
  order,
}: {
  label: string
  href: string
  active: boolean
  order: "asc" | "desc"
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "font-semibold text-foreground" : ""}`}
    >
      {label}
      {active ? order === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : null}
    </Link>
  )
}

function FilterBar({
  filters,
  currentParams,
  buildQuery,
}: {
  filters: AdminCatalogFilters | null
  currentParams: StaffContributorUploadsClientProps["currentParams"]
  buildQuery: (overrides?: Partial<StaffContributorUploadsClientProps["currentParams"]>) => string
}) {
  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card px-3 py-3"
    >
      <FilterField label="Status">
        <select
          name="status"
          defaultValue={currentParams.status}
          className="h-8 rounded border border-border bg-background px-2 text-xs"
        >
          <option value="SUBMITTED">Submitted (default)</option>
          <option value="APPROVED">Approved (awaiting derivatives)</option>
          <option value="ACTIVE">Active (live)</option>
          <option value="all">All</option>
        </select>
      </FilterField>

      <FilterField label="Asset Type">
        <select
          name="assetType"
          defaultValue={currentParams.assetType ?? "all"}
          className="h-8 rounded border border-border bg-background px-2 text-xs"
        >
          <option value="all">All types</option>
          <option value="IMAGE">Image</option>
          <option value="VIDEO">Video</option>
          <option value="CARICATURE">Caricature</option>
        </select>
      </FilterField>

      <FilterField label="Event">
        <select
          name="eventId"
          defaultValue={currentParams.eventId ?? ""}
          className="h-8 max-w-56 rounded border border-border bg-background px-2 text-xs"
        >
          <option value="">All events</option>
          {filters?.events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name ?? "Untitled"}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Contributor">
        <select
          name="contributorId"
          defaultValue={currentParams.contributorId ?? ""}
          className="h-8 max-w-56 rounded border border-border bg-background px-2 text-xs"
        >
          <option value="">All contributors</option>
          {filters?.contributors.map((contributor) => (
            <option key={contributor.id} value={contributor.id}>
              {contributor.displayName}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Batch ID">
        <input
          type="text"
          name="batchId"
          defaultValue={currentParams.batchId ?? ""}
          placeholder="UUID"
          className="h-8 w-[16rem] rounded border border-border bg-background px-2 text-xs"
        />
      </FilterField>

      <FilterField label="Search">
        <input
          type="text"
          name="q"
          defaultValue={currentParams.q ?? ""}
          placeholder="Filename / event / photographer"
          className="h-8 w-[16rem] rounded border border-border bg-background px-2 text-xs"
        />
      </FilterField>

      <FilterField label="From">
        <input
          type="date"
          name="from"
          defaultValue={currentParams.from ?? ""}
          className="h-8 rounded border border-border bg-background px-2 text-xs"
        />
      </FilterField>

      <FilterField label="To">
        <input
          type="date"
          name="to"
          defaultValue={currentParams.to ?? ""}
          className="h-8 rounded border border-border bg-background px-2 text-xs"
        />
      </FilterField>

      {currentParams.sort ? <input type="hidden" name="sort" value={currentParams.sort} /> : null}
      {currentParams.order ? <input type="hidden" name="order" value={currentParams.order} /> : null}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" variant="outline">
          Apply
        </Button>
        <Link
          href={`/staff/contributor-uploads?${buildQuery({
            eventId: undefined,
            contributorId: undefined,
            batchId: undefined,
            q: undefined,
            from: undefined,
            to: undefined,
            assetType: undefined,
            sort: undefined,
            order: undefined,
            offset: 0,
            status: "SUBMITTED",
          })}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Reset
        </Link>
      </div>
    </form>
  )
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  )
}

function ActiveFilterChips({
  currentParams,
  buildQuery,
}: {
  currentParams: StaffContributorUploadsClientProps["currentParams"]
  buildQuery: (overrides?: Partial<StaffContributorUploadsClientProps["currentParams"]>) => string
}) {
  const chips: Array<{ key: string; label: string; clear: Partial<StaffContributorUploadsClientProps["currentParams"]> }> =
    []
  if (currentParams.status !== "SUBMITTED") chips.push({ key: "status", label: `Status: ${currentParams.status}`, clear: { status: "SUBMITTED" } })
  if (currentParams.assetType && currentParams.assetType !== "all") chips.push({ key: "assetType", label: `Type: ${currentParams.assetType}`, clear: { assetType: "all" } })
  if (currentParams.eventId) chips.push({ key: "eventId", label: `Event: ${currentParams.eventId.slice(0, 8)}…`, clear: { eventId: undefined } })
  if (currentParams.contributorId) chips.push({ key: "contributorId", label: `Contributor: ${currentParams.contributorId.slice(0, 8)}…`, clear: { contributorId: undefined } })
  if (currentParams.batchId) chips.push({ key: "batchId", label: `Batch: ${currentParams.batchId.slice(0, 8)}…`, clear: { batchId: undefined } })
  if (currentParams.q) chips.push({ key: "q", label: `Search: ${currentParams.q}`, clear: { q: undefined } })
  if (currentParams.from) chips.push({ key: "from", label: `From: ${currentParams.from}`, clear: { from: undefined } })
  if (currentParams.to) chips.push({ key: "to", label: `To: ${currentParams.to}`, clear: { to: undefined } })
  if (currentParams.sort && currentParams.sort !== "submitted") {
    chips.push({ key: "sort", label: `Sort: ${currentParams.sort}`, clear: { sort: undefined, order: undefined } })
  } else if (currentParams.sort === "submitted" && currentParams.order === "asc") {
    chips.push({ key: "sortOrder", label: "Sort: submitted ↑", clear: { sort: undefined, order: undefined } })
  }

  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={`/staff/contributor-uploads?${buildQuery({ ...chip.clear, offset: 0 })}`}
          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs"
        >
          {chip.label}
          <X className="h-3 w-3" />
        </Link>
      ))}
    </div>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground ${className ?? ""}`}>
      {children}
    </th>
  )
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "ok" | "warn" | "neutral" }) {
  const map = {
    ok: "bg-emerald-100 text-emerald-800 border-emerald-200",
    warn: "bg-amber-100 text-amber-800 border-amber-200",
    neutral: "bg-slate-100 text-slate-800 border-slate-200",
  } as const
  return <span className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-medium ${map[tone]}`}>{children}</span>
}

function keywordsToTags(keywords: string | null | undefined): string[] {
  if (!keywords?.trim()) return []
  return keywords
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function formatSize(bytes: number | null) {
  if (bytes === null || bytes === undefined) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-IN")
}

function formatDateTime(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("en-IN")
}

async function safeJson(response: Response) {
  try {
    return (await response.json()) as { error?: { code?: string; message?: string } }
  } catch {
    return null
  }
}

function summarizeSkipReasons(skipped: Array<{ imageAssetId: string; reason: string }>): string {
  if (skipped.length === 0) return ""
  const counts = new Map<string, number>()
  for (const row of skipped) {
    counts.set(row.reason, (counts.get(row.reason) ?? 0) + 1)
  }
  const parts = [...counts.entries()].map(([reason, n]) => `${reason} (${n})`)
  return `Skip reasons: ${parts.join(", ")}.`
}

interface ConflictPatchBody {
  ok?: boolean
  error?: {
    code?: string
    message?: string
    detail?: {
      title: string | null
      caption: string | null
      keywords: string | null
      updatedAt: string
    }
  }
  title?: string | null
  caption?: string | null
  keywords?: string | null
  updatedAt?: string
}
