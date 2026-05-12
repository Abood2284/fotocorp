"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, FileImage, ImageOff, CheckCircle2, Eye, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type {
  StaffContributorUploadBatchDetailResponse,
  StaffContributorUploadDto,
} from "@/lib/api/staff-contributor-uploads-api"

export function StaffContributorBatchClient({
  response,
}: {
  response: StaffContributorUploadBatchDetailResponse
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isApproving, setIsApproving] = useState(false)
  const [openModalFor, setOpenModalFor] = useState<StaffContributorUploadDto | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null)

  const { batch, contributor, event, items } = response

  const approvableItems = items.filter((item) => item.canApprove)

  async function approveIds(ids: string[]) {
    if (ids.length === 0) return
    setIsApproving(true)
    setStatusMessage(null)
    try {
      const res = await fetch("/api/staff/contributor-uploads/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageAssetIds: ids }),
        cache: "no-store",
      })

      if (!res.ok) {
        setStatusMessage({ kind: "error", text: "Approve request failed." })
        return
      }

      const body = (await res.json()) as {
        ok: true
        approvedCount: number
        skipped: Array<{ imageAssetId: string; reason: string }>
      }
      const approved = body.approvedCount
      const skipped = body.skipped.length
      const queueNote =
        approved > 0
          ? "Items approved and queued for derivative generation."
          : ""
      const skippedNote = skipped > 0 ? ` ${skipped} skipped.` : ""
      const message =
        approved > 0
          ? `${queueNote}${skippedNote}`
          : skipped > 0
            ? `0 approved.${skippedNote}`
            : "Nothing to approve."
      setStatusMessage({ kind: approved > 0 ? "ok" : "error", text: message })
      setOpenModalFor(null)
      startTransition(() => router.refresh())
    } catch {
      setStatusMessage({ kind: "error", text: "Approve request failed." })
    } finally {
      setIsApproving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/staff/contributor-uploads"
          className="inline-flex items-center hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Back to queue
        </Link>
      </div>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="fc-heading-2 text-xl font-semibold tracking-tight">Batch Details</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Batch ID: <span className="font-mono">{batch.id}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="default"
            disabled={approvableItems.length === 0 || isApproving || isPending}
            onClick={() => approveIds(approvableItems.map((u) => u.imageAssetId))}
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            {isApproving
              ? "Queueing…"
              : `Approve All Approvable (${approvableItems.length})`}
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

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Contributor
          </h3>
          <p className="mt-2 font-medium">{contributor?.displayName ?? "Unknown"}</p>
          {contributor?.id && <p className="mt-1 text-xs text-muted-foreground font-mono">{contributor.id}</p>}
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Event
          </h3>
          <p className="mt-2 font-medium">{event?.name ?? "No associated event"}</p>
          {event?.id && <p className="mt-1 text-xs text-muted-foreground font-mono">{event.id}</p>}
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Batch Info
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Status</p>
              <p className="font-medium">{batch.status}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Type</p>
              <p className="font-medium">{batch.assetType}</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground text-xs">Submitted</p>
              <p className="font-medium text-xs">
                {batch.submittedAt ? new Date(batch.submittedAt).toLocaleString("en-IN") : "Not submitted"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Uploaded Assets ({items.length})</h3>
        {items.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-6 py-12 text-center">
            <ImageOff className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 text-sm font-medium">No assets found in this batch</h3>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="w-10 px-3 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">
                    #
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">
                    File
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">
                    Type
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">
                    Fotokey
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">
                    Status
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item, index) => (
                  <tr key={item.imageAssetId} className="hover:bg-muted/30">
                    <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <FileImage className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{item.originalFileName}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.mimeType ?? "—"} · {formatSize(item.sizeBytes)}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {item.assetType ?? "IMAGE"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {item.fotokey ? (
                        <span className="font-mono text-foreground">{item.fotokey}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-800">
                        {item.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setOpenModalFor(item)}
                        className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

function formatSize(bytes: number | null) {
  if (bytes === null || bytes === undefined) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}
