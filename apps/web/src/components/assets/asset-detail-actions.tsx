"use client"

import { Download, CircleHelp, ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"
import { useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import type { PublicAsset } from "@/features/assets/types"
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
  whoIsInPictureNames?: string[]
  keywords: string[]
  eventAssets?: PublicAsset[]
  totalEventAssets?: number
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
  whoIsInPictureNames = [],
  keywords,
  eventAssets = [],
  totalEventAssets = 0,
}: AssetDetailActionsProps) {
  const [selectedSize, setSelectedSize] = useState<AssetSizeOption["id"]>("large")
  const [downloadBusy, setDownloadBusy] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [keywordsOpen, setKeywordsOpen] = useState(false)
  const downloadFrameRef = useRef<HTMLIFrameElement>(null)

  const selectedOption = useMemo(
    () =>
      sizeOptions.find((option) => option.id === selectedSize)
      ?? sizeOptions.find((option) => option.id === "large")
      ?? sizeOptions.find((option) => option.selectable !== false)
      ?? sizeOptions[0],
    [selectedSize, sizeOptions],
  )

  const canDownload =
    selectedOption?.downloadAvailable !== false

  async function handleDownloadClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()

    if (!canDownload) {
      return
    }

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

  return (
    <section className="relative space-y-6 rounded-none border border-border bg-white p-5 sm:p-6 shadow-none">
      <iframe
        ref={downloadFrameRef}
        title="Download"
        name="fotocorp-download-frame"
        className="pointer-events-none absolute h-0 w-0 border-0 opacity-0"
        aria-hidden
      />

      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
          How can I use this image?
        </h2>
        <ImageUsageHelp />
      </div>

      <fieldset className="overflow-hidden rounded-none border border-border bg-background">
        {sizeOptions.map((option, index) => {
          const selected = option.id === selectedOption?.id
          const isSelectable = option.selectable !== false
          const statusLabel = option.disabledReason ?? null

          return (
            <div key={option.id} className={cn(index > 0 && "border-t border-border")}>
              <label
                className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-colors",
                  isSelectable ? "cursor-pointer" : "cursor-not-allowed",
                  !isSelectable && "opacity-70",
                  selected && isSelectable && "bg-muted/50",
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
                <div
                  className={cn(
                    "border-t border-border/80 bg-muted/30 px-4 py-2.5 pl-11 text-xs leading-relaxed text-muted-foreground",
                    isSelectable && "bg-muted/40",
                  )}
                >
                  {option.dimensions ? (
                    <p className="font-medium text-foreground/80">{option.dimensions}</p>
                  ) : null}
                  {option.description ? (
                    <p className={option.dimensions ? "mt-1" : undefined}>{option.description}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </fieldset>

      <div className="space-y-2">
        {accessState === "profile-unavailable" ? (
          <div className="space-y-3">
            <div className="rounded-none border border-border bg-muted/35 p-4 text-sm leading-6 text-foreground">
              <p>
                Your account session is active, but profile access could not be loaded. Refresh or sign in again.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="h-10 rounded-none cursor-pointer" onClick={() => window.location.reload()}>
                  Refresh
                </Button>
                <Button asChild variant="outline" className="h-10 rounded-none cursor-pointer">
                  <Link href={`/sign-in?callbackUrl=${encodeURIComponent(assetHref)}`}>
                    Sign in again
                  </Link>
                </Button>
              </div>
            </div>
            <Button
              type="button"
              disabled={selectedOption?.downloadAvailable === false}
              className="w-full flex items-center justify-center gap-2 rounded-none font-sans font-bold uppercase text-xs tracking-wider h-12 bg-black text-white hover:bg-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:border disabled:border-border disabled:cursor-not-allowed border-0 cursor-pointer"
              onClick={handleDownloadClick}
            >
              <Download size={16} />
              {selectedOption?.downloadAvailable === false ? "Download unavailable for this size" : "Download now"}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            disabled={downloadBusy || selectedOption?.downloadAvailable === false}
            className="w-full flex items-center justify-center gap-2 rounded-none font-sans font-bold uppercase text-xs tracking-wider h-12 bg-black text-white hover:bg-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:border disabled:border-border disabled:cursor-not-allowed border-0 cursor-pointer"
            onClick={handleDownloadClick}
            aria-label={`Download ${selectedOption?.label ?? "selected"} size`}
          >
            <Download size={16} />
            {downloadBusy
              ? "Starting download..."
              : selectedOption?.downloadAvailable === false
                ? "Download unavailable for this size"
                : "Download now"}
          </Button>
        )}

        {downloadError ? (
          <div className="rounded-none border border-destructive/25 bg-destructive/10 p-3 text-sm leading-6 text-foreground">
            {downloadError}
          </div>
        ) : null}
      </div>

      {/* More from this event contact sheet */}
      {eventAssets.length > 0 && (
        <div className="border-t border-border/60 pt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              More from this event
            </h3>
            {totalEventAssets > 0 && (
              <a
                href="#event-gallery-section"
                className="text-[10px] font-bold uppercase tracking-wider text-primary hover:underline underline-offset-2"
              >
                View all {totalEventAssets}
              </a>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-[min(40vh,420px)] overflow-y-auto pr-1">
            {eventAssets.map((otherAsset) => {
              const isActive = otherAsset.id === assetId
              const otherPreview = otherAsset.previews.thumb ?? otherAsset.previews.card
              return (
                <Link
                  key={otherAsset.id}
                  href={`/assets/${otherAsset.id}`}
                  scroll={false}
                  className={cn(
                    "relative aspect-[4/3] w-full overflow-hidden bg-muted border transition-all cursor-pointer rounded-none",
                    isActive ? "border-black border-2" : "border-transparent border"
                  )}
                >
                  {otherPreview?.url ? (
                    <img
                      src={otherPreview.url}
                      alt={otherAsset.fotokey ?? ""}
                      className="h-full w-full object-cover transition-opacity duration-200 hover:opacity-90"
                    />
                  ) : (
                    <div className="h-full w-full bg-muted" />
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {(restrictions || whoIsInPictureNames.length > 0 || metadataRows.length > 0) && (
        <div className="space-y-3 border-t border-border pt-5">
          <button
            type="button"
            onClick={() => setDetailsOpen((prev) => !prev)}
            className="flex w-full items-center justify-between text-left lg:pointer-events-none cursor-pointer"
            aria-expanded={detailsOpen}
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Details</h3>
            <span className="text-muted-foreground lg:hidden">
              {detailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </button>

          <div className={cn("space-y-3 lg:block", detailsOpen ? "block" : "hidden")}>
            {restrictions ? (
              <div className="grid grid-cols-[minmax(0,34%)_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs leading-relaxed">
                <p className="text-muted-foreground">Restrictions:</p>
                <p className="text-foreground">{restrictions}</p>
              </div>
            ) : null}
            {whoIsInPictureNames.length > 0 ? (
              <dl className="space-y-2 text-xs leading-relaxed">
                <div className="grid grid-cols-[minmax(0,34%)_minmax(0,1fr)] gap-x-4 gap-y-1">
                  <dt className="text-muted-foreground">Who is in picture:</dt>
                  <dd className="text-foreground">
                    <p className="flex flex-wrap items-center gap-x-1 gap-y-1">
                      {whoIsInPictureNames.map((name, index) => (
                        <span key={name} className="inline-flex items-center">
                          {index > 0 ? <span className="mr-1 text-muted-foreground">,</span> : null}
                          <Link
                            href={`/search?q=${encodeURIComponent(name)}`}
                            className="text-primary underline underline-offset-4 hover:text-primary-hover"
                          >
                            {name}
                          </Link>
                        </span>
                      ))}
                    </p>
                  </dd>
                </div>
              </dl>
            ) : null}
            {metadataRows.length > 0 ? (
              <dl className="space-y-2 text-xs leading-relaxed">
                {metadataRows.map((row) => (
                  <div key={row.label} className="grid grid-cols-[minmax(0,34%)_minmax(0,1fr)] gap-x-4 gap-y-1">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="text-foreground" title={row.value}>
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </div>
      )}

      {keywords.length > 0 ? (
        <div className="border-t border-border/60 pt-4">
          <button
            type="button"
            onClick={() => setKeywordsOpen((prev) => !prev)}
            className="flex w-full items-center justify-between text-left lg:pointer-events-none cursor-pointer"
            aria-expanded={keywordsOpen}
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Keywords
            </h3>
            <span className="text-muted-foreground lg:hidden">
              {keywordsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </button>

          <div className={cn("mt-3 lg:block", keywordsOpen ? "block" : "hidden")}>
            <div className="flex flex-wrap gap-1.5 font-sans">
              {keywords.map((keyword) => (
                <Link
                  key={keyword}
                  href={`/search?q=${encodeURIComponent(keyword)}`}
                  className="rounded-none border border-border bg-muted/30 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {keyword}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function ImageUsageHelp() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
        aria-expanded={open}
        aria-label="How you can use this image"
      >
        <CircleHelp  aria-hidden size={16} />
      </button>
      {open ? (
        <div
          role="dialog"
          className="absolute right-0 top-full z-30 mt-2 w-[min(100vw-2.5rem,22rem)] rounded-none border border-border-strong bg-background p-4 text-xs leading-relaxed text-muted-foreground shadow-sm sm:w-80"
        >
          <p className="font-semibold text-foreground">Common uses include:</p>
          <p className="mt-1.5">
            Newspapers, magazines and books (except for covers), editorial broadcasts, documentaries,
            non-commercial websites, blogs and social media posts illustrating matters of public interest
          </p>
          <p className="mt-3 font-semibold text-foreground">Can&apos;t be used for:</p>
          <p className="mt-1.5">
            Book or magazine covers, commercial, promotional, advertorial, endorsement, advertising, or
            merchandising purposes in any media (e.g. print, commercial broadcast, film, digital)
          </p>
          <p className="mt-3 font-semibold text-foreground">Standard editorial rights:</p>
          <p className="mt-1.5">
            Anyone in your organisation can use it an unlimited number of times for up to 15 years, worldwide,
            with uncapped indemnification.
          </p>
          <p className="mt-3 text-foreground/90">Subject to the Content Licence Agreement</p>
        </div>
      ) : null}
    </div>
  )
}
