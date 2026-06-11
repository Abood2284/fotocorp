"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import {
  getStaffAccessInquiryDetail,
  postStaffApproveContributorApplication,
  StaffApiError,
} from "@/lib/api/staff-api"
import { Button } from "@/components/ui/button"
import { AccessInquiryCloseButton } from "@/components/staff/access-inquiry-close-button"
import { AccessInquiryGuidancePanel } from "@/components/staff/access-inquiry-guidance-panel"
import { InquiryStatusBadge } from "@/components/staff/inquiry-status-badge"
import { SubmissionAuditSection } from "@/components/staff/submission-audit-section"
import { formatInquiryStatus } from "@/lib/staff/access-inquiry-labels"
import { getContributorApplicationDetailGuidance } from "@/lib/staff/access-inquiry-guidance"

interface StaffContributorApplicationDetailProps {
  inquiryId: string
  initial: Awaited<ReturnType<typeof getStaffAccessInquiryDetail>>
}

export function StaffContributorApplicationDetail({ inquiryId, initial }: StaffContributorApplicationDetailProps) {
  const router = useRouter()
  const [detail, setDetail] = useState(initial)
  const [usernameOverride, setUsernameOverride] = useState("")
  const [approvedCredentials, setApprovedCredentials] = useState<{ username: string; temporaryPassword: string } | null>(
    null,
  )
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const refetchDetail = useCallback(async () => {
    const next = await getStaffAccessInquiryDetail(inquiryId)
    setDetail(next)
    router.refresh()
  }, [inquiryId, router])

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
  const guidance = getContributorApplicationDetailGuidance({ inquiryStatus: status })

  async function handleApprove() {
    setNotice("")
    setError("")
    setSaving(true)
    try {
      const result = await postStaffApproveContributorApplication(inquiryId, {
        username: usernameOverride.trim() || undefined,
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
          <Button type="button" disabled={saving} onClick={() => void handleApprove()}>
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
