"use client"

import { AlertTriangle, CheckCircle2, RefreshCw, Search } from "lucide-react"
import { useState, useTransition } from "react"

import {
  refreshAdminEventSearchIndexStatusAction,
  syncAdminEventSearchIndexAction,
} from "@/app/(staff)/staff/(workspace)/events/actions"
import { Button } from "@/components/ui/button"
import type { AdminEventSearchIndexStatus } from "@/features/events/admin-events-types"
import { cn } from "@/lib/utils"

interface StaffEventSearchIndexPanelProps {
  eventId: string
  initialStatus: AdminEventSearchIndexStatus
}

export function StaffEventSearchIndexPanel({
  eventId,
  initialStatus,
}: StaffEventSearchIndexPanelProps) {
  const [status, setStatus] = useState(initialStatus)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleRefresh() {
    setError(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const result = await refreshAdminEventSearchIndexStatusAction(eventId)
      if ("error" in result && result.error) {
        setError(result.error)
        return
      }
      if ("status" in result && result.status) {
        setStatus(result.status)
      }
    })
  }

  function handleSync() {
    setError(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const result = await syncAdminEventSearchIndexAction(eventId)
      if ("error" in result && result.error) {
        setError(result.error)
        return
      }
      if ("result" in result && result.result) {
        setStatus(result.result.status)
        setSuccessMessage(
          `Synced ${result.result.upsertedCount} image${result.result.upsertedCount === 1 ? "" : "s"} to public search.`,
        )
      }
    })
  }

  if (!status.typesenseConfigured) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Public search indexing is not configured in this environment.
      </div>
    )
  }

  const showMismatch = status.missingCount !== null && status.missingCount > 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-md border p-3">
          <div className="text-sm font-medium text-muted-foreground">Catalog (public)</div>
          <div className="mt-1 text-2xl font-bold">{status.catalogSearchEligibleCount}</div>
          <p className="mt-1 text-xs text-muted-foreground">Images eligible for search</p>
        </div>
        <div
          className={cn(
            "rounded-md border p-3",
            showMismatch ? "border-amber-500/30 bg-amber-500/5" : "border-green-500/20 bg-green-500/5",
          )}
        >
          <div
            className={cn(
              "text-sm font-medium",
              showMismatch ? "text-amber-700 dark:text-amber-300" : "text-green-600 dark:text-green-400",
            )}
          >
            Search index
          </div>
          <div
            className={cn(
              "mt-1 text-2xl font-bold",
              showMismatch ? "text-amber-800 dark:text-amber-200" : "text-green-700 dark:text-green-300",
            )}
          >
            {status.typesenseIndexedCount ?? "—"}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Images visible on /search</p>
        </div>
      </div>

      {status.inSync ? (
        <div className="flex items-start gap-2 rounded-md border border-green-500/20 bg-green-500/5 p-3 text-sm text-green-800 dark:text-green-200">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <p>Public search is in sync with this event&apos;s catalog.</p>
        </div>
      ) : null}

      {showMismatch ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-900 dark:text-amber-100">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>
            {status.missingCount} public image{status.missingCount === 1 ? " is" : "s are"} missing from search.
            Event pages may show more images than `/search` until you sync.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {successMessage ? (
        <p className="text-sm text-green-700 dark:text-green-300">{successMessage}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={showMismatch ? "default" : "outline"}
          size="sm"
          disabled={isPending}
          onClick={handleSync}
          className="gap-2"
        >
          <Search size={14} />
          {isPending ? "Syncing…" : showMismatch ? "Sync missing to search" : "Re-sync search index"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={handleRefresh}
          className="gap-2"
        >
          <RefreshCw size={14} className={isPending ? "animate-spin" : undefined} />
          Refresh status
        </Button>
      </div>
    </div>
  )
}
