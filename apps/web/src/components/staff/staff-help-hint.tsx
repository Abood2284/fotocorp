"use client"

import { HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface StaffHelpHintProps {
  /** Short label for screen readers */
  label: string
  /** Guidance shown in the popover */
  body: string
  className?: string
}

export function StaffHelpHint({ label, body, className }: StaffHelpHintProps) {
  return (
    <details className={cn("group relative inline-block align-middle", className)}>
      <summary
        className="inline-flex cursor-pointer list-none items-center rounded p-0.5 text-staff-400 transition-colors hover:text-staff-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <HelpCircle className="h-4 w-4 shrink-0" aria-hidden />
      </summary>
      <div
        role="note"
        className="absolute left-0 top-full z-30 mt-1.5 w-[min(18rem,calc(100vw-2rem))] rounded-md border border-staff-200 bg-white p-3 text-xs font-normal leading-relaxed text-staff-700 shadow-md"
        onClick={(event) => event.stopPropagation()}
      >
        {body}
      </div>
    </details>
  )
}
