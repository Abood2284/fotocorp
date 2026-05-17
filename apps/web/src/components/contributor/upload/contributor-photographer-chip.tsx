"use client"

import { cn } from "@/lib/utils"

interface ContributorPhotographerChipProps {
  displayName: string
  email?: string | null
  className?: string
}

export function ContributorPhotographerChip({ displayName, email, className }: ContributorPhotographerChipProps) {
  const initials = initialsFromName(displayName)

  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-muted/40 py-1 pl-1 pr-3",
        className,
      )}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        aria-hidden
      >
        {initials}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{displayName}</span>
        {email ? <span className="block truncate text-[0.65rem] text-muted-foreground">{email}</span> : null}
      </span>
    </div>
  )
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase()
}
