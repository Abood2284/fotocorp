"use client"

import { cn } from "@/lib/utils"

interface ContributorUploadLayoutProps {
  left: React.ReactNode
  right: React.ReactNode
  rightLocked?: boolean
}

export function ContributorUploadLayout({ left, right, rightLocked = false }: ContributorUploadLayoutProps) {
  return (
    <div
      className={cn(
        "grid items-start gap-6 lg:grid-cols-12",
        rightLocked && "[&_[data-upload-action]]:opacity-50 [&_[data-upload-action]]:pointer-events-none",
      )}
    >
      <div className="flex flex-col gap-6 lg:col-span-7">{left}</div>
      <div className="flex flex-col gap-4 lg:col-span-5" data-upload-action>
        {right}
      </div>
    </div>
  )
}

export function ContributorUploadStepCard({
  active,
  children,
  className,
}: {
  active: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 shadow-sm transition-opacity",
        active ? "border-border bg-card" : "border-border/60 bg-muted/50 opacity-50",
        className,
      )}
    >
      {children}
    </div>
  )
}
