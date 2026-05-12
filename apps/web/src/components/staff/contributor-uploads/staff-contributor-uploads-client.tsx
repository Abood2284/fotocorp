"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, ChevronLeft, ChevronRight, Eye, ImageOff, X } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [openModalFor, setOpenModalFor] = useState<StaffContributorUploadDto | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null)

  const uploads = initialResponse.uploads
  const pagination = initialResponse.pagination
  const total = pagination.total

  const approvableSelected = useMemo(
    () => uploads.filter((upload) => selected[upload.imageAssetId] && upload.canApprove),
    [uploads, selected],
  )

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
      const queueNote =
        approved > 0
          ? "Images approved and queued for derivative generation. They will go live after required previews are ready."
          : ""
      const skippedNote = skipped > 0 ? ` ${skipped} skipped.` : ""
      const message = approved > 0
        ? `${queueNote}${skippedNote}`
        : skipped > 0
          ? `0 approved.${skippedNote}`
          : "Nothing to approve."
      setStatusMessage({ kind: approved > 0 ? "ok" : "error", text: message })
      clearSelection()
      setOpenModalFor(null)
      startTransition(() => router.refresh())
    } catch {
      setStatusMessage({ kind: "error", text: "Approve request failed." })
    } finally {
      setIsApproving(false)
    }
  }

  function buildQuery(overrides: Partial<typeof currentParams> = {}) {
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
    if (merged.limit && merged.limit !== 24) next.set("limit", String(merged.limit))
    if (merged.offset && merged.offset > 0) next.set("offset", String(merged.offset))
    return next.toString()
  }

  const visibleSelectableCount = uploads.filter((upload) => upload.canApprove).length
  const allSelectableSelected = visibleSelectableCount > 0 && approvableSelected.length === visibleSelectableCount

  const nextOffset = pagination.offset + pagination.limit
  const prevOffset = Math.max(0, pagination.offset - pagination.limit)
  const hasMore = nextOffset < total
  const hasPrev = pagination.offset > 0

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="fc-heading-2 text-xl font-semibold tracking-tight">Contributor Uploads</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review submitted contributor assets before publishing.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[1200px] text-sm">
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
                <Th>Filename</Th>
                <Th>Contributor</Th>
                <Th>Event</Th>
                <Th>Asset Type</Th>
                <Th>Submitted</Th>
                <Th>Fotokey</Th>
                <Th>Status</Th>
                <Th>Visibility</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((upload) => {
                const isChecked = Boolean(selected[upload.imageAssetId])
                return (
                  <tr
                    key={upload.imageAssetId}
                    className={`border-t border-border align-top ${isChecked ? "bg-accent-wash/40" : ""}`}
                  >
                    <td className="px-3 py-2">
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
                    <td className="px-3 py-2"><Badge tone="neutral">{upload.status}</Badge></td>
                    <td className="px-3 py-2">
                      <Badge tone={upload.visibility === "PUBLIC" ? "ok" : "warn"}>{upload.visibility}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/staff/contributor-uploads/batches/${upload.batchId}`}
                          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                        >
                          Batch
                        </Link>
                        <button
                          type="button"
                          onClick={() => setOpenModalFor(upload)}
                          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Review
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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

      {openModalFor ? (
        <ReviewModal
          upload={openModalFor}
          onClose={() => setOpenModalFor(null)}
          onApprove={() => approveIds([openModalFor.imageAssetId])}
          isApproving={isApproving}
        />
      ) : null}
    </div>
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
  const chips: Array<{ key: string; label: string; clear: Partial<StaffContributorUploadsClientProps["currentParams"]> }> = []
  if (currentParams.status !== "SUBMITTED") chips.push({ key: "status", label: `Status: ${currentParams.status}`, clear: { status: "SUBMITTED" } })
  if (currentParams.assetType && currentParams.assetType !== "all") chips.push({ key: "assetType", label: `Type: ${currentParams.assetType}`, clear: { assetType: "all" } })
  if (currentParams.eventId) chips.push({ key: "eventId", label: `Event: ${currentParams.eventId.slice(0, 8)}…`, clear: { eventId: undefined } })
  if (currentParams.contributorId) chips.push({ key: "contributorId", label: `Contributor: ${currentParams.contributorId.slice(0, 8)}…`, clear: { contributorId: undefined } })
  if (currentParams.batchId) chips.push({ key: "batchId", label: `Batch: ${currentParams.batchId.slice(0, 8)}…`, clear: { batchId: undefined } })
  if (currentParams.q) chips.push({ key: "q", label: `Search: ${currentParams.q}`, clear: { q: undefined } })
  if (currentParams.from) chips.push({ key: "from", label: `From: ${currentParams.from}`, clear: { from: undefined } })
  if (currentParams.to) chips.push({ key: "to", label: `To: ${currentParams.to}`, clear: { to: undefined } })

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

function ReviewModal({
  upload,
  onClose,
  onApprove,
  isApproving,
}: {
  upload: StaffContributorUploadDto
  onClose: () => void
  onApprove: () => void
  isApproving: boolean
}) {
  const originalUrl = `/staff/contributor-uploads/${encodeURIComponent(upload.imageAssetId)}/original`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-base font-semibold">{upload.originalFileName}</h3>
            <p className="text-xs text-muted-foreground">
              {upload.contributor.displayName}
              {upload.event ? ` · ${upload.event.name}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close review"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-auto bg-muted/40 p-4">
          <div className="flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={originalUrl}
              alt={upload.originalFileName}
              className="max-h-[70vh] w-auto max-w-full rounded border border-border bg-card object-contain"
            />
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
            <DescItem label="Status" value={upload.status} />
            <DescItem label="Visibility" value={upload.visibility} />
            <DescItem label="Source" value={upload.source} />
            <DescItem label="Fotokey" value={upload.fotokey ?? "—"} />
          </dl>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onApprove}
              disabled={!upload.canApprove || isApproving}
            >
              <CheckCircle2 className="mr-1 h-4 w-4" />
              {isApproving
                ? "Queueing…"
                : upload.canApprove
                  ? "Approve & Queue Publish"
                  : upload.fotokey
                    ? `Already approved (${upload.fotokey})`
                    : "Already actioned"}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  )
}

function DescItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/80">{label}</dt>
      <dd className="text-foreground">{value}</dd>
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
