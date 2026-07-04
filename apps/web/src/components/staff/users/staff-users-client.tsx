"use client"

import { SquareCheck, Square, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useState, useTransition, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import type { AdminCatalogUsersResponse } from "@/features/assets/admin-catalog-types"
import { bulkUpdateUserStatusAction } from "@/app/(staff)/staff/(workspace)/users/actions"
import { ConfirmDialog } from "@/components/staff/shared/confirm-dialog"
import { useToastNotify } from "@/components/staff/shared/toast"
import {
  Th,
  HeaderSearchFilter,
  ActiveFilterChips,
  chip,
} from "@/components/staff/shared/staff-table-filters"
import { cn } from "@/lib/utils"

interface StaffUsersClientProps {
  initialResponse: AdminCatalogUsersResponse
  initialQuery: Record<string, string>
}

export function StaffUsersClient({ initialResponse, initialQuery }: StaffUsersClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { toast } = useToastNotify()

  const items = initialResponse.items
  const query = new URLSearchParams(initialQuery)
  const previousQuery = new URLSearchParams(query)
  previousQuery.delete("cursor")
  const nextQuery = new URLSearchParams(query)
  if (initialResponse.nextCursor) nextQuery.set("cursor", initialResponse.nextCursor)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1)
  const tableBodyRef = useRef<HTMLTableSectionElement>(null)

  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string
    description: string
    variant: "default" | "destructive"
    action: () => void
  } | null>(null)

  const toggleSelection = (authUserId: string) => {
    const next = new Set(selectedIds)
    if (next.has(authUserId)) next.delete(authUserId)
    else next.add(authUserId)
    setSelectedIds(next)
  }

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map((i) => i.authUserId)))
    }
  }

  const updateQueryParam = (name: string, value: string) => {
    const next = new URLSearchParams(query)
    if (value) next.set(name, value)
    else next.delete(name)
    next.delete("cursor")
    startTransition(() => router.replace(`/staff/users?${next.toString()}`))
  }

  const selectedAll = selectedIds.size === items.length && items.length > 0
  const selectedSome = selectedIds.size > 0 && selectedIds.size < items.length

  const selectAllCheckboxRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = selectedSome
    }
  }, [selectedSome])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "SELECT"
      ) {
        return
      }

      if (e.key === "Escape" && pendingConfirm) {
        setPendingConfirm(null)
        return
      }

      if (!items.length) return

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setFocusedRowIndex((prev) => Math.min(prev + 1, items.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setFocusedRowIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "Enter" && focusedRowIndex >= 0) {
        const user = items[focusedRowIndex]
        if (user) router.push(`/staff/users/${user.authUserId}`)
      } else if (e.key === " " && focusedRowIndex >= 0) {
        e.preventDefault()
        const user = items[focusedRowIndex]
        if (user) toggleSelection(user.authUserId)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [items, focusedRowIndex, pendingConfirm, router])

  useEffect(() => {
    if (focusedRowIndex >= 0 && tableBodyRef.current) {
      const row = tableBodyRef.current.querySelector(`[data-row-index="${focusedRowIndex}"]`) as HTMLElement | null
      row?.focus()
    }
  }, [focusedRowIndex])

  const filterChips = [
    chip("q", query.get("q"), "Search"),
    chip("sort", query.get("sort"), "Sort"),
    chip("limit", query.get("limit"), "Per page"),
  ].filter((item): item is NonNullable<typeof item> => item !== null)

  return (
    <>
      <ConfirmDialog
        open={!!pendingConfirm}
        title={pendingConfirm?.title ?? ""}
        description={pendingConfirm?.description ?? ""}
        variant={pendingConfirm?.variant ?? "default"}
        loading={isPending}
        onConfirm={() => {
          pendingConfirm?.action()
          setPendingConfirm(null)
        }}
        onCancel={() => setPendingConfirm(null)}
      />

      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Users</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse subscriber accounts and open a user to manage access or review downloads.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">Quick filters:</span>
        {[
          { label: "Active", q: "status=ACTIVE" },
          { label: "Suspended", q: "status=SUSPENDED" },
          { label: "Subscribers", q: "isSubscriber=true" },
        ].map((preset) => (
          <Link
            key={preset.q}
            href={`/staff/users?${preset.q}`}
            className="rounded-full border border-border px-2.5 py-1 text-[11px] hover:bg-muted transition-colors"
            prefetch={false}
          >
            {preset.label}
          </Link>
        ))}
      </div>

      <ActiveFilterChips query={query} chips={filterChips} basePath="/staff/users" />

      <div className="space-y-5 w-full">
        {selectedIds.size > 0 && (
          <div className="sticky top-16 z-30 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-primary">{selectedIds.size} selected</span>
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-muted-foreground hover:text-foreground">
                Clear
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form
                action={bulkUpdateUserStatusAction}
                onSubmit={(e) => {
                  e.preventDefault()
                  setPendingConfirm({
                    title: "Suspend users",
                    description: `Suspend ${selectedIds.size} users?`,
                    variant: "destructive",
                    action: () => {
                      e.currentTarget.requestSubmit()
                      setSelectedIds(new Set())
                      toast({ message: `${selectedIds.size} users suspended`, variant: "success" })
                    },
                  })
                }}
              >
                {Array.from(selectedIds).map((id) => (
                  <input key={id} type="hidden" name="authUserId" value={id} />
                ))}
                <input type="hidden" name="nextStatus" value="SUSPENDED" />
                <button type="submit" className="rounded border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted text-rose-600">
                  Bulk Suspend
                </button>
              </form>
              <form
                action={bulkUpdateUserStatusAction}
                onSubmit={(e) => {
                  e.preventDefault()
                  setPendingConfirm({
                    title: "Activate users",
                    description: `Activate ${selectedIds.size} users?`,
                    variant: "default",
                    action: () => {
                      e.currentTarget.requestSubmit()
                      setSelectedIds(new Set())
                      toast({ message: `${selectedIds.size} users activated`, variant: "success" })
                    },
                  })
                }}
              >
                {Array.from(selectedIds).map((id) => (
                  <input key={id} type="hidden" name="authUserId" value={id} />
                ))}
                <input type="hidden" name="nextStatus" value="ACTIVE" />
                <button type="submit" className="rounded border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted text-emerald-600">
                  Bulk Activate
                </button>
              </form>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {items.length} user{items.length !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <ArrowUpDown size={14} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Sort:</span>
              <select
                value={query.get("sort") ?? "newest"}
                onChange={(e) => updateQueryParam("sort", e.target.value)}
                className="h-8 rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Per page:</span>
              <select
                value={query.get("limit") ?? "50"}
                onChange={(e) => updateQueryParam("limit", e.target.value)}
                className="h-8 rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href={`/staff/users?${previousQuery.toString()}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" prefetch={false}>
              <ChevronLeft size={14} />
              Reset cursor
            </Link>
            {initialResponse.nextCursor ? (
              <Link href={`/staff/users?${nextQuery.toString()}`} className="inline-flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted" prefetch={false}>
                Load more
                <ChevronRight size={14} />
              </Link>
            ) : (
              <span className="text-xs text-muted-foreground">End of results</span>
            )}
          </div>
        </div>

        {isPending && (
          <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 animate-progress rounded-full bg-primary" />
          </div>
        )}

        {items.length ? (
          <div className="max-h-[calc(100vh-320px)] overflow-auto rounded-md border border-border">
            <table className="w-full text-left text-sm" role="grid" aria-label="Users table">
              <thead className="sticky top-0 z-10 bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left w-10">
                    <label className="flex items-center justify-center cursor-pointer">
                      <input
                        ref={selectAllCheckboxRef}
                        type="checkbox"
                        className="sr-only"
                        checked={selectedAll}
                        onChange={toggleAll}
                        aria-label="Select all users"
                      />
                      {selectedAll ? <SquareCheck size={16} /> : <Square size={16} />}
                    </label>
                  </th>
                  <Th scope="col" filterControl={<HeaderSearchFilter query={query} basePath="/staff/users" />}>
                    User
                  </Th>
                  <Th scope="col">Company</Th>
                  <Th scope="col">Job title</Th>
                  <Th scope="col">Used / Allocated</Th>
                </tr>
              </thead>
              <tbody ref={tableBodyRef} className="divide-y divide-border bg-background">
                {items.map((user, index) => (
                  <tr
                    key={user.id}
                    data-row-index={index}
                    tabIndex={0}
                    onClick={() => router.push(`/staff/users/${user.authUserId}`)}
                    onFocus={() => setFocusedRowIndex(index)}
                    className={cn(
                      "border-t border-border align-middle transition-colors hover:bg-muted/30 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                      selectedIds.has(user.authUserId) ? "bg-primary/5" : "",
                    )}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <label className="flex items-center justify-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={selectedIds.has(user.authUserId)}
                          onChange={() => toggleSelection(user.authUserId)}
                          aria-label={`Select ${user.email}`}
                        />
                        {selectedIds.has(user.authUserId) ? <SquareCheck size={16} /> : <Square size={16} />}
                      </label>
                    </td>
                    <th scope="row" className="px-4 py-3">
                      <div className="font-medium text-foreground" title={user.displayName || undefined}>
                        {user.displayName || "Unnamed user"}
                      </div>
                      <div className="text-xs text-muted-foreground" title={user.email}>{user.email}</div>
                      {user.username ? (
                        <div className="text-xs text-muted-foreground">@{user.username}</div>
                      ) : null}
                    </th>
                    <td className="px-4 py-3 text-sm text-foreground">
                      <span className="line-clamp-2" title={user.companyName ?? undefined}>
                        {user.companyName || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      <span className="line-clamp-2" title={user.jobTitle ?? undefined}>
                        {user.jobTitle || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-foreground">
                      {formatCreditsDisplay(user.downloadQuotaUsed, user.downloadQuotaLimit, user.isSubscriber)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
            No users found matching the current filters.
          </div>
        )}
      </div>
    </>
  )
}

function formatCreditsDisplay(used: number, limit: number | null, isSubscriber: boolean) {
  const allocated = limit ?? (isSubscriber ? 100 : null)
  if (allocated === null) return `${used}/—`
  return `${used}/${allocated}`
}
