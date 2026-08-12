"use client"

import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import {
  getStaffAccessInquiryDetail,
  patchStaffContributorAllowedUploadTypes,
  postStaffApproveContributorApplication,
  StaffApiError,
} from "@/lib/api/staff-api"
import { Button } from "@/components/ui/button"
import { AccessInquiryCloseButton } from "@/components/staff/access-inquiry-close-button"
import { AccessInquiryGuidancePanel } from "@/components/staff/access-inquiry-guidance-panel"
import { InquiryStatusBadge } from "@/components/staff/inquiry-status-badge"
import { SubmissionAuditSection } from "@/components/staff/submission-audit-section"
import { getContributorApplicationDetailGuidance } from "@/lib/staff/access-inquiry-guidance"
import {
  CONTRIBUTOR_UPLOAD_TYPE_OPTIONS,
  normalizeContributorUploadTypes,
  type ContributorUploadType,
} from "@/lib/contributors/allowed-upload-types"

interface StaffContributorApplicationDetailProps {
  inquiryId: string
  initial: Awaited<ReturnType<typeof getStaffAccessInquiryDetail>>
}

export function StaffContributorApplicationDetail({ inquiryId, initial }: StaffContributorApplicationDetailProps) {
  const [detail, setDetail] = useState(initial)
  const [usernameOverride, setUsernameOverride] = useState("")
  const [allowedUploadTypes, setAllowedUploadTypes] = useState<ContributorUploadType[]>(() =>
    normalizeContributorUploadTypes(initial.contributorProfile?.allowedUploadTypes),
  )
  const [approvedCredentials, setApprovedCredentials] = useState<{ username: string; temporaryPassword: string } | null>(
    null,
  )
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const refetchDetail = useCallback(async () => {
    const next = await getStaffAccessInquiryDetail(inquiryId)
    setDetail(next)
    setAllowedUploadTypes(normalizeContributorUploadTypes(next.contributorProfile?.allowedUploadTypes))
  }, [inquiryId])

  const inquiry = detail.inquiry as {
    status?: string
    proposedUsername?: string | null
    applicantEmail?: string | null
    applicantPhoneCountryCode?: string | null
    applicantPhoneNumber?: string | null
    applicationNotes?: string | null
  }

  const status = String(inquiry.status ?? "")
  const canApprove = status !== "CONTRIBUTOR_APPROVED" && status !== "CLOSED"
  const canEditUploadTypes = Boolean(detail.contributorProfile)
  const guidance = getContributorApplicationDetailGuidance({ inquiryStatus: status })
  const uploadTypeSummary = useMemo(
    () =>
      allowedUploadTypes
        .map((value) => CONTRIBUTOR_UPLOAD_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value)
        .join(", "),
    [allowedUploadTypes],
  )

  function toggleUploadType(value: ContributorUploadType) {
    setAllowedUploadTypes((prev) => {
      if (prev.includes(value)) {
        if (prev.length === 1) return prev
        return prev.filter((entry) => entry !== value)
      }
      return normalizeContributorUploadTypes([...prev, value])
    })
  }

  async function handleApprove() {
    setNotice("")
    setError("")
    if (allowedUploadTypes.length === 0) {
      setError("Select at least one upload type.")
      return
    }
    setSaving(true)
    try {
      const result = await postStaffApproveContributorApplication(inquiryId, {
        username: usernameOverride.trim() || undefined,
        allowedUploadTypes,
      })
      setApprovedCredentials({ username: result.username, temporaryPassword: result.temporaryPassword })
      setNotice("Contributor approved. Copy the temporary password now — it is shown only once.")
      await refetchDetail()
    } catch (caught) {
      if (caught instanceof StaffApiError) setError(caught.message)
      else setError("Approval failed.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveUploadTypes() {
    setNotice("")
    setError("")
    if (allowedUploadTypes.length === 0) {
      setError("Select at least one upload type.")
      return
    }
    setSaving(true)
    try {
      const result = await patchStaffContributorAllowedUploadTypes(inquiryId, { allowedUploadTypes })
      setDetail((prev) => ({
        ...prev,
        contributorProfile: result.contributorProfile,
      }))
      setAllowedUploadTypes(normalizeContributorUploadTypes(result.contributorProfile.allowedUploadTypes))
      setNotice("Upload access updated.")
    } catch (caught) {
      if (caught instanceof StaffApiError) setError(caught.message)
      else setError("Could not update upload access.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <AccessInquiryGuidancePanel guidance={guidance} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/staff/access-inquiries?type=CONTRIBUTOR_APPLICATION" className="text-sm text-muted-foreground hover:text-foreground">
            ← Contributor applications
          </Link>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-foreground">{detail.companyName}</h2>
          <p className="text-sm text-muted-foreground">
            {detail.firstName} {detail.lastName}
            {detail.companyEmail ? ` · ${detail.companyEmail}` : ""}
          </p>
        </div>
        {guidance.canClose ? (
          <AccessInquiryCloseButton inquiryId={inquiryId} onClosed={() => void refetchDetail()} />
        ) : null}
      </div>

      <section className="rounded-lg border border-border bg-muted/20 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Application</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium text-foreground">
              <InquiryStatusBadge status={String(inquiry.status ?? "")} isContributor showHint={false} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Proposed username</dt>
            <dd className="font-medium text-foreground">{inquiry.proposedUsername ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Phone</dt>
            <dd>
              {inquiry.applicantPhoneCountryCode || inquiry.applicantPhoneNumber
                ? `+${inquiry.applicantPhoneCountryCode ?? ""} ${inquiry.applicantPhoneNumber ?? ""}`.trim()
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Contributor profile</dt>
            <dd>{detail.contributorProfile?.status ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Upload access</dt>
            <dd className="font-medium text-foreground">{uploadTypeSummary || "—"}</dd>
          </div>
        </dl>
        {inquiry.applicationNotes ? (
          <p className="mt-4 text-sm leading-relaxed text-foreground">{inquiry.applicationNotes}</p>
        ) : null}
      </section>

      <SubmissionAuditSection submissionAudit={detail.submissionAudit} />

      {detail.pendingClaims.length > 0 ? (
        <section className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">Pending claims</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {detail.pendingClaims.map((claim) => (
              <li key={`${claim.claimType}-${claim.normalizedValue}`} className="text-muted-foreground">
                <span className="font-medium text-foreground">{claim.claimType}</span>: {claim.normalizedValue}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canEditUploadTypes ? (
        <section className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Upload access</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose what this contributor may upload. Required before approval; editable anytime after.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {CONTRIBUTOR_UPLOAD_TYPE_OPTIONS.map((option) => {
              const checked = allowedUploadTypes.includes(option.value)
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background px-3 py-3"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={() => toggleUploadType(option.value)}
                    disabled={saving}
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span>
                  </span>
                </label>
              )
            })}
          </div>
          {!canApprove ? (
            <Button type="button" variant="secondary" disabled={saving} onClick={() => void handleSaveUploadTypes()}>
              Save upload access
            </Button>
          ) : null}
        </section>
      ) : null}

      {canApprove ? (
        <section className="rounded-lg border border-border bg-card p-4 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Approve application</h3>
          <p className="text-sm text-muted-foreground">
            Creates portal credentials and activates the contributor profile. The applicant must reset the password on first login.
          </p>
          <label className="flex max-w-sm flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Username override (optional)</span>
            <input
              value={usernameOverride}
              onChange={(event) => setUsernameOverride(event.target.value)}
              placeholder={inquiry.proposedUsername ?? ""}
              className="h-10 rounded-md border border-input bg-background px-3"
            />
          </label>
          <Button type="button" disabled={saving || allowedUploadTypes.length === 0} onClick={() => void handleApprove()}>
            Approve and issue credentials
          </Button>
        </section>
      ) : null}

      {approvedCredentials ? (
        <section className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <h3 className="text-sm font-semibold text-foreground">One-time credentials</h3>
          <dl className="mt-3 grid gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Username</dt>
              <dd className="font-mono font-medium">{approvedCredentials.username}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Temporary password</dt>
              <dd className="font-mono font-medium">{approvedCredentials.temporaryPassword}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-green-700 dark:text-green-400">{notice}</p> : null}
    </div>
  )
}
