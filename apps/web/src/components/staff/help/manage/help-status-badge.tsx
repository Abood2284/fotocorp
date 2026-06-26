import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface HelpStatusBadgeProps {
  status: string
  className?: string
}

export function HelpStatusBadge({ status, className }: HelpStatusBadgeProps) {
  const label = status.replaceAll("_", " ")
  const variant =
    status === "PUBLISHED" ? "success" : status === "DRAFT" ? "warning" : status === "ARCHIVED" ? "muted" : "outline"

  return (
    <Badge variant={variant} className={cn("rounded-none uppercase tracking-wide", className)} aria-label={`Status: ${label}`}>
      {label}
    </Badge>
  )
}
