"use client"

import { CalendarDays } from "lucide-react"
import { uploadInputClass } from "@/components/contributor/upload/contributor-upload-field-styles"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface ContributorUploadGlassDateProps {
  id: string
  value: string
  disabled?: boolean
  onChange: (value: string) => void
  className?: string
}

export function ContributorUploadGlassDate({
  id,
  value,
  disabled,
  onChange,
  className,
}: ContributorUploadGlassDateProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-white/50 bg-white/55 shadow-sm backdrop-blur-md",
        "ring-1 ring-border/80 transition-[box-shadow,border-color] focus-within:border-primary/35 focus-within:ring-primary/25",
        "dark:border-white/10 dark:bg-white/10",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/70 via-white/20 to-primary-wash/40 opacity-90"
        aria-hidden
      />
      <div className="relative flex items-center gap-2 px-3 py-1 sm:px-4">
        <CalendarDays className="h-5 w-5 shrink-0 text-primary/80 sm:h-5 sm:w-5" aria-hidden />
        <Input
          id={id}
          type="date"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          required
          className={cn(
            uploadInputClass,
            "border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
            "[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70",
          )}
        />
      </div>
    </div>
  )
}
