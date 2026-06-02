import { StaffHelpHint } from "@/components/staff/staff-help-hint"
import {
  getAccessInquiriesListGuidance,
  type InquiryStatusFilter,
} from "@/lib/staff/access-inquiry-guidance"

interface StaffAccessInquiriesGuideProps {
  isContributor: boolean
  statusFilter: InquiryStatusFilter
  items: Array<{ status: string }>
}

export function StaffAccessInquiriesGuide({ isContributor, statusFilter, items }: StaffAccessInquiriesGuideProps) {
  const guidance = getAccessInquiriesListGuidance({ isContributor, statusFilter, items })

  return (
    <section className="rounded-lg border border-border bg-muted/30 px-4 py-4 text-sm">
      <h3 className="inline-flex flex-wrap items-center gap-1.5 font-medium text-foreground">
        {guidance.title}
        <StaffHelpHint label={`${guidance.title} help`} body={guidance.summary} />
      </h3>
      <p className="mt-2 leading-relaxed text-muted-foreground">{guidance.summary}</p>
      {guidance.nextSteps.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What to do next</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 leading-relaxed text-foreground">
            {guidance.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  )
}
