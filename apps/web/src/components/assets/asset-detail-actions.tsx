"use client"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { Download, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { messageForSubscriberDownloadErrorCode } from "@/lib/download-error-messages"
import { cn } from "@/lib/utils"

export type AssetDetailAccessState =
  | "logged-out"
  | "profile-unavailable"
  | "signed-in-without-download"
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
  sizeOptions: AssetSizeOption[]
  metadataRows: AssetMetadataRow[]
  keywords: string[]
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
  sizeOptions,
  metadataRows,
  keywords,
}: AssetDetailActionsProps) {
  const [selectedSize, setSelectedSize] = useState<AssetSizeOption["id"]>("large")
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const downloadFrameRef = useRef<HTMLIFrameElement>(null)

  const selectedOption = useMemo(
    () => sizeOptions.find((option) => option.id === selectedSize) ?? sizeOptions[0],
    [selectedSize, sizeOptions],
  )

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
        {message.description ? (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{message.description}</p>
        ) : null}
      </div>

      <fieldset className="space-y-1.5">
        {sizeOptions.map((option) => {
          const selected = option.id === selectedOption?.id
          const isDisabled = !option.downloadAvailable

          return (
            <label
              key={option.id}
              className={cn(
                "relative flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors",
                selected ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/35",
                isDisabled && "opacity-60 cursor-not-allowed bg-muted/20"
              )}
            >
              <input
                type="radio"
                name="asset-size"
                value={option.id}
                checked={selected}
                disabled={isDisabled}
                onChange={() => setSelectedSize(option.id)}
                className="mt-0.5 h-3.5 w-3.5 accent-primary"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{option.label}</span>
                  {isDisabled && (
                    <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Coming Soon
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </label>
          )
        })}
      </fieldset>

      {metadataRows.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-border/70 bg-background p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details</h3>
          <dl className="mt-1.5 space-y-1 text-xs">
            {metadataRows.map((row) => (
              <div key={row.label} className="grid grid-cols-[100px_minmax(0,1fr)] gap-2">
                <dt className="font-medium text-muted-foreground/80">{row.label}</dt>
                <dd className="font-medium text-foreground truncate" title={row.value}>{row.value}</dd>
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
            {downloadBusy ? "Starting download..." : "Download asset"}
          </Button>
        ) : accessState === "signed-in-without-download" ? (
          <div className="space-y-3">
            <Link
              href="/account/subscription"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
            >
              <ShieldCheck className="h-4 w-4" />
              Download access & account
            </Link>
            <Link
              href="/account/access-pending"
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Request status
            </Link>
          </div>
        ) : (
          <Link
            href="/request-access"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
          >
            <ShieldCheck className="h-4 w-4" />
            Request download access
          </Link>
        )}

        {downloadError && (
          <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm leading-6 text-foreground">
            {downloadError}
          </div>
        )}

        {keywords.length > 0 && (
          <div className="pt-4 border-t border-border/60">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Keywords</h3>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((keyword) => (
                <Link
                  key={keyword}
                  href={`/search?q=${encodeURIComponent(keyword)}`}
                  className="rounded bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {keyword}
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </section>
  )
}

function getAccessMessage(accessState: AssetDetailAccessState): {
  eyebrow: string
  title: string
  description?: string
} {
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

  if (accessState === "signed-in-without-download") {
    return {
      eyebrow: "Signed in",
      title: "Clean downloads unlock after approval",
      description:
        "You can browse watermarked previews and use Fotobox. Staff-approved download entitlements are required for clean files—not a self-serve plan checkout.",
    }
  }

  return {
    eyebrow: "Clean downloads",
    title: "Request access to originals",
    description: "Create an account and tell us what you need. After Fotocorp reviews your request, approved accounts can download files where licensing allows.",
  }
}


