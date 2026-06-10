"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import {
  getStaffAccessInquiryDetail,
  patchStaffAccessInquiryNotes,
  patchStaffSubscriberEntitlement,
  postStaffAccessInquiryActivateAllEntitlements,
  postStaffAccessInquiryEntitlementDraft,
  postStaffSubscriberEntitlementSuspend,
  StaffApiError,
} from "@/lib/api/staff-api"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/staff/shared/confirm-dialog"
import { EntitlementActivationConfirmBody } from "@/components/staff/entitlement-activation-confirm-body"
import { AccessInquiryCloseButton } from "@/components/staff/access-inquiry-close-button"
import { AccessInquiryGuidancePanel } from "@/components/staff/access-inquiry-guidance-panel"
import { InquiryStatusBadge } from "@/components/staff/inquiry-status-badge"
import { getCustomerAccessDetailGuidance } from "@/lib/staff/access-inquiry-guidance"
import {
  buildAccessInquiryDetailGroups,
  type AccessInquiryDetailField,
  formatAssetInterestType,
  formatEntitlementStatus,
  formatImageQualityPreference,
  formatSubscriberAccessLine,
  summarizeEntitlementsForHeader,
} from "@/lib/staff/access-inquiry-labels"
import { cn } from "@/lib/utils"

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
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState("")
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string
    description?: string
    body?: React.ReactNode
    confirmLabel?: string
    size?: "sm" | "md"
    variant: "default" | "destructive"
    action: () => void | Promise<void>
  } | null>(null)

  type EntitlementRow = {
    id?: string
    status?: string
    assetType?: string
    allowedDownloads?: number | null
    qualityAccess?: string
    downloadsUsed?: number
    updatedAt?: string
    createdAt?: string
  }

  const entitlementRows = detail.entitlements as EntitlementRow[]
  const draftEntitlements = entitlementRows.filter((e) => String(e.status ?? "").toUpperCase() === "DRAFT")
  const draftCount = draftEntitlements.length
  const draftIdKey = draftEntitlements.map((e) => String(e.id ?? "")).join("|")

  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const draftIds = draftEntitlements.map((e) => String(e.id ?? "")).filter(Boolean)
    setSelectedDraftIds((prev) => {
      if (!draftIds.length) return new Set()
      if (prev.size === 0) return new Set(draftIds)
      const next = new Set<string>()
      for (const id of draftIds) {
        if (prev.has(id)) next.add(id)
        else next.add(id)
      }
      return next.size > 0 ? next : new Set(draftIds)
    })
  }, [draftIdKey])

  const selectedCount = draftEntitlements.filter((e) => selectedDraftIds.has(String(e.id ?? ""))).length
  const allDraftsSelected = draftCount > 0 && selectedCount === draftCount

  function toggleDraftSelection(id: string, checked: boolean) {
    setSelectedDraftIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAllDraftSelection() {
    if (allDraftsSelected) {
      setSelectedDraftIds(new Set())
      return
    }
    setSelectedDraftIds(new Set(draftEntitlements.map((e) => String(e.id ?? "")).filter(Boolean)))
  }

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

  function readDraftFormValues(form: HTMLFormElement): {
    allowedDownloads: number | null
    qualityAccess: "LOW" | "MEDIUM" | "HIGH"
    error?: string
  } {
    const allowedRaw = String(new FormData(form).get("allowedDownloads") ?? "").trim()
    const qualityRaw = String(new FormData(form).get("qualityAccess") ?? "MEDIUM")
    const qualityAccess =
      qualityRaw === "LOW" || qualityRaw === "MEDIUM" || qualityRaw === "HIGH" ? qualityRaw : "MEDIUM"

    if (!allowedRaw) {
      return { allowedDownloads: null, qualityAccess, error: "Enter a positive allowed download count." }
    }

    const allowedDownloads = Number(allowedRaw)
    if (!Number.isFinite(allowedDownloads) || allowedDownloads < 1) {
      return { allowedDownloads: null, qualityAccess, error: "Allowed downloads must be a positive number." }
    }

    return { allowedDownloads, qualityAccess }
  }

  async function saveDraftFromForm(entitlementId: string, form: HTMLFormElement) {
    const values = readDraftFormValues(form)
    if (values.error) throw new StaffApiError(400, "INVALID_DRAFT", values.error)

    await patchStaffSubscriberEntitlement(entitlementId, {
      allowedDownloads: values.allowedDownloads,
      qualityAccess: values.qualityAccess,
    })
  }

  type ActivationLine = { assetLabel: string; allowedDownloads: number; qualityLabel: string }

  function collectSelectedDraftActivation(): {
    entitlementIds: string[]
    forms: HTMLFormElement[]
    lines: ActivationLine[]
  } | null {
    setError("")

    if (selectedCount < 1) {
      setError("Select at least one draft entitlement to activate.")
      return null
    }

    const selectedRows = draftEntitlements.filter((row) => selectedDraftIds.has(String(row.id ?? "")))
    const forms = selectedRows
      .map((row) => document.querySelector<HTMLFormElement>(`form[data-draft-entitlement-form="${row.id}"]`))
      .filter((form): form is HTMLFormElement => form !== null)

    if (forms.length !== selectedRows.length) {
      setError("Could not read draft forms. Refresh the page and try again.")
      return null
    }

    const lines: ActivationLine[] = []
    const entitlementIds: string[] = []

    for (const form of forms) {
      const entitlementId = form.dataset.entitlementId ?? ""
      const assetType = form.dataset.assetType ?? ""
      const assetLabel = formatAssetInterestType(assetType)
      const values = readDraftFormValues(form)
      if (values.error) {
        setError(`${assetLabel}: ${values.error}`)
        return null
      }
      entitlementIds.push(entitlementId)
      lines.push({
        assetLabel,
        allowedDownloads: values.allowedDownloads!,
        qualityLabel: formatImageQualityPreference(values.qualityAccess),
      })
    }

    return { entitlementIds, forms, lines }
  }

  async function handleActivateSelectedDrafts(entitlementIds: string[], forms: HTMLFormElement[]) {
    setNotice("")
    setError("")
    setSaving(true)
    try {
      for (const form of forms) {
        const entitlementId = form.dataset.entitlementId
        if (!entitlementId) continue
        await saveDraftFromForm(entitlementId, form)
      }
      await postStaffAccessInquiryActivateAllEntitlements(inquiryId, { entitlementIds })
      const count = entitlementIds.length
      setNotice(
        count === 1
          ? "Entitlement activated. The customer received one email with their limits."
          : `${count} entitlements activated. The customer received one email with every approved limit.`,
      )
      setSelectedDraftIds(new Set())
      await refetchDetail()
    } catch (caught) {
      if (caught instanceof StaffApiError) setError(caught.message)
      else setError("Activation failed.")
    } finally {
      setSaving(false)
    }
  }

  function requestActivateSelectedDrafts() {
    const payload = collectSelectedDraftActivation()
    if (!payload) return

    const { entitlementIds, forms, lines } = payload
    const count = entitlementIds.length

    setPendingConfirm({
      title: count === 1 ? "Activate selected entitlement" : `Activate ${count} entitlements`,
      size: "md",
      confirmLabel: count === 1 ? "Activate & send email" : `Activate ${count} & send email`,
      body: (
        <EntitlementActivationConfirmBody
          intro={
            count === 1
              ? "Grant download access for the selected asset type below."
              : `Grant download access for ${count} selected asset types. Unselected drafts stay inactive.`
          }
          lines={lines}
          emailNote="The customer receives one email with these limits."
        />
      ),
      variant: "default",
      action: () => handleActivateSelectedDrafts(entitlementIds, forms),
    })
  }

  async function handleSuspend(entitlementId: string) {
    setNotice("")
    setError("")
    setPendingConfirm({
      title: "Suspend entitlement",
      description: "Suspend this entitlement? The customer will no longer be able to use it for downloads.",
      variant: "destructive",
      action: async () => {
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
      },
    })
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
      setNotice(status === "ACTIVE" ? "Entitlement updated. The customer has been emailed about any changes." : "Draft saved.")
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
    userId?: string | null
    createdAt?: string | null
    updatedAt?: string | null
    staffNotes?: string | null
    interestedAssetTypes?: string[]
    imageQuantityRange?: string | null
    imageQualityPreference?: string | null
    royaltyFreeQuantityRange?: string | null
    royaltyFreeQualityPreference?: string | null
  }

  const inquiryDetailGroups = buildAccessInquiryDetailGroups({
    inquiry,
    profile: {
      companyType: detail.companyType,
      jobTitle: detail.jobTitle,
      customJobTitle: detail.customJobTitle,
      companyEmail: detail.companyEmail,
      email: detail.email,
      companyEmailDomain: detail.companyEmailDomain,
      phoneCountryCode: detail.phoneCountryCode,
      phoneNumber: detail.phoneNumber,
      emailValidationDecision: detail.emailValidationDecision,
      username: detail.username,
    },
  })

  const staffNotes = String(inquiry.staffNotes ?? "").trim()

  function startEditingNotes() {
    setNotesDraft(staffNotes)
    setEditingNotes(true)
  }

  async function handleSaveNotes() {
    setNotice("")
    setError("")
    setSaving(true)
    try {
      const trimmed = notesDraft.trim()
      await patchStaffAccessInquiryNotes(inquiryId, { staffNotes: trimmed || null })
      setEditingNotes(false)
      setNotice("Staff notes saved.")
      await refetchDetail()
    } catch (caught) {
      if (caught instanceof StaffApiError) setError(caught.message)
      else setError("Could not save staff notes.")
    } finally {
      setSaving(false)
    }
  }

  const userLookupHref =
    detail.companyEmail?.trim()
      ? `/staff/users?q=${encodeURIComponent(detail.companyEmail.trim())}`
      : inquiry.userId
        ? `/staff/users?q=${encodeURIComponent(inquiry.userId)}`
        : null

  const guidance = getCustomerAccessDetailGuidance({
    inquiryStatus: String(inquiry.status ?? "PENDING"),
    entitlements: detail.entitlements as Array<{ status?: string | null }>,
  })

  return (
    <div className="space-y-8">
      <ConfirmDialog
        open={!!pendingConfirm}
        title={pendingConfirm?.title ?? ""}
        description={pendingConfirm?.description}
        size={pendingConfirm?.size}
        confirmLabel={pendingConfirm?.confirmLabel}
        variant={pendingConfirm?.variant ?? "default"}
        loading={saving}
        onConfirm={() => {
          void pendingConfirm?.action()
          setPendingConfirm(null)
        }}
        onCancel={() => setPendingConfirm(null)}
      >
        {pendingConfirm?.body}
      </ConfirmDialog>

      <AccessInquiryGuidancePanel guidance={guidance} />

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
        <div className="flex flex-wrap items-center gap-2">
          {guidance.canClose ? (
            <AccessInquiryCloseButton inquiryId={inquiryId} onClosed={() => void refetchDetail()} />
          ) : null}
          {!hasAnyEntitlement && inquiry.status !== "CLOSED" ? (
            <Button type="button" disabled={saving} onClick={() => void handleCreateDraft()}>
              Generate entitlement draft
            </Button>
          ) : null}
        </div>
      </div>

      <section className="rounded-lg border border-border bg-muted/20 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status overview</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Inquiry</dt>
            <dd className="font-medium text-foreground">
              <InquiryStatusBadge status={String(inquiry.status ?? "")} isContributor={false} showHint={false} />
            </dd>
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Inquiry details</h3>
          {userLookupHref ? (
            <Link href={userLookupHref} className="text-xs text-muted-foreground hover:text-foreground">
              View user account →
            </Link>
          ) : null}
        </div>
        {inquiryDetailGroups.length > 0 ? (
          <div className="mt-3 space-y-5">
            {inquiryDetailGroups.map((group) => (
              <div key={group.id}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  {group.fields.map((field) => (
                    <div key={`${group.id}-${field.label}`}>
                      <dt className="text-muted-foreground">{field.label}</dt>
                      <dd className="wrap-break-word">
                        <InquiryDetailFieldValue field={field} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No additional inquiry details on file.</p>
        )}

        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Staff notes</p>
            {!editingNotes ? (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                disabled={saving}
                onClick={startEditingNotes}
              >
                {staffNotes ? "Edit" : "Add note"}
              </button>
            ) : null}
          </div>

          {editingNotes ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Internal notes for staff review…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={saving} onClick={() => void handleSaveNotes()}>
                  Save notes
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    setEditingNotes(false)
                    setNotesDraft(staffNotes)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : staffNotes ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{staffNotes}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No notes yet.</p>
          )}
        </div>
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-green-700 dark:text-green-400">{notice}</p> : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Entitlements</h3>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              Check the asset types to grant, set download limits, then activate — one email covers everything selected.
            </p>
          </div>
          {draftCount > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={toggleAllDraftSelection}>
                {allDraftsSelected ? "Clear selection" : "Select all"}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={saving || selectedCount < 1}
                onClick={() => requestActivateSelectedDrafts()}
              >
                {selectedCount === 1
                  ? "Activate selected & send 1 email"
                  : `Activate ${selectedCount} selected & send 1 email`}
              </Button>
            </div>
          ) : null}
        </div>
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

              const isDraftSelected = status === "DRAFT" && selectedDraftIds.has(id)

              return (
                <li
                  key={id}
                  className={`rounded-lg border bg-card p-4 ${isDraftSelected ? "border-primary/40 ring-1 ring-primary/20" : "border-border"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {status === "DRAFT" ? (
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input"
                          checked={isDraftSelected}
                          disabled={saving}
                          aria-label={`Include ${formatAssetInterestType(assetType)} in activation`}
                          onChange={(ev) => toggleDraftSelection(id, ev.target.checked)}
                        />
                      ) : null}
                      <span className="font-medium">{formatAssetInterestType(assetType)}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
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
                      data-draft-entitlement-form={id}
                      data-entitlement-id={id}
                      data-asset-type={assetType}
                      className="mt-4 flex flex-wrap items-end gap-3"
                      onSubmit={(ev) => ev.preventDefault()}
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
                    </form>
                  ) : null}

                  {status === "ACTIVE" && !isAdjusting ? (
                    <div className="mt-4 space-y-3">
                      {limitNum !== null ? (
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">
                              {used} used of {limitNum}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                                {formatImageQualityPreference(quality)} cap
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {Math.min(100, Math.round((used / limitNum) * 100))}%
                              </span>
                            </div>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-muted">
                            <div
                              className="h-1.5 rounded-full bg-primary"
                              style={{ width: `${Math.min(100, Math.round((used / limitNum) * 100))}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <dl className="grid gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="text-muted-foreground">Allowed downloads</dt>
                            <dd className="font-medium">—</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Quality cap</dt>
                            <dd className="font-medium">{formatImageQualityPreference(quality)}</dd>
                          </div>
                        </dl>
                      )}
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

                  {(assetType === "EDITORIAL" || assetType === "IMAGE") &&
                  inquiry.imageQuantityRange === "250_plus" &&
                  !allowed &&
                  status === "DRAFT" ? (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                      250+ editorial range: enter an exact allowed download count before activating.
                    </p>
                  ) : null}
                  {assetType === "ROYALTY_FREE" &&
                  inquiry.royaltyFreeQuantityRange === "250_plus" &&
                  !allowed &&
                  status === "DRAFT" ? (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                      250+ royalty-free range: enter an exact allowed download count before activating.
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

function InquiryDetailFieldValue({ field }: { field: AccessInquiryDetailField }) {
  if (field.kind === "assetChips" && field.chipValues?.length) {
    return (
      <div className="mt-0.5 flex flex-wrap gap-1.5">
        {field.chipValues.map((chip) => (
          <span
            key={chip}
            className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
          >
            {chip}
          </span>
        ))}
      </div>
    )
  }

  if (field.kind === "emailValidation") {
    const decision = field.value.trim().toUpperCase()
    const tone =
      decision === "ALLOW"
        ? "text-green-700 dark:text-green-400"
        : decision === "DENY"
          ? "text-destructive"
          : "text-amber-700 dark:text-amber-400"

    return (
      <span className={cn("inline-flex items-center gap-1.5 font-medium", tone)}>
        <span aria-hidden="true">●</span>
        {field.value}
      </span>
    )
  }

  if (field.href) {
    return (
      <Link href={field.href} className="text-foreground hover:text-muted-foreground">
        {field.value}
      </Link>
    )
  }

  return (
    <span title={field.kind === "datetime" ? field.title : undefined} className="cursor-default">
      {field.value}
    </span>
  )
}
