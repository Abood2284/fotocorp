import { ChevronLeft, ImageOff, Search } from "lucide-react"
import { notFound } from "next/navigation"
import Link from "next/link"

import { getPublicAsset, listPublicAssets } from "@/lib/api/fotocorp-api"
import { messageForDownloadRedirectError } from "@/lib/download-error-messages"
import type { PublicAsset } from "@/features/assets/types"
import { AssetPreviewChrome } from "@/components/assets/asset-preview-chrome"
import { parseWhoIsInPicture } from "@/lib/who-is-in-picture"
import { AssetDetailActions, type AssetDetailAccessState } from "@/components/assets/asset-detail-actions"
import { buildPublicAssetSizeOptions } from "@/lib/assets/public-asset-size-options"
import { RelatedGallery } from "@/components/assets/related-gallery"
import { ExpandableCaption } from "@/components/assets/expandable-caption"
import { isLandscapePreview } from "@/lib/asset-preview-orientation"
import { cn } from "@/lib/utils"

interface AssetDetailPageProps {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ downloadError?: string; q?: string }>
}

export const dynamic = "force-dynamic"

const FOTOCORP_EDITORIAL_RESTRICTIONS =
  "Contact Fotocorp for all commercial or promotional uses. Full editorial rights apply in India; additional territories are available under licence. Restricted editorial use may apply outside approved regions—please contact our Mumbai office for clearance."

export async function generateMetadata({ params }: AssetDetailPageProps) {
  const { id } = await params
  const asset = await getPublicAsset(id).then((response) => response.asset).catch(() => null)

  if (!asset) {
    return {
      title: "Asset Not Found — Fotocorp",
    }
  }

  const primaryTitle = getAssetPrimaryTitle(asset)
  const preview = asset.previews.detail ?? asset.previews.card ?? asset.previews.thumb
  const pageTitle = primaryTitle ?? asset.fotokey ?? "Fotocorp"
  return {
    title: `${pageTitle} — Fotocorp`,
    description: asset.caption ?? (primaryTitle ? `Watermarked Fotocorp preview for ${primaryTitle}.` : "Watermarked Fotocorp preview."),
    openGraph: {
      title: `${pageTitle} — Fotocorp`,
      description: asset.caption ?? (primaryTitle ? `Watermarked Fotocorp preview for ${primaryTitle}.` : "Watermarked Fotocorp preview."),
      images: preview?.url ? [{ url: preview.url, alt: getAssetAlt(asset) }] : [],
    },
  }
}

