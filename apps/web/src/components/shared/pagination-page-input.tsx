"use client"

import { useEffect, useId, useState } from "react"

import { cn } from "@/lib/utils"

interface PaginationPageInputProps {
  currentPage: number
  totalPages: number
  disabled?: boolean
  onGoToPage: (page: number) => void
}

export function validatePaginationPageInput({
  raw,
  currentPage,
  totalPages,
}: {
  raw: string
  currentPage: number
  totalPages: number
}): { ok: true; page: number } | { ok: false; error: string; resetTo: number } {
  const trimmed = raw.trim()

  if (!trimmed) {
    return { ok: false, error: "Enter a page number.", resetTo: currentPage }
  }

  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, error: "Enter a whole number.", resetTo: currentPage }
  }

  const page = Number(trimmed)

  if (page < 1) {
    return { ok: false, error: "Page must be at least 1.", resetTo: currentPage }
  }

  if (page > totalPages) {
    return {
      ok: false,
      error: `Page must be ${totalPages} or less.`,
      resetTo: currentPage,
    }
  }

  return { ok: true, page }
}

export function PaginationPageInput({
  currentPage,
  totalPages,
  disabled,
  onGoToPage,
}: PaginationPageInputProps) {
  const [draft, setDraft] = useState(String(currentPage))
  const [error, setError] = useState<string | null>(null)
  const errorId = useId()

  useEffect(() => {
    setDraft(String(currentPage))
    setError(null)
  }, [currentPage])

  function submitDraft() {
    const result = validatePaginationPageInput({
      raw: draft,
      currentPage,
      totalPages,
    })

    if (!result.ok) {
      setError(result.error)
      setDraft(String(result.resetTo))
      return
    }

    setError(null)
    setDraft(String(result.page))

    if (result.page !== currentPage) {
      onGoToPage(result.page)
    }
  }

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          setError(null)
        }}
        onBlur={submitDraft}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return
          event.preventDefault()
          submitDraft()
          event.currentTarget.blur()
        }}
        disabled={disabled}
        aria-label="Current page"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center border bg-background text-center text-base font-medium text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          error ? "border-destructive" : "border-border",
          disabled && "cursor-not-allowed opacity-50",
        )}
      />
      {error ? (
        <p id={errorId} role="alert" className="max-w-40 text-center text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
