"use client"

import { ChevronRight, Loader2 } from "lucide-react"
import { useEffect, useState, useTransition, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"

import type { AdminCatalogUserItem } from "@/features/assets/admin-catalog-types"
import {
  updateUserSubscriptionDetailAction,
  updateUserRoleAction,
  updateUserStatusAction,
  toggleSubscriptionAction,
} from "@/app/(staff)/staff/(workspace)/users/actions"
import { formatAssetInterestType } from "@/lib/staff/access-inquiry-labels"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface StaffUserDetailPanelProps {
  user: AdminCatalogUserItem
}

export function StaffUserDetailPanel({ user }: StaffUserDetailPanelProps) {
  const router = useRouter()
  const [isSaving, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; message: string } | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const initialValues = useRef({ endsAt: "", quotaLimit: "", isUnlimited: false })

  const [endsAt, setEndsAt] = useState("")
  const [quotaLimit, setQuotaLimit] = useState("")
  const [isUnlimited, setIsUnlimited] = useState(false)

  const syncInitialValues = useCallback((nextUser: AdminCatalogUserItem) => {
    const e = nextUser.subscriptionEndsAt ? toDateInput(nextUser.subscriptionEndsAt) : ""
    const unlimited = nextUser.downloadQuotaLimit === null
    const q = unlimited ? "" : (nextUser.downloadQuotaLimit?.toString() ?? "")
    setEndsAt(e)
    setQuotaLimit(q)
    setIsUnlimited(unlimited)
    initialValues.current = { endsAt: e, quotaLimit: q, isUnlimited: unlimited }
    setIsDirty(false)
  }, [])

  useEffect(() => {
    syncInitialValues(user)
  }, [user, syncInitialValues])

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

  const handleSaveSubscription = useCallback(() => {
    startTransition(async () => {
      setFeedback(null)
      const res = await updateUserSubscriptionDetailAction(user.authUserId, {
        subscriptionEndsAt: endsAt ? new Date(endsAt).toISOString() : null,
        downloadQuotaLimit: isUnlimited ? null : (quotaLimit.trim() ? Number(quotaLimit.trim()) : null),
      })
      if (res.success) {
        setIsDirty(false)
        initialValues.current = { endsAt, quotaLimit, isUnlimited }
        setFeedback({ type: "ok", message: "Subscription updated." })
        router.refresh()
      } else {
        setFeedback({ type: "error", message: res.error ?? "Failed to update subscription." })
      }
    })
  }, [user.authUserId, endsAt, quotaLimit, isUnlimited, router])

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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Profile</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Display name" value={user.displayName || "—"} />
            <Row label="Email" value={user.email} />
            <Row label="Username" value={user.username ? `@${user.username}` : "—"} />
            <Row label="Credits used" value={formatQuota(user.downloadQuotaUsed, user.downloadQuotaLimit)} />
            <Row
              label="Created"
              value={user.createdAt ? new Date(user.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—"}
            />
          </dl>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <details open className="group">
            <summary className="mb-3 flex cursor-pointer items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground list-none">
              <ChevronRight size={12} className="transition-transform group-open:rotate-90" />
              Registration
            </summary>
            {user.profile ? (
              <dl className="space-y-2 text-sm">
                <Row label="First name" value={user.profile.firstName ?? "—"} />
                <Row label="Last name" value={user.profile.lastName ?? "—"} />
                <Row label="Company type" value={formatCompanyType(user.profile.companyType)} />
                <Row label="Company name" value={user.profile.companyName ?? "—"} />
                <Row
                  label="Job title"
                  value={
                    user.profile.customJobTitle
                      ? `${user.profile.jobTitle} (${user.profile.customJobTitle})`
                      : (user.profile.jobTitle ?? "—")
                  }
                />
                <Row label="Company email" value={user.profile.companyEmail ?? "—"} />
                <Row label="Phone" value={user.profile.phoneCountryCode && user.profile.phoneNumber ? `${user.profile.phoneCountryCode} ${user.profile.phoneNumber}` : "—"} />
                <Row
                  label="Asset types"
                  value={
                    user.profile.interestedAssetTypes?.length
                      ? user.profile.interestedAssetTypes.map((t) => formatAssetInterestType(t)).join(", ")
                      : "—"
                  }
                />
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">No registration profile.</p>
            )}
          </details>
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Access</h2>
          <div className="mt-4 space-y-3">
            <form action={updateUserRoleAction}>
              <input type="hidden" name="authUserId" value={user.authUserId} />
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs text-muted-foreground shrink-0">Role</label>
                <select
                  name="role"
                  defaultValue={user.role}
                  className="h-8 rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
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
                  className="h-8 rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  onChange={(e) => e.target.form?.requestSubmit()}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>
            </form>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Subscription</span>
              <div className="flex items-center gap-2">
                <SubscriptionStatusBadge status={user.subscriptionStatus} />
                <form action={toggleSubscriptionAction}>
                  <input type="hidden" name="authUserId" value={user.authUserId} />
                  <input type="hidden" name="nextState" value={user.isSubscriber ? "false" : "true"} />
                  <button
                    type="submit"
                    className={cn(
                      "text-[11px] font-medium underline",
                      user.isSubscriber ? "text-rose-600 hover:text-rose-700" : "text-emerald-600 hover:text-emerald-700",
                    )}
                  >
                    {user.isSubscriber ? "Remove" : "Add"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Subscription</h2>
          <div className="mt-4 space-y-3">
            <Row
              label="Started"
              value={user.subscriptionStartedAt ? new Date(user.subscriptionStartedAt).toLocaleDateString("en-US", { dateStyle: "medium" }) : "—"}
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

            {feedback ? (
              <div className={cn("rounded text-xs p-2", feedback.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                {feedback.message}
              </div>
            ) : null}

            <button
              onClick={handleSaveSubscription}
              disabled={isSaving}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" size={12} /> : null}
              Save subscription
            </button>
          </div>
        </section>
      </aside>
    </div>
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

function formatQuota(used: number, limit: number | null) {
  if (limit === null) return String(used)
  return `${used}/${limit}`
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
