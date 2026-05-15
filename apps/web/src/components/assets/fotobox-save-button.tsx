"use client"

import Link from "next/link"
import { useState } from "react"
import { Archive, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FotoboxSaveButtonProps {
  assetId: string
  variant?: "primary" | "secondary" | "ghost"
  className?: string
  buttonClassName?: string
  text?: string
  icon?: React.ReactNode
}

export function FotoboxSaveButton({ assetId, variant = "secondary", className, buttonClassName, text = "Add to Fotobox", icon }: FotoboxSaveButtonProps) {
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
    <div className={cn("space-y-2", className)}>
      <Button
        type="button"
        variant={variant === "primary" ? "default" : variant === "ghost" ? "ghost" : "outline"}
        className={cn("justify-center", variant !== "ghost" && "h-11 w-full", buttonClassName)}
        onClick={save}
        disabled={state === "saving" || state === "saved"}
        aria-label={text}
      >
        {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : state === "saved" ? <Check className="h-4 w-4 mr-2" /> : icon ? icon : <Archive className="h-4 w-4 mr-2" />}
        {state === "saving" ? "Saving" : state === "saved" ? "Saved to Fotobox" : text}
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
