"use client"

import { X } from "lucide-react"
import { useEffect, useCallback, type ReactNode } from "react"
import { createPortal } from "react-dom"

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
  size?: "sm" | "md"
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  size = "sm",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    },
    [onCancel],
  )

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [open, handleKeyDown])

  if (!open) return null

  const panelWidth = size === "md" ? "max-w-lg" : "max-w-sm"

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={loading ? undefined : onCancel}
      />
      <div
        className={`relative z-10 w-full ${panelWidth} overflow-hidden rounded-xl border border-border bg-card shadow-2xl`}
      >
        <div className="border-b border-border bg-muted/20 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <h3 id="confirm-dialog-title" className="font-sans text-base font-semibold leading-snug text-foreground">
              {title}
            </h3>
            {!loading ? (
              <button
                type="button"
                onClick={onCancel}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="px-5 py-4 font-sans">
          {children ?? (
            description ? <p className="text-sm leading-relaxed text-muted-foreground">{description}</p> : null
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/10 px-5 py-3.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              variant === "destructive"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {loading ? "Processing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
