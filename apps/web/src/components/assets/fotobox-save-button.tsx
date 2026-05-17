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
  iconOnly?: boolean
  hoverLabel?: string
  /** Placeholder — no API call (e.g. future “Save as” flow). */
  stub?: boolean
}

export function FotoboxSaveButton({
  assetId,
  variant = "secondary",
  className,
  buttonClassName,
  text = "Add to Fotobox",
  icon,
  iconOnly = false,
  hoverLabel = "save to fotobox",
  stub = false,
}: FotoboxSaveButtonProps) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle")

  async function save(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (stub) return

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

  const label = stub ? text : state === "saving" ? "Saving" : state === "saved" ? "Saved to Fotobox" : text
  const tooltip = stub ? (hoverLabel || "Save as") : hoverLabel
  const actionIcon =
    state === "saving" ? (
      <Loader2 className="h-5 w-5 animate-spin" />
    ) : state === "saved" ? (
      <Check className="h-5 w-5" />
    ) : (
      icon ?? <Archive className="h-5 w-5" />
    )

  return (
    <div className={cn(iconOnly ? "group relative" : "space-y-2", className)}>
      <Button
        type="button"
        variant={variant === "primary" ? "default" : variant === "ghost" ? "ghost" : "outline"}
        className={cn(
          "justify-center",
          iconOnly ? "h-9 w-9 border-0 p-0" : variant !== "ghost" && "h-11 w-full",
          buttonClassName,
        )}
        onClick={save}
        disabled={!stub && (state === "saving" || state === "saved")}
        aria-label={iconOnly ? tooltip : label}
      >
        {iconOnly ? actionIcon : (
          <>
            {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : state === "saved" ? <Check className="h-4 w-4 mr-2" /> : icon ? icon : <Archive className="h-4 w-4 mr-2" />}
            {label}
          </>
        )}
      </Button>
      {iconOnly && (
        <span className="pointer-events-none absolute right-0 top-full z-30 mt-2 whitespace-nowrap rounded-md bg-black/40 px-3 py-2 text-xs font-medium text-white/90 opacity-0 backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          {tooltip}
        </span>
      )}
      {!iconOnly && state === "saved" && (
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
