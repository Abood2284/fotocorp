"use client"

import { X, Loader2, ChevronRight } from "lucide-react"
import { useEffect, useState, useTransition, useRef, useCallback } from "react"

import type { AdminCatalogUserItem } from "@/features/assets/admin-catalog-types"
import {
  fetchAdminUserAction,
  updateUserSubscriptionDetailAction,
  updateUserRoleAction,
  updateUserStatusAction,
} from "@/app/(staff)/staff/(workspace)/users/actions"
import { ConfirmDialog } from "@/components/staff/shared/confirm-dialog"

interface StaffUserDetailSidebarProps {
  authUserId: string
  onClose: () => void
  onUpdate: () => void
}

export function StaffUserDetailSidebar({ authUserId, onClose, onUpdate }: StaffUserDetailSidebarProps) {
  const [user, setUser] = useState<AdminCatalogUserItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; message: string } | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [pendingClose, setPendingClose] = useState(false)
  const initialValues = useRef({ endsAt: "", quotaLimit: "", isUnlimited: false })

  const [endsAt, setEndsAt] = useState("")
  const [quotaLimit, setQuotaLimit] = useState("")
  const [isUnlimited, setIsUnlimited] = useState(false)

  const syncInitialValues = useCallback((u: AdminCatalogUserItem) => {
    const e = u.subscriptionEndsAt ? toDateInput(u.subscriptionEndsAt) : ""
    const unlimited = u.downloadQuotaLimit === null
    const q = unlimited ? "" : (u.downloadQuotaLimit?.toString() ?? "")
    setEndsAt(e)
    setQuotaLimit(q)
    setIsUnlimited(unlimited)
    initialValues.current = { endsAt: e, quotaLimit: q, isUnlimited: unlimited }
    setIsDirty(false)
  }, [])

  useEffect(() => {
    let mounted = true
    setIsLoading(true)
    fetchAdminUserAction(authUserId).then((res) => {
      if (mounted && res?.user) {
        setUser(res.user)
        syncInitialValues(res.user)
      }
      if (mounted) setIsLoading(false)
    }).catch(() => {
      if (mounted) setIsLoading(false)
    })
    return () => { mounted = false }
  }, [authUserId, syncInitialValues])

  useEffect(() => {
    const dirty =
      endsAt !== initialValues.current.endsAt ||
      quotaLimit !== initialValues.current.quotaLimit ||
      isUnlimited !== initialValues.current.isUnlimited
    setIsDirty(dirty)
  }, [endsAt, quotaLimit, isUnlimited])

  useEffect(() => {
    setFeedback(null)
  }, [endsAt, quotaLimit, isUnlimited])

  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (feedback?.type === "ok") {
      feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), 4000)
      return () => {
        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
      }
    }
  }, [feedback])

  const handleSaveSubscription = useCallback(() => {
    startTransition(async () => {
      setFeedback(null)
      const res = await updateUserSubscriptionDetailAction(authUserId, {
        subscriptionEndsAt: endsAt ? new Date(endsAt).toISOString() : null,
        downloadQuotaLimit: isUnlimited ? null : (quotaLimit.trim() ? Number(quotaLimit.trim()) : null),
      })
      if (res.success) {
        setIsDirty(false)
        initialValues.current = { endsAt, quotaLimit, isUnlimited }
        setFeedback({ type: "ok", message: "Subscription updated." })
        onUpdate()
      } else {
        setFeedback({ type: "error", message: res.error ?? "Failed to update subscription." })
      }
    })
  }, [authUserId, endsAt, quotaLimit, isUnlimited, onUpdate])

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!isDirty) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      handleSaveSubscription()
    }, 800)
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [isDirty, handleSaveSubscription])

  const handleClose = () => {
    if (isDirty) {
      setPendingClose(true)
    } else {
      onClose()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">User not found.</p>
      </div>
    )
  }

  return (
    <>
      <ConfirmDialog
        open={pendingClose}
        title="Discard changes?"
        description="You have unsaved changes to the subscription. Discard them?"
        variant="default"
        onConfirm={() => {
          setPendingClose(false)
          setIsDirty(false)
          onClose()
        }}
        onCancel={() => setPendingClose(false)}
      />

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {user.displayName || "Unnamed user"}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{user.email}</p>
          </div>
          <button onClick={handleClose} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {/* Profile section — editable role + status */}
          <section>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile</h4>
            <div className="space-y-3 text-sm">
              <form action={updateUserRoleAction}>
                <input type="hidden" name="authUserId" value={user.authUserId} />
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs text-muted-foreground shrink-0">Role</label>
                  <select
                    name="role"
                    defaultValue={user.role}
                    className="h-7 rounded border border-border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    onChange={(e) => e.target.form?.requestSubmit()}
                  >
                    <option value="USER">USER</option>
                    <option value="PHOTOGRAPHER">PHOTOGRAPHER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </div>
              </form>
              <form action={updateUserStatusAction}>
                <input type="hidden" name="authUserId" value={user.authUserId} />
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs text-muted-foreground shrink-0">Status</label>
                  <select
                    name="nextStatus"
                    defaultValue={user.status}
                    className="h-7 rounded border border-border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    onChange={(e) => e.target.form?.requestSubmit()}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                  </select>
                </div>
              </form>
              <Row label="Subscriber" value={user.isSubscriber ? "Yes" : "No"} />
              <Row
                label="Created"
                value={user.createdAt ? new Date(user.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—"}
              />
              <Row
                label="Updated"
                value={user.updatedAt ? new Date(user.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—"}
              />
            </div>
          </section>

          {/* Registration section — collapsible */}
          <section>
            <details open className="group">
              <summary className="mb-3 flex cursor-pointer items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground list-none">
                <ChevronRight size={12} className="transition-transform group-open:rotate-90" />
                Registration
                <span className="ml-auto text-[10px] font-normal normal-case text-muted-foreground">
                  {user.profile ? "14 fields" : "No data"}
                </span>
              </summary>
              {user.profile ? (
                <dl className="space-y-2 text-sm">
                  <Row label="First name" value={user.profile.firstName ?? "—"} />
                  <Row label="Last name" value={user.profile.lastName ?? "—"} />
                  <Row label="Username" value={user.profile.username ?? "—"} />
                  <Row label="Company type" value={formatCompanyType(user.profile.companyType)} />
                  <Row label="Company name" value={user.profile.companyName ?? "—"} />
                  <Row
                    label="Job title"
                    value={user.profile.customJobTitle ? `${user.profile.jobTitle} (${user.profile.customJobTitle})` : (user.profile.jobTitle ?? "—")}
                  />
                  <Row label="Company email" value={user.profile.companyEmail ?? "—"} />
                  <Row label="Email domain" value={user.profile.companyEmailDomain ?? "—"} />
                  <Row label="Phone" value={user.profile.phoneCountryCode && user.profile.phoneNumber ? `${user.profile.phoneCountryCode} ${user.profile.phoneNumber}` : "—"} />
                  <Row label="Email validation" value={user.profile.emailValidationDecision ?? "—"} />
                  <Row label="Asset types" value={user.profile.interestedAssetTypes?.length ? user.profile.interestedAssetTypes.join(", ") : "—"} />
                  <Row label="Quality preference" value={user.profile.imageQualityPreference ?? "—"} />
                  <Row label="Quantity range" value={user.profile.imageQuantityRange ?? "—"} />
                </dl>
              ) : (
                <p className="text-xs text-muted-foreground">No registration profile.</p>
              )}
            </details>
          </section>

          {/* Subscription section */}
          <section>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subscription</h4>
            <div className="space-y-3">
              <Row label="Status" value={user.subscriptionStatus} />
              <Row
                label="Started at"
                value={user.subscriptionStartedAt ? new Date(user.subscriptionStartedAt).toLocaleString("en-US", { dateStyle: "medium" }) : "—"}
              />
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Ends at</label>
                <input
                  type="date"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="h-8 w-full rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Download quota limit</label>
                <input
                  type="text"
                  value={quotaLimit}
                  onChange={(e) => setQuotaLimit(e.target.value)}
                  placeholder="e.g. 100"
                  disabled={isUnlimited}
                  className="h-8 w-full rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
                />
                <label className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={isUnlimited}
                    onChange={(e) => {
                      setIsUnlimited(e.target.checked)
                      if (e.target.checked) setQuotaLimit("")
                    }}
                  />
                  Unlimited downloads
                </label>
              </div>
              <Row
                label="Downloads used"
                value={user.downloadQuotaLimit === null ? String(user.downloadQuotaUsed) : `${user.downloadQuotaUsed} / ${user.downloadQuotaLimit}`}
              />

              {feedback && (
                <div className={`rounded text-xs p-2 ${feedback.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {feedback.message}
                </div>
              )}

              <button
                onClick={handleSaveSubscription}
                disabled={isSaving}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSaving && <Loader2 className="animate-spin" size={12} />}
                Save subscription
              </button>
            </div>
          </section>

          <section className="border-t border-border pt-4">
            <Row label="Auth User ID" value={user.authUserId} />
          </section>
        </div>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-xs text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-xs text-foreground text-right break-all">{value}</dd>
    </div>
  )
}

function toDateInput(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch {
    return ""
  }
}

function formatCompanyType(value: string | null): string {
  if (!value) return "—"
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
