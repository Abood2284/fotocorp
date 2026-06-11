import {
  buildSubmissionAuditDisplayRows,
  type StaffSubmissionAudit,
} from "@/lib/staff/submission-audit-display"

interface SubmissionAuditSectionProps {
  submissionAudit?: StaffSubmissionAudit | null
}

export function SubmissionAuditSection({ submissionAudit }: SubmissionAuditSectionProps) {
  const rows = buildSubmissionAuditDisplayRows(submissionAudit)

  return (
    <section className="rounded-lg border border-border bg-muted/10 p-4">
      <h3 className="text-sm font-semibold text-foreground">Submission audit</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Location is approximate and derived from request/network metadata, not applicant-entered profile data.
      </p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd
              className={
                row.label === "User agent"
                  ? "wrap-break-word font-mono text-xs text-foreground"
                  : "wrap-break-word text-foreground"
              }
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
