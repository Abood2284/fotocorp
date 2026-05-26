import { ChevronLeft, ImageOff, Search } from "lucide-react"
import { notFound } from "next/navigation"
import Link from "next/link"

import { getCurrentAppUser } from "@/lib/app-user"
import { getPublicAsset, listPublicAssets } from "@/lib/api/fotocorp-api"
import { messageForDownloadRedirectError } from "@/lib/download-error-messages"
import type { PublicAsset } from "@/features/assets/types"
import { AssetPreviewChrome } from "@/components/assets/asset-preview-chrome"
import { parseWhoIsInPicture } from "@/lib/who-is-in-picture"
import { AssetDetailActions, type AssetDetailAccessState, type AssetSizeOption } from "@/components/assets/asset-detail-actions"
import { PublicAssetGrid } from "@/components/assets/public-asset-grid"

interface AssetDetailPageProps {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ downloadError?: string; q?: string }>
}

export const dynamic = "force-dynamic"

const FOTOCORP_EDITORIAL_RESTRICTIONS =
  "Contact Fotocorp for all commercial or promotional uses. Full editorial rights apply in India; additional territories are available under licence. Restricted editorial use may apply outside approved regions—please contact our Mumbai office for clearance."

const SIZE_OPTIONS: AssetSizeOption[] = [
  {
    id: "web",
    label: "Low",
    dimensions: "1200 px max edge • 72 dpi",
    description: "Best for web and screen preview",
    selectable: false,
    downloadAvailable: false,
    disabledReason: "Coming soon",
  },
  {
    id: "medium",
    label: "Medium",
    dimensions: "2400 px max edge • 300 dpi",
    description: "Best for editorial and digital publishing",
    selectable: false,
    downloadAvailable: false,
    disabledReason: "Coming soon",
  },
  {
    id: "large",
    label: "High",
    dimensions: "Maximum available resolution • 300 dpi",
    description: "Best for print and archive delivery",
    downloadAvailable: true,
  },
]

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

  const accessState = await resolveAssetDetailAccessState()

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
  const searchDefaultValue = resolvedSearchParams?.q ?? ""
  const actionMetadataRows = getActionMetadataRows(asset)

  return (
    <div className="bg-background">
      <div className="border-b border-border bg-surface-warm/70">
        <div className="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-5 lg:px-8">
          <form action="/search" className="flex min-h-12 items-center gap-3 rounded-none border border-border-strong bg-background px-4 shadow-sm">
            <Search className="shrink-0 text-foreground" aria-hidden size={20} />
            <label htmlFor="detail-search" className="sr-only">Search Fotocorp photos</label>
            <input
              id="detail-search"
              name="q"
              defaultValue={searchDefaultValue}
              placeholder="Search photos, events, people, places, Fotokey..."
              className="min-w-0 flex-1 bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground sm:text-base"
            />
            <span className="hidden border-l border-border pl-4 text-sm font-medium text-muted-foreground sm:block">
              Editorial images
            </span>
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-3 py-5 sm:px-5 lg:px-8 lg:py-7">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href="/search" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
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

        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.62fr)_minmax(340px,0.58fr)] lg:items-stretch">
          <section className="min-w-0 space-y-5 lg:flex lg:min-h-0 lg:flex-col lg:gap-5">
            {(primaryTitle || caption) && (
              <header className="shrink-0 space-y-3">
                {primaryTitle && (
                  <h1 className="max-w-5xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-[2.45rem] lg:leading-[1.08]">
                    {primaryTitle}
                  </h1>
                )}
                {caption && (
                  <p className="max-w-5xl text-sm leading-6 text-muted-foreground sm:text-base">
                    {caption}
                  </p>
                )}
              </header>
            )}

            <figure className="overflow-hidden bg-background lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
              {preview ? (
                <div className="flex w-full flex-col bg-background px-4 pb-4 pt-2 sm:px-5 sm:pb-5 sm:pt-2 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:px-6 lg:pb-6 lg:pt-2">
                  <AssetPreviewChrome
                    src={preview.url}
                    alt={getAssetAlt(asset)}
                    width={preview.width}
                    height={preview.height}
                    loading="eager"
                    whoIsInPicture={asset.whoIsInPicture}
                    fotokey={asset.fotokey ?? null}
                    assetId={asset.id}
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
          </section>

          <aside className="space-y-6 lg:sticky lg:top-24">
            <AssetDetailActions
              assetId={asset.id}
              accessState={accessState}
              assetHref={assetHref}
              downloadHref={`/api/assets/${asset.id}/download`}
              sizeOptions={SIZE_OPTIONS}
              restrictions={FOTOCORP_EDITORIAL_RESTRICTIONS}
              metadataRows={actionMetadataRows}
              whoIsInPictureNames={whoIsInPictureNames}
              keywords={keywords}
            />
          </aside>
        </div>

        <section className="mt-6 pt-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{relatedLabel}</h2>
            {relatedCountLabel ? (
              <span className="text-sm font-normal tabular-nums text-muted-foreground">
                ({relatedCountLabel})
              </span>
            ) : null}
            <Link
              href={relatedResult.browseHref}
              className="text-sm font-normal text-primary underline underline-offset-4 hover:text-primary-hover"
            >
              View all
            </Link>
          </div>
          {relatedAssets.length > 0 ? (
            <div className="mt-6">
              <PublicAssetGrid assets={relatedAssets} limit={12} />
            </div>
          ) : (
            <div className="mt-6 rounded-xl bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              Related previews are not available right now. Use archive search to keep browsing.
            </div>
          )}
        </section>
      </div>
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

async function resolveAssetDetailAccessState(): Promise<AssetDetailAccessState> {
  try {
    const appUser = await getCurrentAppUser()
    if (!appUser) return "logged-out"
    if (appUser.isSubscriber && appUser.subscriptionStatus === "ACTIVE") return "subscriber"
    return "signed-in-without-download"
  } catch {
    return "profile-unavailable"
  }
}

async function getRelatedAssets(asset: PublicAsset) {
  const targetCount = 12

  if (asset.event?.id) {
    const eventResult = await listPublicAssets({ eventId: asset.event.id, limit: 20 }).catch(() => null)
    const items = collectRelatedItems(
      eventResult?.items ?? [],
      asset.id,
      targetCount,
      (item) => item.event?.id === asset.event?.id,
    )
    if (items.length > 0) {
      return {
        items,
        label: relatedLabelForSource("event", asset),
        browseHref: relatedBrowseHref("event", asset),
        totalCount: eventResult?.totalCount,
      }
    }
  }

  if (asset.category?.id) {
    const categoryResult = await listPublicAssets({ categoryId: asset.category.id, limit: 20 }).catch(() => null)
    const items = collectRelatedItems(categoryResult?.items ?? [], asset.id, targetCount)
    if (items.length > 0) {
      return {
        items,
        label: relatedLabelForSource("category", asset),
        browseHref: relatedBrowseHref("category", asset),
        totalCount: categoryResult?.totalCount,
      }
    }
  }

  if (asset.contributor?.id) {
    const photographerResult = await listPublicAssets({ contributorId: asset.contributor.id, limit: 20 }).catch(() => null)
    const items = collectRelatedItems(photographerResult?.items ?? [], asset.id, targetCount)
    if (items.length > 0) {
      return {
        items,
        label: relatedLabelForSource("photographer", asset),
        browseHref: relatedBrowseHref("photographer", asset),
        totalCount: photographerResult?.totalCount,
      }
    }
  }

  const archiveResult = await listPublicAssets({ limit: 20, sort: "newest" }).catch(() => null)
  const items = collectRelatedItems(archiveResult?.items ?? [], asset.id, targetCount)
  return {
    items,
    label: relatedLabelForSource("archive", asset),
    browseHref: relatedBrowseHref("archive", asset),
    totalCount: archiveResult?.totalCount,
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
  if (source === "event") return "More images from this event"
  if (source === "category") return asset.category?.name ? `More from ${asset.category.name}` : "More from this category"
  if (source === "photographer") return asset.contributor?.displayName ? `More by ${asset.contributor.displayName}` : "More by this photographer"
  return "More from the archive"
}

function getActionMetadataRows(asset: PublicAsset) {
  return [
    { label: "Credit:", value: asset.contributor?.displayName ?? "—" },
    { label: "Fotokey #:", value: asset.fotokey ?? "—" },
    { label: "Event:", value: asset.event?.name ?? "—" },
    { label: "Category:", value: asset.category?.name ?? "—" },
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

