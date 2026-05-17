"use client"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { Download, HelpCircle, ShieldCheck } from "lucide-react"
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
  /** When false, the tier cannot be selected (e.g. not yet offered). */
  selectable?: boolean
}

interface AssetDetailActionsProps {
  assetId: string
  accessState: AssetDetailAccessState
  assetHref: string
  downloadHref: string
  sizeOptions: AssetSizeOption[]
  restrictions?: string
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
  restrictions,
  metadataRows,
  keywords,
}: AssetDetailActionsProps) {
  const [selectedSize, setSelectedSize] = useState<AssetSizeOption["id"]>("large")
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const downloadFrameRef = useRef<HTMLIFrameElement>(null)

  const selectedOption = useMemo(
    () =>
      sizeOptions.find((option) => option.id === selectedSize)
      ?? sizeOptions.find((option) => option.id === "large")
      ?? sizeOptions.find((option) => option.selectable !== false)
      ?? sizeOptions[0],
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
        <div className="mt-1 flex items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{message.title}</h2>
          {message.helpText ? <AccessRequestHelp text={message.helpText} /> : null}
        </div>
        {message.description ? (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{message.description}</p>
        ) : null}
      </div>

      <fieldset className="overflow-hidden rounded-md border border-border bg-background">
        {sizeOptions.map((option, index) => {
          const selected = option.id === selectedOption?.id
          const isSelectable = option.selectable !== false
          const statusLabel = option.disabledReason ?? null

          return (
            <div key={option.id} className={cn(index > 0 && "border-t border-border")}>
              <label
                className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-colors",
                  isSelectable ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                  selected && "bg-muted/50",
                )}
              >
                <input
                  type="radio"
                  name="asset-size"
                  value={option.id}
                  checked={selected}
                  disabled={!isSelectable}
                  onChange={() => {
                    if (isSelectable) setSelectedSize(option.id)
                  }}
                  className="h-4 w-4 shrink-0 accent-foreground disabled:cursor-not-allowed"
                />
                <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span className="text-sm text-foreground">{option.label}</span>
                  {statusLabel ? (
                    <span className="shrink-0 text-sm text-muted-foreground">{statusLabel}</span>
                  ) : null}
                </span>
              </label>
              {selected && (option.dimensions || option.description) ? (
                <div className="border-t border-border/80 bg-muted/30 px-4 py-2.5 pl-11 text-xs leading-relaxed text-muted-foreground">
                  {option.dimensions ? <p>{option.dimensions}</p> : null}
                  {option.description ? (
                    <p className={option.dimensions ? "mt-0.5" : undefined}>{option.description}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </fieldset>

      {(restrictions || metadataRows.length > 0) && (
        <div className="space-y-3 border-t border-border pt-5">
          <h3 className="text-xs font-medium text-foreground">Details</h3>
          {restrictions ? (
            <div className="grid grid-cols-[minmax(0,34%)_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs leading-relaxed">
              <p className="text-muted-foreground">Restrictions:</p>
              <p className="text-foreground">{restrictions}</p>
            </div>
          ) : null}
          {metadataRows.length > 0 ? (
            <dl className="space-y-2 text-xs leading-relaxed">
              {metadataRows.map((row) => (
                <div key={row.label} className="grid grid-cols-[minmax(0,34%)_minmax(0,1fr)] gap-x-4 gap-y-1">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="text-foreground" title={row.value}>{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
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

function AccessRequestHelp({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-expanded={open}
        aria-label="How requesting download access works"
      >
        <HelpCircle className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <p
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-2 w-[min(100vw-2.5rem,18rem)] rounded-md border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground shadow-md sm:left-auto sm:right-0"
        >
          {text}
        </p>
      ) : null}
    </div>
  )
}

function getAccessMessage(accessState: AssetDetailAccessState): {
  eyebrow: string
  title: string
  description?: string
  helpText?: string
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
    helpText:
      "Create a Fotocorp account and tell us what you need. Our team reviews each request and emails you when download access is approved for your use case. Licensing depends on your intended use—it is not instant self-serve checkout.",
  }
}


