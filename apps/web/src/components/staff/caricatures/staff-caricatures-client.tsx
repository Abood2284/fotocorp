"use client"

import { CheckCircle, ImageOff, Loader2, XCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"

import { StaffCaricatureMetadataDisplay } from "@/components/staff/caricatures/staff-caricature-metadata-display"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { StaffCaricatureDetail, StaffCaricatureListItem, StaffCaricatureListResponse } from "@/lib/api/staff-caricatures-api"
import { getStaffCaricatureOriginalUrl } from "@/lib/search/caricature-search"

type ReviewAction = "approved" | "rejected"

interface StaffCaricaturesClientProps {
  initialResponse: StaffCaricatureListResponse
  currentStatus: string
  currentQuery: string
}

export function StaffCaricaturesClient({
  initialResponse,
  currentStatus,
  currentQuery,
}: StaffCaricaturesClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [items, setItems] = useState(initialResponse.items)
  const [total, setTotal] = useState(initialResponse.total)
  const [selectedId, setSelectedId] = useState<string | null>(initialResponse.items[0]?.id ?? null)
  const [statusFilter, setStatusFilter] = useState(currentStatus)
  const [query, setQuery] = useState(currentQuery)
  const [statusMessage, setStatusMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null)
  const [actionBusy, setActionBusy] = useState<"approve" | "reject" | null>(null)
  const [detail, setDetail] = useState<StaffCaricatureDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [reviewActionById, setReviewActionById] = useState<Record<string, ReviewAction>>({})

  useEffect(() => {
    setItems(initialResponse.items)
    setTotal(initialResponse.total)
    setReviewActionById((current) => {
      const next = { ...current }
      for (const assetId of Object.keys(next)) {
        const item = initialResponse.items.find((entry) => entry.id === assetId)
        if (!item || item.status === "PUBLISHED" || item.status === "REJECTED") {
          delete next[assetId]
        }
      }
      return next
    })
  }, [initialResponse])

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  )

  const loadDetail = useCallback(async (assetId: string, options?: { quiet?: boolean }) => {
    if (!options?.quiet) {
      setDetailLoading(true)
      setDetailError(null)
    }

    try {
      const response = await fetch(`/api/staff/caricatures/${encodeURIComponent(assetId)}`, {
        cache: "no-store",
      })
      const body = (await response.json().catch(() => null)) as
        | StaffCaricatureDetail
        | { error?: { message?: string } }
        | null
      if (!response.ok) {
        throw new Error(
          body && "error" in body ? body.error?.message ?? "Could not load caricature detail." : "Could not load caricature detail.",
        )
      }
      if (!body || "error" in body) {
        throw new Error("Could not load caricature detail.")
      }
      setDetail(body)
      return body
    } catch (error) {
      if (!options?.quiet) {
        setDetail(null)
        setDetailError(error instanceof Error ? error.message : "Could not load caricature detail.")
      }
      return null
    } finally {
      if (!options?.quiet) setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      setDetailError(null)
      setDetailLoading(false)
      return
    }

    void loadDetail(selectedId)
  }, [loadDetail, selectedId])

  useEffect(() => {
    if (!selectedId) return
    if (reviewActionById[selectedId] !== "approved") return
    const status = detail?.status
    if (status === "PUBLISHED" || status === "REJECTED") return
    if (detail?.previewGenerationStatus === "FAILED") return

    const timer = window.setInterval(() => {
      void loadDetail(selectedId, { quiet: true }).then((nextDetail) => {
        if (nextDetail?.status === "PUBLISHED" || nextDetail?.status === "REJECTED") {
          startTransition(() => router.refresh())
        }
      })
    }, 3000)

    return () => window.clearInterval(timer)
  }, [detail?.previewGenerationStatus, detail?.status, loadDetail, reviewActionById, router, selectedId, startTransition])

  const applyLocalListAfterReview = useCallback((assetId: string, action: ReviewAction) => {
    setReviewActionById((current) => ({ ...current, [assetId]: action }))

    const shouldRemoveFromList =
      (action === "approved" && (statusFilter === "PENDING_REVIEW" || statusFilter === "DRAFT")) ||
      (action === "rejected" && statusFilter === "PENDING_REVIEW")

    if (shouldRemoveFromList) {
      setItems((current) => {
        const next = current.filter((item) => item.id !== assetId)
        setSelectedId((selected) => (selected === assetId ? next[0]?.id ?? null : selected))
        return next
      })
      setTotal((count) => Math.max(0, count - 1))
      return
    }

    if (action === "rejected") {
      setItems((current) =>
        current.map((item) => (item.id === assetId ? { ...item, status: "REJECTED" } : item)),
      )
    }
  }, [statusFilter])

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams()
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter)
    if (query.trim()) params.set("q", query.trim())
    startTransition(() => {
      router.push(`/staff/caricatures?${params.toString()}`)
    })
  }, [query, router, startTransition, statusFilter])

  async function handleApprove() {
    if (!selectedId || actionBusy) return
    setActionBusy("approve")
    setStatusMessage(null)
    try {
      const response = await fetch(`/api/staff/caricatures/${encodeURIComponent(selectedId)}/approve`, {
        method: "POST",
      })
      const body = (await response.json().catch(() => null)) as
        | { message?: string; error?: { message?: string } }
        | null
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Could not approve caricature.")
      }
      setStatusMessage({ kind: "ok", text: body?.message ?? "Caricature approved. Processing will run automatically." })
      const removesFromList = statusFilter === "PENDING_REVIEW" || statusFilter === "DRAFT"
      applyLocalListAfterReview(selectedId, "approved")
      if (!removesFromList) await loadDetail(selectedId)
      startTransition(() => router.refresh())
    } catch (error) {
      setStatusMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Could not approve caricature.",
      })
    } finally {
      setActionBusy(null)
    }
  }

  async function handleReject() {
    if (!selectedId || actionBusy) return
    setActionBusy("reject")
    setStatusMessage(null)
    try {
      const response = await fetch(`/api/staff/caricatures/${encodeURIComponent(selectedId)}/reject`, {
        method: "POST",
      })
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Could not reject caricature.")
      }
      setStatusMessage({ kind: "ok", text: "Caricature rejected." })
      const removesFromList = statusFilter === "PENDING_REVIEW"
      applyLocalListAfterReview(selectedId, "rejected")
      if (!removesFromList) await loadDetail(selectedId)
      startTransition(() => router.refresh())
    } catch (error) {
      setStatusMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Could not reject caricature.",
      })
    } finally {
      setActionBusy(null)
    }
  }

  const selectedReviewAction = selectedId ? reviewActionById[selectedId] : undefined
  const canReview = canReviewCaricature(selected, detail, selectedReviewAction)

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-4 lg:flex-row">
      <section className="flex w-full flex-col gap-4 lg:w-[min(420px,100%)]">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Caricatures</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review contributor submissions, approve to generate blurred previews, publish, and index search automatically.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[160px] flex-1">
            <label htmlFor="caricature-status-filter" className="text-xs font-medium text-muted-foreground">
              Status
            </label>
            <select
              id="caricature-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="PENDING_REVIEW">Pending review</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="REJECTED">Rejected</option>
              <option value="all">All</option>
            </select>
          </div>
          <div className="min-w-[180px] flex-[2]">
            <label htmlFor="caricature-search" className="text-xs font-medium text-muted-foreground">
              Search
            </label>
            <Input
              id="caricature-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Headline, credit, description"
              className="mt-1"
            />
          </div>
          <Button type="button" variant="secondary" onClick={applyFilters} disabled={isPending}>
            {isPending ? "Loading…" : "Apply"}
          </Button>
        </div>

        <div className="rounded-lg border border-border">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted-foreground">
              <ImageOff className="size-8 opacity-60" />
              <p>No caricatures match these filters.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const active = item.id === selectedId
                const displayStatus = resolveCaricatureDisplayStatus(item, item.id === selectedId ? detail : null, reviewActionById[item.id])
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 ${active ? "bg-muted/60" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{item.headline}</p>
                          <p className="text-xs text-muted-foreground">{item.credit}</p>
                        </div>
                        <StatusBadge status={displayStatus} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.categoryName} · {item.hasOriginalFile ? "Original attached" : "Missing original"}
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Showing {items.length} of {total}
        </p>
      </section>

      <section className="min-w-0 flex-1 rounded-lg border border-border p-4 lg:p-6">
        {!selected ? (
          <p className="text-sm text-muted-foreground">Select a caricature to review.</p>
        ) : (
          <CaricatureReviewPanel
            summary={selected}
            detail={detail}
            detailLoading={detailLoading}
            detailError={detailError}
            displayStatus={resolveCaricatureDisplayStatus(selected, detail, selectedReviewAction)}
            canReview={Boolean(canReview)}
            actionBusy={actionBusy}
            statusMessage={statusMessage}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}
      </section>
    </div>
  )
}

