"use client"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { Check, Copy, Download, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FotoboxSaveButton } from "@/components/assets/fotobox-save-button"
import { messageForSubscriberDownloadErrorCode } from "@/lib/download-error-messages"
import { cn } from "@/lib/utils"

export type AssetDetailAccessState =
  | "logged-out"
  | "profile-unavailable"
  | "non-subscriber"
  | "subscriber"

export interface AssetSizeOption {
  id: "web" | "medium" | "large"
  label: string
  description: string
  dimensions?: string | null
  downloadAvailable?: boolean
  disabledReason?: string
}

interface AssetDetailActionsProps {
  assetId: string
  accessState: AssetDetailAccessState
  assetHref: string
  downloadHref: string
  fotokey: string | null
  previewUrl?: string | null
  sizeOptions: AssetSizeOption[]
  metadataRows: AssetMetadataRow[]
}

interface AssetMetadataRow {
  label: string
  value: string
}

export function AssetDetailActions({
  assetId,
  accessState,
  assetHref,
  downloadHref,
  fotokey,
  previewUrl,
  sizeOptions,
  metadataRows,
}: AssetDetailActionsProps) {
  const [selectedSize, setSelectedSize] = useState<AssetSizeOption["id"]>("large")
  const [copied, setCopied] = useState(false)
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const downloadFrameRef = useRef<HTMLIFrameElement>(null)

  const selectedOption = useMemo(
    () => sizeOptions.find((option) => option.id === selectedSize) ?? sizeOptions[0],
    [selectedSize, sizeOptions],
  )

  async function handleCopyLink() {
    const url = typeof window === "undefined" ? assetHref : new URL(assetHref, window.location.origin).toString()
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  async function handleSubscriberDownload(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    if (accessState !== "subscriber" || selectedOption?.downloadAvailable === false) return

    setDownloadError(null)
    setDownloadBusy(true)
    const size = selectedOption?.id ?? "large"

    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}/download/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size }),
      })

      const data = (await response.json().catch(() => null)) as {
        ok?: boolean
        error?: { code?: string }
      } | null

      if (!response.ok || !data?.ok) {
        const code = data?.error?.code
        setDownloadError(messageForSubscriberDownloadErrorCode(code))
        return
      }

      const frame = downloadFrameRef.current
      if (frame) {
        frame.src = `${downloadHref}?size=${encodeURIComponent(size)}`
      }
    } catch {
      setDownloadError(messageForSubscriberDownloadErrorCode("INTERNAL_ERROR"))
    } finally {
      setDownloadBusy(false)
    }
  }

  function handleWatermarkDownload() {
    if (!previewUrl) return
    const fileNameBase = fotokey || assetId
    const anchor = document.createElement("a")
    anchor.href = previewUrl
    anchor.download = `${fileNameBase}-watermarked.jpg`
    anchor.rel = "noreferrer"
    anchor.target = "_blank"
    anchor.click()
  }

  const message = getAccessMessage(accessState)

  return (
    <section className="relative space-y-6 rounded-2xl bg-surface-warm/30 p-5 sm:p-6">
      <iframe
        ref={downloadFrameRef}
        title="Download"
        name="fotocorp-download-frame"
        className="pointer-events-none absolute h-0 w-0 border-0 opacity-0"
        aria-hidden
      />

      <div className="border-b border-border pb-4">
        <p className="text-xs font-medium text-muted-foreground">{message.eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{message.title}</h2>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted-foreground">File access tiers</legend>
        {sizeOptions.map((option) => {
          const selected = option.id === selectedOption?.id
          return (
            <label
              key={option.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                selected ? "border-primary bg-primary-wash" : "border-border/60 hover:bg-muted/35",
              )}
            >
              <input
                type="radio"
                name="asset-size"
                value={option.id}
                checked={selected}
                onChange={() => setSelectedSize(option.id)}
                className="mt-1"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">{qualityLabelForSize(option.id)}</span>
                  {option.dimensions && <span className="text-xs text-muted-foreground">{option.dimensions}</span>}
                </span>
                <span className="mt-1 block text-sm leading-5 text-muted-foreground">{option.description}</span>
                {!option.downloadAvailable && option.disabledReason && (
                  <span className="mt-1 block text-xs font-medium text-muted-foreground">{option.disabledReason}</span>
                )}
              </span>
            </label>
          )
        })}
      </fieldset>

      {metadataRows.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border/70 bg-background p-4">
          <h3 className="text-sm font-medium text-foreground">Details</h3>
          <dl className="mt-2 space-y-2 text-sm">
            {metadataRows.map((row) => (
              <div key={row.label} className="grid grid-cols-[96px_minmax(0,1fr)] gap-2.5">
                <dt className="text-xs font-normal text-muted-foreground">{row.label}</dt>
                <dd className="text-sm font-normal text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="space-y-2">
        {accessState === "profile-unavailable" ? (
          <div className="rounded-xl border border-border bg-muted/35 p-4 text-sm leading-6 text-foreground">
            <p>
              Your account session is active, but profile access could not be loaded. Refresh or sign in again.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="h-10" onClick={() => window.location.reload()}>
                Refresh
              </Button>
              <Link
                href={`/sign-in?callbackUrl=${encodeURIComponent(assetHref)}`}
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Sign in again
              </Link>
            </div>
          </div>
        ) : accessState === "subscriber" && selectedOption?.downloadAvailable === false ? (
          <Button disabled className="h-11 w-full justify-center">
            <Download className="h-4 w-4" />
            Size not available
          </Button>
        ) : accessState === "subscriber" ? (
          <Button
            type="button"
            disabled={downloadBusy}
            className="h-11 w-full justify-center gap-2"
            onClick={handleSubscriberDownload}
            aria-label={`Download ${selectedOption?.label ?? "selected"} size`}
          >
            <Download className="h-4 w-4" />
            {downloadBusy ? "Starting download..." : "Download clean file"}
          </Button>
        ) : (
          <Link
            href="/pricing"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
          >
            <ShieldCheck className="h-4 w-4" />
            Choose plan for clean download
          </Link>
        )}

        {downloadError && (
          <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm leading-6 text-foreground">
            {downloadError}
          </div>
        )}

        <FotoboxSaveButton assetId={assetId} />

        <div className="grid gap-2 sm:grid-cols-2">
          {previewUrl ? (
            <Button
              type="button"
              variant="outline"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-center text-sm font-medium leading-5 text-foreground transition-colors hover:bg-muted"
              onClick={handleWatermarkDownload}
              aria-label="Download watermark"
              title="Download watermark"
            >
              <Download className="h-4 w-4" />
            </Button>
          ) : (
            <Button disabled variant="outline" className="h-10">
              Preview unavailable
            </Button>
          )}
          <Button type="button" variant="outline" className="min-h-10 py-2" onClick={handleCopyLink} aria-label="Copy asset link">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>

      </div>
    </section>
  )
}

function getAccessMessage(accessState: AssetDetailAccessState) {
  if (accessState === "subscriber") {
    return {
      eyebrow: "Image access",
      title: "Choose your delivery quality",
    }
  }

  if (accessState === "profile-unavailable") {
    return {
      eyebrow: "Image access",
      title: "Choose your delivery quality",
    }
  }

  if (accessState === "non-subscriber") {
    return {
      eyebrow: "Image access",
      title: "Choose your delivery quality",
    }
  }

  return {
    eyebrow: "Image access",
    title: "Choose your delivery quality",
  }
}

function qualityLabelForSize(size: AssetSizeOption["id"]) {
  if (size === "large") return "High quality (Original clean file)"
  if (size === "medium") return "Medium quality (Editorial layout)"
  return "Low quality (Watermarked preview)"
}
