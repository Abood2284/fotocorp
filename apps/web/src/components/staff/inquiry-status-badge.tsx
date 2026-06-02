import { Badge } from "@/components/ui/badge"
import { StaffHelpHint } from "@/components/staff/staff-help-hint"
import { formatInquiryStatus } from "@/lib/staff/access-inquiry-labels"
import { getInquiryRowHint, inquiryStatusBadgeVariant } from "@/lib/staff/access-inquiry-guidance"
import { cn } from "@/lib/utils"

interface InquiryStatusBadgeProps {
  status: string
  isContributor: boolean
  showHint?: boolean
  className?: string
}

export function InquiryStatusBadge({ status, isContributor, showHint = true, className }: InquiryStatusBadgeProps) {
  const label = formatInquiryStatus(status)
  const hint = getInquiryRowHint({ isContributor, status })

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Badge variant={inquiryStatusBadgeVariant(status)}>{label}</Badge>
      {showHint ? <StaffHelpHint label={`${label} status`} body={hint} /> : null}
    </span>
  )
}
