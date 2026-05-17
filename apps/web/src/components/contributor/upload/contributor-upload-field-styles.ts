import { cn } from "@/lib/utils"

export const uploadFieldLabelClass = "text-sm font-medium text-foreground sm:text-base"

export const uploadSelectClass = cn(
  "flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm sm:h-12 sm:text-base",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "disabled:cursor-default disabled:opacity-100",
)

export const uploadInputClass = cn(
  "h-11 text-sm sm:h-12 sm:text-base",
)
