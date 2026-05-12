"use client"

import Link from "next/link"
import { useState } from "react"
import { Archive, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface FotoboxSaveButtonProps {
  assetId: string
  variant?: "primary" | "secondary"
}

export function FotoboxSaveButton({ assetId, variant = "secondary" }: FotoboxSaveButtonProps) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle")

  async function save() {
    setState("saving")
    const response = await fetch("/api/fotobox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId }),
    }).catch(() => null)

    if (response?.ok) {
      setState("saved")
      return
    }

    setState("error")
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={variant === "primary" ? "default" : "outline"}
        className="h-11 w-full justify-center"
        onClick={save}
        disabled={state === "saving" || state === "saved"}
        aria-label="Add image to Fotobox"
      >
        {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "saved" ? <Check className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        {state === "saving" ? "Saving" : state === "saved" ? "Saved to Fotobox" : "Add to Fotobox"}
      </Button>
      {state === "saved" && (
        <Link href="/account/fotobox" className="block text-center text-sm font-medium text-foreground underline underline-offset-4">
          View Fotobox
        </Link>
      )}
      {state === "error" && (
        <p className="text-center text-sm text-muted-foreground">
          Could not save this image. Please try again.
        </p>
      )}
    </div>
  )
}