function CaricatureReviewPanel({
  summary,
  detail,
  detailLoading,
  detailError,
  displayStatus,
  canReview,
  actionBusy,
  statusMessage,
  onApprove,
  onReject,
}: {
  summary: StaffCaricatureListResponse["items"][number]
  detail: StaffCaricatureDetail | null
  detailLoading: boolean
  detailError: string | null
  displayStatus: string
  canReview: boolean
  actionBusy: "approve" | "reject" | null
  statusMessage: { kind: "ok" | "error"; text: string } | null
  onApprove: () => void
  onReject: () => void
}) {
  const headline = detail?.headline.trim() || summary.headline
  const credit = detail?.credit.trim() || summary.credit
  const hasOriginalFile = detail?.hasOriginalFile ?? summary.hasOriginalFile
  const originalUrl = hasOriginalFile ? getStaffCaricatureOriginalUrl(summary.id) : null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{headline}</h2>
          <p className="text-sm text-muted-foreground">{credit}</p>
        </div>
        <StatusBadge status={displayStatus} />
      </div>

      {originalUrl ? (
        <div className="overflow-hidden rounded-md border border-border bg-muted/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={originalUrl} alt={`Original caricature: ${headline}`} className="max-h-[420px] w-full object-contain" />
        </div>
      ) : (
        <p className="text-sm text-destructive">Original file is missing. Approval is blocked until upload completes.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onApprove} disabled={!canReview || actionBusy !== null}>
          {actionBusy === "approve" ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Approving…
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 size-4" />
              Approve & publish
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onReject} disabled={!canReview || actionBusy !== null}>
          {actionBusy === "reject" ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Rejecting…
            </>
          ) : (
            <>
              <XCircle className="mr-2 size-4" />
              Reject
            </>
          )}
        </Button>
        <Button type="button" variant="ghost" asChild>
          <Link href="/staff/contributor-uploads/new?assetType=CARICATURE">Upload new caricature</Link>
        </Button>
      </div>

      {statusMessage ? (
        <p className={`text-sm ${statusMessage.kind === "ok" ? "text-emerald-700" : "text-destructive"}`}>
          {statusMessage.text}
        </p>
      ) : null}

      {detailLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading submission details…
        </div>
      ) : null}

      {detailError ? <p className="text-sm text-destructive">{detailError}</p> : null}

      {detail ? <StaffCaricatureMetadataDisplay detail={detail} /> : null}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "PUBLISHED"
      ? "bg-emerald-100 text-emerald-800"
      : status === "PROCESSING"
        ? "bg-sky-100 text-sky-900"
      : status === "PENDING_REVIEW"
        ? "bg-amber-100 text-amber-900"
        : status === "REJECTED"
          ? "bg-red-100 text-red-800"
          : "bg-muted text-muted-foreground"

  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{status.replaceAll("_", " ")}</span>
}

