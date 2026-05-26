"use client"

import { SquareCheck, Square, Search, Filter, X, ArrowUpDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import Link from "next/link"
import { useState, useTransition, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import type { AdminCatalogUserItem, AdminCatalogUsersResponse } from "@/features/assets/admin-catalog-types"
import {
  toggleSubscriptionAction,
  updateUserRoleAction,
  updateUserStatusAction,
  bulkUpdateUserRoleAction,
  bulkUpdateUserStatusAction,
  bulkToggleSubscriptionAction,
} from "@/app/(staff)/staff/(workspace)/users/actions"
import { Badge } from "@/components/ui/badge"
import { StaffUserDetailSidebar } from "./staff-user-detail-sidebar"
import { ConfirmDialog } from "@/components/staff/shared/confirm-dialog"
import { useToastNotify } from "@/components/staff/shared/toast"
import {
  Th,
  HeaderSearchFilter,
  HeaderSelectFilter,
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
  const [inspectUserId, setInspectUserId] = useState<string | null>(null)
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

  const refreshData = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  const updateQueryParam = (name: string, value: string) => {
    const next = new URLSearchParams(query)
    if (value) next.set(name, value)
    else next.delete(name)
    next.delete("cursor")
    startTransition(() => router.replace(`/staff/users?${next.toString()}`))
  }

  const handleActionWithToast = useCallback(
    async (formData: FormData, successMsg: string) => {
      // Determine which action to call based on the form data
      const formElement = document.activeElement?.closest("form")
      if (formElement) {
        formElement.requestSubmit()
        toast({ message: successMsg, variant: "success" })
      }
    },
    [toast],
  )

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
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "SELECT") {
        return
      }

      if (e.key === "Escape") {
        if (inspectUserId) {
          setInspectUserId(null)
        } else if (pendingConfirm) {
          setPendingConfirm(null)
        }
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
        if (user) {
          setInspectUserId((prev) => (prev === user.authUserId ? null : user.authUserId))
        }
      } else if (e.key === " " && focusedRowIndex >= 0) {
        e.preventDefault()
        const user = items[focusedRowIndex]
        if (user) toggleSelection(user.authUserId)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [items, focusedRowIndex, inspectUserId, pendingConfirm])

  useEffect(() => {
    if (focusedRowIndex >= 0 && tableBodyRef.current) {
      const row = tableBodyRef.current.querySelector(`[data-row-index="${focusedRowIndex}"]`) as HTMLElement | null
      row?.focus()
    }
  }, [focusedRowIndex])

  const filterChips = [
    chip("q", query.get("q"), "Search"),
    chip("role", query.get("role"), "Role"),
    chip("status", query.get("status"), "Status"),
    chip("isSubscriber", query.has("isSubscriber") ? query.get("isSubscriber") : null, "Subscriber"),
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
          Manage app user accounts, roles, subscriptions, and access.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">Quick filters:</span>
        {[
          { label: "Active", q: "status=ACTIVE" },
          { label: "Suspended", q: "status=SUSPENDED" },
          { label: "Subscribers", q: "isSubscriber=true" },
          { label: "Non-subscribers", q: "isSubscriber=false" },
          { label: "Admins", q: "role=ADMIN" },
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

      <div className={cn("flex flex-col lg:flex-row w-full items-start gap-4", inspectUserId ? "" : "")}>
        <div className={cn("space-y-5 transition-all duration-300 w-full", inspectUserId ? "lg:w-[60%]" : "lg:w-full")}>
          {/* Bulk actions bar */}
          {selectedIds.size > 0 && (
            <div className="sticky top-16 z-30 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-primary">{selectedIds.size} selected</span>
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Bulk Status */}
                <form
                  action={bulkUpdateUserStatusAction}
                  onSubmit={(e) => {
                    e.preventDefault()
                    setPendingConfirm({
                      title: "Suspend users",
                      description: `Suspend ${selectedIds.size} users?`,
                      variant: "destructive",
                      action: () => {
                        const fd = new FormData(e.currentTarget)
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
                        const fd = new FormData(e.currentTarget)
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

                {/* Bulk Role */}
                <form
                  action={bulkUpdateUserRoleAction}
                  onSubmit={(e) => {
                    e.preventDefault()
                    const fd = new FormData(e.currentTarget)
                    const role = String(fd.get("role") ?? "")
                    if (!role) return
                    setPendingConfirm({
                      title: "Change role",
                      description: `Set ${selectedIds.size} users to ${role}?`,
                      variant: "default",
                      action: () => {
                        e.currentTarget.requestSubmit()
                        setSelectedIds(new Set())
                        toast({ message: `${selectedIds.size} user roles updated`, variant: "success" })
                      },
                    })
                  }}
                  className="flex items-center gap-1"
                >
                  {Array.from(selectedIds).map((id) => (
                    <input key={id} type="hidden" name="authUserId" value={id} />
                  ))}
                  <select
                    name="role"
                    defaultValue=""
                    className="h-7 rounded border border-border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="" disabled>Set role...</option>
                    <option value="USER">USER</option>
                    <option value="PHOTOGRAPHER">PHOTOGRAPHER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                  <button type="submit" className="rounded border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted">
                    Apply
                  </button>
                </form>

                {/* Bulk Subscription */}
                <form
                  action={bulkToggleSubscriptionAction}
                  onSubmit={(e) => {
                    e.preventDefault()
                    const fd = new FormData(e.currentTarget)
                    const nextState = String(fd.get("nextState") ?? "")
                    setPendingConfirm({
                      title: nextState === "true" ? "Add subscriptions" : "Remove subscriptions",
                      description: `${nextState === "true" ? "Add" : "Remove"} subscription for ${selectedIds.size} users?`,
                      variant: "default",
                      action: () => {
                        e.currentTarget.requestSubmit()
                        setSelectedIds(new Set())
                        toast({ message: `Subscriptions updated for ${selectedIds.size} users`, variant: "success" })
                      },
                    })
                  }}
                  className="flex items-center gap-1"
                >
                  {Array.from(selectedIds).map((id) => (
                    <input key={id} type="hidden" name="authUserId" value={id} />
                  ))}
                  <select
                    name="nextState"
                    defaultValue=""
                    className="h-7 rounded border border-border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="" disabled>Subscription...</option>
                    <option value="true">Add subscription</option>
                    <option value="false">Remove subscription</option>
                  </select>
                  <button type="submit" className="rounded border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted">
                    Apply
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Toolbar: sort, per-page, count, pagination */}
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

          {/* Pending indicator */}
          {isPending && (
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/3 animate-progress rounded-full bg-primary" />
            </div>
          )}

          {items.length ? (
            <>
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
                      <Th scope="col" filterControl={<HeaderSearchFilter query={query} basePath="/staff/users" />}>User</Th>
                      <Th
                        scope="col"
                        filterControl={
                          <HeaderSelectFilter
                            query={query}
                            name="role"
                            basePath="/staff/users"
                            options={[
                              { value: "", label: "All roles" },
                              { value: "USER", label: "USER" },
                              { value: "PHOTOGRAPHER", label: "PHOTOGRAPHER" },
                              { value: "ADMIN", label: "ADMIN" },
                              { value: "SUPER_ADMIN", label: "SUPER_ADMIN" },
                            ]}
                          />
                        }
                      >
                        Role
                      </Th>
                      <Th
                        scope="col"
                        filterControl={
                          <HeaderSelectFilter
                            query={query}
                            name="status"
                            basePath="/staff/users"
                            options={[
                              { value: "", label: "All" },
                              { value: "ACTIVE", label: "ACTIVE" },
                              { value: "SUSPENDED", label: "SUSPENDED" },
                            ]}
                          />
                        }
                      >
                        Status
                      </Th>
                      <Th
                        scope="col"
                        filterControl={
                          <HeaderSelectFilter
                            query={query}
                            name="isSubscriber"
                            basePath="/staff/users"
                            options={[
                              { value: "", label: "All" },
                              { value: "true", label: "Subscriber" },
                              { value: "false", label: "Non-subscriber" },
                            ]}
                          />
                        }
                      >
                        Subscription
                      </Th>
                      <Th scope="col">Ends</Th>
                      <Th scope="col">Downloads</Th>
                    </tr>
                  </thead>
                  <tbody ref={tableBodyRef} className="divide-y divide-border bg-background">
                    {items.map((user, index) => (
                      <tr
                        key={user.id}
                        data-row-index={index}
                        tabIndex={0}
                        onClick={() => setInspectUserId((prev) => (prev === user.authUserId ? null : user.authUserId))}
                        onFocus={() => setFocusedRowIndex(index)}
                        className={cn(
                          "border-t border-border align-middle transition-colors hover:bg-muted/30 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                          selectedIds.has(user.authUserId) || inspectUserId === user.authUserId ? "bg-primary/5" : "",
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
                        </th>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <form action={updateUserRoleAction}>
                            <input type="hidden" name="authUserId" value={user.authUserId} />
                            <select
                              name="role"
                              defaultValue={user.role}
                              onChange={(e) => {
                                const nextRole = e.target.value
                                if (nextRole === user.role) return
                                if (nextRole === "SUPER_ADMIN" || nextRole === "ADMIN") {
                                  e.preventDefault()
                                  e.target.value = user.role
                                  setPendingConfirm({
                                    title: "Promote user",
                                    description: `Promote ${user.email} to ${nextRole}?`,
                                    variant: "default",
                                    action: () => {
                                      const form = e.target.closest("form")
                                      if (form) {
                                        const fd = new FormData(form)
                                        fd.set("role", nextRole)
                                        updateUserRoleAction(fd)
                                        toast({ message: `Role updated to ${nextRole}`, variant: "success" })
                                      }
                                    },
                                  })
                                  return
                                }
                                e.target.form?.requestSubmit()
                                toast({ message: `Role updated to ${nextRole}`, variant: "success" })
                              }}
                              className="h-7 rounded border border-border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="USER">USER</option>
                              <option value="PHOTOGRAPHER">PHOTOGRAPHER</option>
                              <option value="ADMIN">ADMIN</option>
                              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                            </select>
                          </form>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <form action={updateUserStatusAction}>
                            <input type="hidden" name="authUserId" value={user.authUserId} />
                            <select
                              name="nextStatus"
                              defaultValue={user.status}
                              onChange={(e) => {
                                const nextStatus = e.target.value
                                if (nextStatus === user.status) return
                                e.preventDefault()
                                e.target.value = user.status
                                setPendingConfirm({
                                  title: `${nextStatus === "SUSPENDED" ? "Suspend" : "Activate"} user`,
                                  description: `${nextStatus === "SUSPENDED" ? "Suspend" : "Activate"} ${user.email}?`,
                                  variant: nextStatus === "SUSPENDED" ? "destructive" : "default",
                                  action: () => {
                                    const fd = new FormData()
                                    fd.set("authUserId", user.authUserId)
                                    fd.set("nextStatus", nextStatus)
                                    updateUserStatusAction(fd)
                                    toast({ message: `User ${nextStatus === "SUSPENDED" ? "suspended" : "activated"}`, variant: "success" })
                                  },
                                })
                              }}
                              className="h-7 rounded border border-border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="ACTIVE">Active</option>
                              <option value="SUSPENDED">Suspended</option>
                            </select>
                          </form>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <SubscriptionStatusBadge status={user.subscriptionStatus} />
                            <form
                              action={toggleSubscriptionAction}
                              onSubmit={(e) => {
                                e.preventDefault()
                                const nextState = user.isSubscriber ? "false" : "true"
                                setPendingConfirm({
                                  title: `${user.isSubscriber ? "Remove" : "Add"} subscription`,
                                  description: `${user.isSubscriber ? "Remove" : "Add"} subscription for ${user.email}?`,
                                  variant: "default",
                                  action: () => {
                                    const fd = new FormData()
                                    fd.set("authUserId", user.authUserId)
                                    fd.set("nextState", nextState)
                                    toggleSubscriptionAction(fd)
                                    toast({ message: `Subscription ${user.isSubscriber ? "removed" : "added"}`, variant: "success" })
                                  },
                                })
                              }}
                            >
                              <input type="hidden" name="authUserId" value={user.authUserId} />
                              <input type="hidden" name="nextState" value={user.isSubscriber ? "false" : "true"} />
                              <button
                                type="submit"
                                className={cn(
                                  "text-[11px] font-medium underline",
                                  user.isSubscriber
                                    ? "text-rose-600 hover:text-rose-700"
                                    : "text-emerald-600 hover:text-emerald-700",
                                )}
                              >
                                {user.isSubscriber ? "Remove" : "Add"}
                              </button>
                            </form>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {formatNullableDate(user.subscriptionEndsAt)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs tabular-nums">
                          {formatQuota(user.downloadQuotaUsed, user.downloadQuotaLimit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
              No users found matching the current filters.
            </div>
          )}
        </div>

        {inspectUserId && (
          <div className="w-full lg:w-[40%] lg:shrink-0 lg:sticky lg:top-20">
            <StaffUserDetailSidebar
              authUserId={inspectUserId}
              onClose={() => { setInspectUserId(null); refreshData() }}
              onUpdate={refreshData}
            />
          </div>
        )}
      </div>
    </>
  )
}

function SubscriptionStatusBadge({
  status,
}: {
  status: AdminCatalogUserItem["subscriptionStatus"]
}) {
  const variant = subscriptionVariant(status)
  return (
    <Badge variant={variant} className="text-[10px]">
      {status}
    </Badge>
  )
}

function subscriptionVariant(
  status: AdminCatalogUserItem["subscriptionStatus"],
): "default" | "secondary" | "accent" | "outline" | "muted" | "success" | "warning" | "destructive" {
  switch (status) {
    case "ACTIVE":
      return "success"
    case "EXPIRED":
      return "warning"
    case "SUSPENDED":
      return "destructive"
    case "CANCELLED":
      return "muted"
    default:
      return "outline"
  }
}

function formatNullableDate(date: string | null) {
  if (!date) return "—"
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return "—"
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(parsed)
}

function formatQuota(used: number, limit: number | null) {
  if (limit === null) return String(used)
  return `${used} / ${limit}`
}
