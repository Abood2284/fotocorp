"use client"

import { Check, Copy } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

interface CopyFotokeyButtonProps {
  fotokey: string | null
}

export function CopyFotokeyButton({ fotokey }: CopyFotokeyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!fotokey) return
    try {
      await navigator.clipboard.writeText(fotokey)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-8 gap-1.5 px-2.5 text-xs"
      onClick={handleCopy}
      disabled={!fotokey}
      aria-label="Copy Fotokey"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied" : "Copy Fotokey"}
    </Button>
  )
}
