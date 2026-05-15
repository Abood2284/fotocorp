"use client"

import { useState } from "react"
import type React from "react"
import { Check, Loader2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface PublicAssetSaveButtonProps {
  assetId: string
}

export function PublicAssetSaveButton({ assetId }: PublicAssetSaveButtonProps) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")

  async function saveToFotobox(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (saveState === "saving" || saveState === "saved") return

    setSaveState("saving")
    const response = await fetch("/api/fotobox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId }),
    }).catch(() => null)

    setSaveState(response?.ok ? "saved" : "error")
  }

  return (
    <button
      type="button"
      onClick={saveToFotobox}
      className={cn(
        "flex h-10 items-center justify-center gap-2 bg-black/65 px-3 text-sm font-bold text-white backdrop-blur-md transition-colors hover:bg-black/80",
        saveState === "saved" && "bg-accent text-accent-foreground hover:bg-accent",
        saveState === "error" && "bg-destructive text-destructive-foreground hover:bg-destructive",
      )}
      aria-label={saveState === "saved" ? "Saved to Fotobox" : "Save image to Fotobox"}
      disabled={saveState === "saving" || saveState === "saved"}
    >
      {saveState === "saving" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : saveState === "saved" ? (
        <Check className="h-4 w-4" />
      ) : (
        <Plus className="h-4 w-4" strokeWidth={2.5} />
      )}
      <span>{saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : "Save to FotoBox"}</span>
    </button>
  )
}