function isCaricaturePublishProcessing(
  detail: StaffCaricatureDetail | null,
  reviewAction?: ReviewAction,
): boolean {
  if (reviewAction === "approved") {
    const status = detail?.status
    if (status === "PUBLISHED" || status === "REJECTED") return false
    const previewStatus = detail?.previewGenerationStatus
    if (previewStatus === "READY" || previewStatus === "FAILED") return false
    return true
  }

  return detail?.previewGenerationStatus === "QUEUED" || detail?.previewGenerationStatus === "GENERATING"
}

function resolveCaricatureDisplayStatus(
  summary: StaffCaricatureListItem,
  detail: StaffCaricatureDetail | null,
  reviewAction?: ReviewAction,
): string {
  const status = detail?.status ?? summary.status
  if (reviewAction === "rejected" || status === "REJECTED") return "REJECTED"
  if (status === "PUBLISHED") return "PUBLISHED"
  if (reviewAction === "approved" || isCaricaturePublishProcessing(detail, reviewAction)) return "PROCESSING"
  return status
}

function canReviewCaricature(
  summary: StaffCaricatureListItem | null,
  detail: StaffCaricatureDetail | null,
  reviewAction?: ReviewAction,
): boolean {
  if (!summary?.hasOriginalFile) return false
  if (reviewAction) return false
  const status = detail?.status ?? summary.status
  if (status !== "PENDING_REVIEW" && status !== "DRAFT") return false
  if (isCaricaturePublishProcessing(detail)) return false
  return true
}
