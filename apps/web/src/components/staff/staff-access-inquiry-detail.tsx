"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import {
  getStaffAccessInquiryDetail,
  patchStaffSubscriberEntitlement,
  postStaffAccessInquiryEntitlementDraft,
  postStaffSubscriberEntitlementActivate,
  postStaffSubscriberEntitlementSuspend,
  StaffApiError,
} from "@/lib/api/staff-api"
import { Button } from "@/components/ui/button"
import {
  formatAssetInterestType,
  formatEntitlementStatus,
  formatImageQualityPreference,
  formatImageQuantityRange,
  formatInquiryStatus,
  formatSubscriberAccessLine,
  summarizeEntitlementsForHeader,
} from "@/lib/staff/access-inquiry-labels"

interface StaffAccessInquiryDetailProps {
  inquiryId: string
  initial: Awaited<ReturnType<typeof getStaffAccessInquiryDetail>>
}

export function StaffAccessInquiryDetail({ inquiryId, initial }: StaffAccessInquiryDetailProps) {
  const router = useRouter()
  const [detail, setDetail] = useState(initial)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [adjustEntitlementId, setAdjustEntitlementId] = useState<string | null>(null)

  const refetchDetail = useCallback(async () => {
    const next = await getStaffAccessInquiryDetail(inquiryId)
    setDetail(next)
    router.refresh()
  }, [inquiryId, router])

  const hasAnyEntitlement = detail.entitlements.length > 0

  async function handleCreateDraft() {
    setNotice("")
    setError("")
    setSaving(true)
    try {
      await postStaffAccessInquiryEntitlementDraft(inquiryId)
      setNotice("Draft entitlements created.")
      await refetchDetail()
    } catch (caught) {
      if (caught instanceof StaffApiError) setError(caught.message)
      else setError("Draft creation failed.")
    } finally {
      setSaving(false)
    }
  }

  async function handleActivate(entitlementId: string) {
    setNotice("")
    setError("")
    setSaving(true)
    try {
      await postStaffSubscriberEntitlementActivate(entitlementId, {})
      setNotice("Entitlement activated.")
      setAdjustEntitlementId(null)
      await refetchDetail()
    } catch (caught) {
      if (caught instanceof StaffApiError) setError(caught.message)
      else setError("Activation failed.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSuspend(entitlementId: string) {
    setNotice("")
    setError("")
    if (!globalThis.confirm("Suspend this entitlement? The customer will no longer be able to use it for downloads.")) return
    setSaving(true)
    try {
      await postStaffSubscriberEntitlementSuspend(entitlementId)
      setNotice("Entitlement suspended.")
      setAdjustEntitlementId(null)
      await refetchDetail()
    } catch (caught) {
      if (caught instanceof StaffApiError) setError(caught.message)
      else setError("Suspend failed.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEntitlement(entitlementId: string, status: string, form: FormData) {
    setNotice("")
    setError("")
    const allowedRaw = String(form.get("allowedDownloads") ?? "").trim()
    const allowedDownloads = allowedRaw === "" ? undefined : Number(allowedRaw)
    if (allowedRaw !== "" && !Number.isFinite(allowedDownloads)) {
      setError("Allowed downloads must be a number.")
      return
    }
    const qualityAccess = String(form.get("qualityAccess") ?? "") as "LOW" | "MEDIUM" | "HIGH"
    setSaving(true)
    try {
      await patchStaffSubscriberEntitlement(entitlementId, {
        allowedDownloads: allowedRaw === "" ? undefined : allowedDownloads,
        qualityAccess: qualityAccess === "LOW" || qualityAccess === "MEDIUM" || qualityAccess === "HIGH" ? qualityAccess : undefined,
      })
      setNotice(status === "ACTIVE" ? "Entitlement updated." : "Draft saved.")
      setAdjustEntitlementId(null)
      await refetchDetail()
    } catch (caught) {
      if (caught instanceof StaffApiError) setError(caught.message)
      else setError("Save failed.")
    } finally {
      setSaving(false)
    }
  }

  const inquiry = detail.inquiry as {
    id?: string
    status?: string
    interestedAssetTypes?: string[]
    imageQuantityRange?: string | null
    imageQualityPreference?: string | null
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/staff/access-inquiries" className="text-sm text-muted-foreground hover:text-foreground">
            ← All inquiries
          </Link>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-foreground">{detail.companyName}</h2>
          <p className="text-sm text-muted-foreground">
            {detail.firstName} {detail.lastName} · {detail.companyEmail}
          </p>
        </div>
        {!hasAnyEntitlement ? (
          <Button type="button" disabled={saving} onClick={() => void handleCreateDraft()}>
            Generate entitlement draft
          </Button>
        ) : null}
      </div>

      <section className="rounded-lg border border-border bg-muted/20 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status overview</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Inquiry</dt>
            <dd className="font-medium text-foreground">{formatInquiryStatus(inquiry.status)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Access</dt>
            <dd className="font-medium text-foreground">{formatSubscriberAccessLine(detail.subscriberAccess)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Entitlements</dt>
            <dd className="font-medium text-foreground">{summarizeEntitlementsForHeader(detail.entitlements as { status?: string }[])}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Inquiry details</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Workflow status</dt>
            <dd>{formatInquiryStatus(inquiry.status)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Job title</dt>
            <dd>{detail.jobTitle}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Company type</dt>
            <dd>{detail.companyType}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Asset interests</dt>
            <dd>{(inquiry.interestedAssetTypes ?? []).map((t) => formatAssetInterestType(t)).join(", ") || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Image quantity</dt>
            <dd>{formatImageQuantityRange(inquiry.imageQuantityRange)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Image quality</dt>
            <dd>{formatImageQualityPreference(inquiry.imageQualityPreference)}</dd>
          </div>
        </dl>
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-green-700 dark:text-green-400">{notice}</p> : null}

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Entitlements</h3>
        {!hasAnyEntitlement ? (
          <p className="text-sm text-muted-foreground">No entitlement rows yet. Use &quot;Generate entitlement draft&quot;.</p>
        ) : (
          <ul className="space-y-4">
            {detail.entitlements.map((raw) => {
              const e = raw as Record<string, unknown>
              const id = String(e.id ?? "")
              const status = String(e.status ?? "")
              const assetType = String(e.assetType ?? "")
              const allowed = e.allowedDownloads === null || e.allowedDownloads === undefined ? "" : String(e.allowedDownloads)
              const quality = String(e.qualityAccess ?? "MEDIUM")
              const used = Number(e.downloadsUsed ?? 0)
              const limitNum =
                e.allowedDownloads === null || e.allowedDownloads === undefined ? null : Number(e.allowedDownloads)
              const updatedAt = String(e.updatedAt ?? e.createdAt ?? id)
              const isAdjusting = adjustEntitlementId === id

              return (
                <li key={id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">{formatAssetInterestType(assetType)}</span>
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                        {formatEntitlementStatus(status)}
                      </span>
                    </div>
                    {status === "ACTIVE" && limitNum !== null ? (
                      <span className="text-sm text-muted-foreground">
                        Used: {used} / {limitNum}
                      </span>
                    ) : status === "DRAFT" ? (
                      <span className="text-xs text-muted-foreground">Draft — not active yet</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Used: {used}</span>
                    )}
                  </div>

                  {status === "DRAFT" ? (
                    <form
                      key={`${id}-${updatedAt}`}
                      className="mt-4 flex flex-wrap items-end gap-3"
                      onSubmit={(ev) => {
                        ev.preventDefault()
                        void handleSaveEntitlement(id, "DRAFT", new FormData(ev.currentTarget))
                      }}
                    >
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="text-muted-foreground">Allowed downloads</span>
                        <input
                          name="allowedDownloads"
                          defaultValue={allowed}
                          className="h-9 w-32 rounded-md border border-input bg-background px-2 text-sm"
                          placeholder="e.g. 20"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="text-muted-foreground">Quality cap</span>
                        <select name="qualityAccess" defaultValue={quality} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                        </select>
                      </label>
                      <Button type="submit" variant="secondary" size="sm" disabled={saving}>
                        Save draft
                      </Button>
                      <Button type="button" size="sm" disabled={saving} onClick={() => void handleActivate(id)}>
                        Activate entitlement
                      </Button>
                    </form>
                  ) : null}

                  {status === "ACTIVE" && !isAdjusting ? (
                    <div className="mt-4 space-y-3">
                      <dl className="grid gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-muted-foreground">Allowed downloads</dt>
                          <dd className="font-medium">{limitNum ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Quality cap</dt>
                          <dd className="font-medium">{formatImageQualityPreference(quality)}</dd>
                        </div>
                      </dl>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => setAdjustEntitlementId(id)}>
                          Adjust entitlement
                        </Button>
                        <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void handleSuspend(id)}>
                          Suspend access
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {status === "ACTIVE" && isAdjusting ? (
                    <form
                      key={`adjust-${id}-${updatedAt}`}
                      className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4"
                      onSubmit={(ev) => {
                        ev.preventDefault()
                        void handleSaveEntitlement(id, "ACTIVE", new FormData(ev.currentTarget))
                      }}
                    >
                      <p className="w-full text-xs text-muted-foreground">Editing an active entitlement. Values must stay at or above downloads already used.</p>
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="text-muted-foreground">Allowed downloads</span>
                        <input
                          name="allowedDownloads"
                          defaultValue={allowed}
                          required
                          className="h-9 w-32 rounded-md border border-input bg-background px-2 text-sm"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="text-muted-foreground">Quality cap</span>
                        <select name="qualityAccess" defaultValue={quality} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                        </select>
                      </label>
                      <Button type="submit" variant="secondary" size="sm" disabled={saving}>
                        Save changes
                      </Button>
                      <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => setAdjustEntitlementId(null)}>
                        Cancel
                      </Button>
                    </form>
                  ) : null}

                  {status !== "DRAFT" && status !== "ACTIVE" ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      This row is {formatEntitlementStatus(status).toLowerCase()}. No edits from this screen.
                    </p>
                  ) : null}

                  {assetType === "IMAGE" && inquiry.imageQuantityRange === "250_plus" && !allowed && status === "DRAFT" ? (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                      250+ range: enter an exact allowed download count before activating.
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
