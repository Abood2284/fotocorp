export interface StaffSubmissionAudit {
  ipAddress?: string | null
  ipHash?: string | null
  country?: string | null
  city?: string | null
  region?: string | null
  regionCode?: string | null
  cfRay?: string | null
  userAgent?: string | null
}

export interface SubmissionAuditDisplayRow {
  label: string
  value: string
}

export function formatSubmissionAuditValue(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : "—"
}

export function buildSubmissionAuditDisplayRows(
  submissionAudit: StaffSubmissionAudit | null | undefined,
): SubmissionAuditDisplayRow[] {
  const audit = submissionAudit ?? {}
  const rows: SubmissionAuditDisplayRow[] = [
    { label: "Country", value: formatSubmissionAuditValue(audit.country) },
    { label: "City", value: formatSubmissionAuditValue(audit.city) },
    { label: "Region", value: formatSubmissionAuditValue(audit.region) },
    { label: "Region code", value: formatSubmissionAuditValue(audit.regionCode) },
    { label: "IP address", value: formatSubmissionAuditValue(audit.ipAddress) },
  ]

  if (audit.ipHash?.trim()) {
    rows.push({ label: "IP hash", value: audit.ipHash.trim() })
  }

  rows.push(
    { label: "CF-Ray", value: formatSubmissionAuditValue(audit.cfRay) },
    { label: "User agent", value: formatSubmissionAuditValue(audit.userAgent) },
  )

  return rows
}

export function submissionAuditSectionHasValues(submissionAudit: StaffSubmissionAudit | null | undefined): boolean {
  return buildSubmissionAuditDisplayRows(submissionAudit).some((row) => row.value !== "—")
}
