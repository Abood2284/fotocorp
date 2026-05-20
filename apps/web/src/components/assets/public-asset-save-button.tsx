"use client"

import { Check, Loader2, Plus } from "lucide-react"
import { useState } from "react"
import type React from "react"

import { cn } from "@/lib/utils"

interface PublicAssetSaveButtonProps {
  assetId: string
  compact?: boolean
  compactLabel?: string
  /** Placeholder — no API call (e.g. future “Save as” flow). */
  stub?: boolean
}

export function PublicAssetSaveButton({
  assetId,
  compact = false,
  compactLabel = "save",
  stub = false,
}: PublicAssetSaveButtonProps) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")

  async function saveToFotobox(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (stub) return
    if (saveState === "saving" || saveState === "saved") return

    setSaveState("saving")
    const response = await fetch("/api/fotobox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId }),
    }).catch(() => null)

    setSaveState(response?.ok ? "saved" : "error")
  }

  const saveLabel = stub
    ? compactLabel
    : saveState === "saving"
      ? "Saving"
      : saveState === "saved"
        ? "Saved"
        : compact
          ? compactLabel
          : "Save to FotoBox"
  const saveIcon =
    saveState === "saving" ? (
      <Loader2 className="animate-spin" size={16} />
    ) : saveState === "saved" ? (
      <Check size={16} />
    ) : (
      <Plus  strokeWidth={2.5} size={16} />
    )

  return (
    <button
      type="button"
      onClick={saveToFotobox}
      className={cn(
        "flex items-center justify-center gap-1.5 bg-black/65 text-sm font-bold text-white backdrop-blur-md transition-colors hover:bg-black/80",
        compact ? "h-8 rounded-sm px-2.5" : "h-10 px-3",
        saveState === "saved" && "bg-accent text-accent-foreground hover:bg-accent",
        saveState === "error" && "bg-destructive text-destructive-foreground hover:bg-destructive",
      )}
      aria-label={stub ? "Save as" : saveState === "saved" ? "Saved to Fotobox" : "Save image to Fotobox"}
      disabled={!stub && (saveState === "saving" || saveState === "saved")}
    >
      {!compact && saveIcon}
      <span>{saveLabel}</span>
      {compact && saveIcon}
    </button>
  )
}