export default async function AssetDetailPage({ params, searchParams }: AssetDetailPageProps) {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const asset = await getPublicAsset(id).then((response) => response.asset).catch(() => null)

  if (!asset) notFound()

  const accessState: AssetDetailAccessState = "logged-out"

  const preview = asset.previews.detail ?? asset.previews.card ?? asset.previews.thumb
  const primaryTitle = getAssetPrimaryTitle(asset)
  const caption = formatCaptionWithPhotoCredit(asset.caption, asset.contributor?.displayName)
  const keywords = splitKeywords(asset.keywords)
  const whoIsInPictureNames = parseWhoIsInPicture(asset.whoIsInPicture)
  const assetHref = `/assets/${asset.id}`
  const downloadError = messageForDownloadRedirectError(resolvedSearchParams?.downloadError)
  const relatedResult = await getRelatedAssets(asset)
  const relatedAssets = relatedResult.items
  const relatedLabel = relatedResult.label
  const relatedCountLabel = formatRelatedCountLabel(relatedResult.totalCount)
  const relatedHeaderLabel = formatRelatedHeaderLabel(relatedResult.source, relatedResult.totalCount, asset)
  const searchDefaultValue = resolvedSearchParams?.q ?? ""
  const actionMetadataRows = getActionMetadataRows(asset)
  const sizeOptions = buildPublicAssetSizeOptions(asset.technicalMetadata)

  // Build back button destination (takes the user back to the active event/category context)
  let backHref = "/search"
  const backParams = new URLSearchParams()
  if (resolvedSearchParams?.q) {
    backParams.set("q", resolvedSearchParams.q)
  }
  if (asset.event?.id) {
    backParams.set("eventId", asset.event.id)
  } else if (asset.category?.id) {
    backParams.set("categoryId", asset.category.id)
  }
  const backQuery = backParams.toString()
  if (backQuery) {
    backHref = `/search?${backQuery}`
  }

  // Fetch event assets for pagination and right-rail contact sheet
  let eventAssets: PublicAsset[] = []
  let totalEventAssets = 0
  if (asset.event?.id) {
    try {
      const res = await listPublicAssets({ eventId: asset.event.id, limit: 24 })
      eventAssets = res.items
      totalEventAssets = asset.event.assetCount ?? res.totalCount ?? eventAssets.length
    } catch {
      // fallback
    }
  }

  // Ensure current asset is in the event assets list
  let currentEventIndex = eventAssets.findIndex((a) => a.id === asset.id)
  if (currentEventIndex === -1 && eventAssets.length > 0) {
    // If the active asset is not inside the first 24 items, prepend it
    eventAssets = [asset, ...eventAssets]
    currentEventIndex = 0
    totalEventAssets = Math.max(totalEventAssets, eventAssets.length)
  }

  const prevAsset = currentEventIndex > 0 ? eventAssets[currentEventIndex - 1] : null
  const nextAsset = currentEventIndex !== -1 && currentEventIndex < eventAssets.length - 1 ? eventAssets[currentEventIndex + 1] : null
  const isLandscape = isLandscapePreview(preview?.width, preview?.height)

  const relatedGalleryProps = {
    initialAssets: relatedAssets,
    initialCursor: relatedResult.nextCursor,
    currentAssetId: asset.id,
    eventId: asset.event?.id ?? null,
    categoryId: asset.category?.id ?? null,
    contributorId: asset.contributor?.id ?? null,
    totalCount: relatedResult.totalCount ?? 0,
    label: relatedLabel,
    browseHref: relatedResult.browseHref,
    relatedCountLabel: relatedCountLabel,
    headerLabel: relatedHeaderLabel,
  }

  return (
    <div className="bg-background pb-20 lg:pb-0">
      <div className="bg-surface-warm/70">
        <div className="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-5 lg:px-8">
          <form action="/search" className="flex min-h-12 items-center gap-3 rounded-none border border-border-strong bg-background px-4 shadow-sm">
            <Search className="shrink-0 text-foreground" aria-hidden size={20} />
            <label htmlFor="detail-search" className="sr-only">Search Fotocorp photos</label>
            <input
              id="detail-search"
              name="q"
              defaultValue={searchDefaultValue}
              placeholder="AI-enabled search for photos, events, people, places, Fotokey..."
              className="min-w-0 flex-1 bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground sm:text-base"
            />
            <span className="hidden border-l border-border pl-4 text-sm font-medium text-muted-foreground sm:block">
              Editorial images
            </span>
            <button
              type="submit"
              className="button-primary-square inline-flex h-9 items-center justify-center px-5 text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-3 pt-3 pb-5 sm:px-5 lg:px-8 lg:pt-4 lg:pb-7">
        <div className="mb-7 flex flex-wrap items-center gap-2 text-sm text-muted-foreground lg:mb-8">
          <Link href={backHref} className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
            <ChevronLeft size={16} />
            Back to results
          </Link>
          {asset.category?.name && (
            <>
              <span aria-hidden>/</span>
              <Link href={`/search?categoryId=${encodeURIComponent(asset.category.id)}`} className="hover:text-foreground">
                {asset.category.name}
              </Link>
            </>
          )}
          {asset.event?.name && (
            <>
              <span aria-hidden>/</span>
              <Link href={`/search?eventId=${encodeURIComponent(asset.event.id)}`} className="hover:text-foreground">
                {asset.event.name}
              </Link>
            </>
          )}
        </div>

        <div
          className={cn(
            "grid gap-7 lg:grid-cols-[minmax(0,1.62fr)_minmax(340px,0.58fr)]",
            isLandscape ? "lg:items-start" : "lg:items-stretch",
          )}
        >
          <section
            className={cn(
              "min-w-0 space-y-5",
              !isLandscape && "lg:flex lg:min-h-0 lg:flex-col lg:gap-5",
            )}
          >
            {(primaryTitle || caption) && (
              <header className="shrink-0 space-y-3">
                {primaryTitle && (
                  <h1 className="fc-heading-1 max-w-5xl font-normal tracking-tight text-foreground sm:text-3xl lg:text-[2.45rem] lg:leading-[1.08]">
                    {primaryTitle}
                  </h1>
                )}
                {totalEventAssets > 0 && asset.event?.id && (
                  <div className="font-sans text-sm">
                    <a
                      href="#event-gallery-section"
                      className="text-primary underline underline-offset-2 hover:text-primary-hover"
                    >
                      View {totalEventAssets.toLocaleString()} {totalEventAssets === 1 ? "image" : "images"} from this event
                    </a>
                  </div>
                )}
                {caption && (
                  <ExpandableCaption caption={caption} />
                )}
              </header>
            )}

            {/* Mobile horizontal event filmstrip */}
            {eventAssets.length > 0 && (
              <div className="lg:hidden mt-1 border-b border-border pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Event Coverage ({totalEventAssets} images)
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                  {eventAssets.map((otherAsset) => {
                    const isActive = otherAsset.id === asset.id
                    const otherPreview = otherAsset.previews.thumb ?? otherAsset.previews.card
                    return (
                      <Link
                        key={otherAsset.id}
                        href={`/assets/${otherAsset.id}`}
                        scroll={false}
                        className={cn(
                          "relative aspect-[4/3] h-14 w-auto shrink-0 overflow-hidden bg-muted border transition-all cursor-pointer rounded-none",
                          isActive ? "border-black border-2" : "border-transparent"
                        )}
                      >
                        {otherPreview?.url ? (
                          <img
                            src={otherPreview.url}
                            alt=""
                            className="h-full w-full object-cover grayscale saturate-0"
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

            <figure
              className={cn(
                "overflow-hidden bg-background",
                !isLandscape && "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col",
              )}
            >
              {preview ? (
                <div
                  className={cn(
                    "flex w-full flex-col bg-background px-4 pb-4 pt-2 sm:px-5 sm:pb-5 sm:pt-2 lg:px-6 lg:pb-6 lg:pt-2",
                    !isLandscape && "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col",
                  )}
                >
                  <AssetPreviewChrome
                    src={preview.url}
                    alt={getAssetAlt(asset)}
                    width={preview.width}
                    height={preview.height}
                    loading="eager"
                    orientation={isLandscape ? "landscape" : "portrait"}
                    whoIsInPicture={asset.whoIsInPicture}
                    fotokey={asset.fotokey ?? null}
                    assetId={asset.id}
                    currentPhotoNumber={currentEventIndex !== -1 ? currentEventIndex + 1 : undefined}
                    totalPhotos={totalEventAssets > 0 ? totalEventAssets : undefined}
                    prevAssetId={prevAsset?.id ?? null}
                    nextAssetId={nextAsset?.id ?? null}
                  />
                </div>
              ) : (
                <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
                  <ImageOff size={32} />
                  <span className="text-base font-semibold text-foreground">Image preview unavailable</span>
                  <span className="max-w-md text-sm leading-6">
                    We found this asset record, but preview generation has not completed yet.
                  </span>
                  <span className="text-xs">Fotokey: {asset.fotokey ?? "Unavailable"}</span>
                </div>
              )}
            </figure>

            {downloadError && (
              <div className="border border-destructive/25 bg-destructive/10 p-4 text-sm leading-6 text-foreground mt-4">
                {downloadError}
              </div>
            )}

            {isLandscape ? (
              <RelatedGallery {...relatedGalleryProps} placement="column" />
            ) : null}
          </section>

          <aside id="download-card-section" className="scroll-mt-28">
            <AssetDetailActions
              assetId={asset.id}
              accessState={accessState}
              assetHref={assetHref}
              downloadHref={`/api/assets/${asset.id}/download`}
              sizeOptions={sizeOptions}
              restrictions={FOTOCORP_EDITORIAL_RESTRICTIONS}
              metadataRows={actionMetadataRows}
              whoIsInPictureNames={whoIsInPictureNames}
              keywords={keywords}
              eventAssets={eventAssets}
              totalEventAssets={totalEventAssets}
            />
          </aside>

        </div>

        {!isLandscape ? <RelatedGallery {...relatedGalleryProps} placement="full" /> : null}
      </div>

      {/* Sticky Bottom Bar on Mobile */}
      {totalEventAssets > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t border-border bg-white p-3 shadow-md">
          <div className="flex gap-2">
            <a
              href="#event-gallery-section"
              className="flex-1 text-center py-2.5 border border-black font-sans text-xs font-bold uppercase tracking-wider text-black bg-white hover:bg-neutral-50 rounded-none cursor-pointer"
            >
              Event ({totalEventAssets} images)
            </a>
            <a
              href="#download-card-section"
              className="flex-1 text-center py-2.5 font-sans text-xs font-bold uppercase tracking-wider text-white bg-black hover:bg-neutral-900 rounded-none cursor-pointer"
            >
              Download now
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function formatCaptionWithPhotoCredit(caption: string | null | undefined, photographerName?: string | null) {
  const trimmed = caption?.trim()
  if (!trimmed) return null
  if (!photographerName) return trimmed
  return `${trimmed} (Photo by ${photographerName} / Fotocorp)`
}

function getAssetPrimaryTitle(asset: PublicAsset) {
  return asset.event?.name?.trim() || null
}

function getAssetAlt(asset: PublicAsset) {
  return asset.headline || asset.caption || asset.event?.name || asset.category?.name || "Fotocorp archive image"
}

function splitKeywords(value: string | null) {
  if (!value) return []
  return Array.from(new Set(
    value
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean),
  ))
}

async function getRelatedAssets(asset: PublicAsset) {
  const targetCount = 12

  if (asset.event?.id) {
    const eventResult = await listPublicAssets({ eventId: asset.event.id, limit: 13 }).catch(() => null)
    const items = collectRelatedItems(
      eventResult?.items ?? [],
      asset.id,
      targetCount,
      (item) => item.event?.id === asset.event?.id,
    )
    if (items.length > 0) {
      return {
        items,
        source: "event" as const,
        label: relatedLabelForSource("event", asset),
        browseHref: relatedBrowseHref("event", asset),
        totalCount: asset.event.assetCount ?? eventResult?.totalCount,
        nextCursor: eventResult?.nextCursor ?? null,
      }
    }
  }

  if (asset.category?.id) {
    const categoryResult = await listPublicAssets({ categoryId: asset.category.id, limit: 13 }).catch(() => null)
    const items = collectRelatedItems(categoryResult?.items ?? [], asset.id, targetCount)
    if (items.length > 0) {
      return {
        items,
        source: "category" as const,
        label: relatedLabelForSource("category", asset),
        browseHref: relatedBrowseHref("category", asset),
        totalCount: categoryResult?.totalCount,
        nextCursor: categoryResult?.nextCursor ?? null,
      }
    }
  }

  if (asset.contributor?.id) {
    const photographerResult = await listPublicAssets({ contributorId: asset.contributor.id, limit: 13 }).catch(() => null)
    const items = collectRelatedItems(photographerResult?.items ?? [], asset.id, targetCount)
    if (items.length > 0) {
      return {
        items,
        source: "photographer" as const,
        label: relatedLabelForSource("photographer", asset),
        browseHref: relatedBrowseHref("photographer", asset),
        totalCount: photographerResult?.totalCount,
        nextCursor: photographerResult?.nextCursor ?? null,
      }
    }
  }

  const archiveResult = await listPublicAssets({ limit: 13, sort: "newest" }).catch(() => null)
  const items = collectRelatedItems(archiveResult?.items ?? [], asset.id, targetCount)
  return {
    items,
    source: "archive" as const,
    label: relatedLabelForSource("archive", asset),
    browseHref: relatedBrowseHref("archive", asset),
    totalCount: archiveResult?.totalCount,
    nextCursor: archiveResult?.nextCursor ?? null,
  }
}

function collectRelatedItems(
  candidates: PublicAsset[],
  currentAssetId: string,
  targetCount: number,
  predicate?: (item: PublicAsset) => boolean,
) {
  const deduped = new Map<string, PublicAsset>()
  appendRelated(deduped, candidates, currentAssetId, targetCount, predicate)
  return Array.from(deduped.values()).slice(0, targetCount)
}

function formatRelatedCountLabel(totalCount: number | undefined) {
  if (totalCount == null || totalCount <= 0) return null
  const formatted = totalCount.toLocaleString()
  return totalCount === 1 ? `${formatted} image` : `${formatted} images`
}

function formatRelatedHeaderLabel(
  source: "event" | "category" | "photographer" | "archive",
  totalCount: number | undefined,
  asset: PublicAsset,
) {
  if (source === "event" && totalCount != null && totalCount > 0) {
    const formatted = totalCount.toLocaleString()
    return `View ${formatted} ${totalCount === 1 ? "image" : "images"} from this event`
  }
  return relatedLabelForSource(source, asset)
}

function appendRelated(
  bucket: Map<string, PublicAsset>,
  candidates: PublicAsset[],
  currentAssetId: string,
  targetCount: number,
  predicate?: (item: PublicAsset) => boolean,
) {
  let added = 0
  for (const item of candidates) {
    if (item.id === currentAssetId) continue
    if (predicate && !predicate(item)) continue
    if (bucket.has(item.id)) continue
    bucket.set(item.id, item)
    added += 1
    if (bucket.size >= targetCount) break
  }
  return added
}

function relatedBrowseHref(
  source: "event" | "category" | "photographer" | "archive",
  asset: PublicAsset,
) {
  if (source === "event" && asset.event?.id) return `/search?eventId=${encodeURIComponent(asset.event.id)}`
  if (source === "category" && asset.category?.id) return `/search?categoryId=${encodeURIComponent(asset.category.id)}`
  if (source === "photographer" && asset.contributor?.id) return `/search?contributorId=${encodeURIComponent(asset.contributor.id)}`
  return "/search"
}

function relatedLabelForSource(
  source: "event" | "category" | "photographer" | "archive",
  asset: PublicAsset,
) {
  if (source === "event") return "Images from this event"
  if (source === "category") return asset.category?.name ? `More from ${asset.category.name}` : "More from this category"
  if (source === "photographer") return asset.contributor?.displayName ? `More by ${asset.contributor.displayName}` : "More by this photographer"
  return "More from the archive"
}

function getActionMetadataRows(asset: PublicAsset) {
  return [
    { label: "Event:", value: asset.event?.name ?? "—" },
    { label: "Category:", value: asset.category?.name ?? "—" },
    { label: "Fotokey #:", value: asset.fotokey ?? "—" },
    { label: "Credit:", value: asset.contributor?.displayName ?? "—" },
    { label: "Source:", value: asset.source ? humanizeEnum(asset.source) : "—" },
  ]
}

function humanizeEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}
