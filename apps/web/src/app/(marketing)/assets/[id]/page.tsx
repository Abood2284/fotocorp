import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, ImageOff, Search, Plus } from "lucide-react"
import { getCurrentAppUser } from "@/lib/app-user"
import { getPublicAsset, listPublicAssets } from "@/lib/api/fotocorp-api"
import { messageForDownloadRedirectError } from "@/lib/download-error-messages"
import type { PublicAsset } from "@/features/assets/types"
import { formatDate } from "@/components/assets/public-asset-card"
import { PreviewImage } from "@/components/assets/preview-image"
import { AssetDetailActions, type AssetDetailAccessState, type AssetSizeOption } from "@/components/assets/asset-detail-actions"
import { CopyFotokeyButton } from "@/components/assets/copy-fotokey-button"
import { PublicAssetMosaic } from "@/components/assets/public-asset-mosaic"
import { WatermarkDownloadButton } from "@/components/assets/watermark-download-button"
import { FotoboxSaveButton } from "@/components/assets/fotobox-save-button"

interface AssetDetailPageProps {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ downloadError?: string; q?: string }>
}

export const dynamic = "force-dynamic"

const SIZE_OPTIONS: AssetSizeOption[] = [
  {
    id: "web",
    label: "Low",
    description: "72 DPI • 1200px • Best for web preview",
    downloadAvailable: false,
    disabledReason: "Coming soon",
  },
  {
    id: "medium",
    label: "Medium",
    description: "300 DPI • 2400px • Best for editorial",
    downloadAvailable: false,
    disabledReason: "Coming soon",
  },
  {
    id: "large",
    label: "High",
    description: "300 DPI • Max px • Best for print & archive",
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

  const title = getAssetTitle(asset)
  const preview = asset.previews.detail ?? asset.previews.card ?? asset.previews.thumb
  return {
    title: `${title} — Fotocorp`,
    description: asset.caption ?? `Watermarked Fotocorp preview for ${title}.`,
    openGraph: {
      title: `${title} — Fotocorp`,
      description: asset.caption ?? `Watermarked Fotocorp preview for ${title}.`,
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
  const title = getAssetTitle(asset)
  const caption = asset.caption?.trim()
  const keywords = splitKeywords(asset.keywords)
  const assetHref = `/assets/${asset.id}`
  const downloadError = messageForDownloadRedirectError(resolvedSearchParams?.downloadError)
  const relatedResult = await getRelatedAssets(asset)
  const relatedAssets = relatedResult.items
  const subtitle = getAssetSubtitle(asset)
  const relatedLabel = relatedResult.label
  const searchDefaultValue = resolvedSearchParams?.q ?? ""
  const actionMetadataRows = getActionMetadataRows(asset)

  return (
    <div className="bg-background">
      <div className="border-b border-border bg-surface-warm/70">
        <div className="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-5 lg:px-8">
          <form action="/search" className="flex min-h-12 items-center gap-3 rounded-none border border-border-strong bg-background px-4 shadow-sm">
            <Search className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
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
            <ChevronLeft className="h-4 w-4" />
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

        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.62fr)_minmax(340px,0.58fr)] lg:items-start">
          <section className="min-w-0 space-y-5">
            <header className="space-y-3">
              <h1 className="max-w-5xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-[2.45rem] lg:leading-[1.08]">
                {title}
              </h1>
              {subtitle && subtitle !== title && <p className="max-w-4xl text-sm leading-6 text-muted-foreground sm:text-base">{subtitle}</p>}
              {caption && caption !== title && (
                <p className="max-w-5xl text-sm leading-6 text-muted-foreground sm:text-base">
                  {caption}
                </p>
              )}
              <div className="inline-flex flex-wrap items-center gap-3 rounded-md border border-accent/35 bg-accent-wash px-3 py-2 text-sm">
                <span className="font-semibold text-foreground">
                  Fotokey: {asset.fotokey ? asset.fotokey : "Unavailable"}
                </span>
                <CopyFotokeyButton fotokey={asset.fotokey ?? null} />
              </div>
            </header>

            <figure className="overflow-hidden rounded-xl bg-surface-stone/40">
              {preview ? (
                <div
                  style={getPreviewFrameStyle(preview.width, preview.height)}
                  className="relative mx-auto flex w-full items-start justify-center px-4 pb-5 pt-2 sm:px-5 sm:pb-6 sm:pt-2 lg:px-6 lg:pb-7 lg:pt-2"
                >
                  <PreviewImage
                    src={preview.url}
                    alt={getAssetAlt(asset)}
                    className="h-full max-h-[86vh] w-full object-contain drop-shadow-2xl"
                    loading="eager"
                  />
                  <div className="absolute right-4 top-4 flex items-center gap-2">
                    <FotoboxSaveButton
                      assetId={asset.id}
                      variant="ghost"
                      className="!space-y-0 m-0"
                      buttonClassName="h-9 px-3 bg-black/40 text-white/90 backdrop-blur-md hover:bg-black/60 hover:text-white border-0"
                      text="Save to fotobox"
                      icon={<Plus className="h-4 w-4 mr-2" />}
                    />
                    <WatermarkDownloadButton
                      previewUrl={preview.url}
                      assetId={asset.id}
                      fotokey={asset.fotokey ?? null}
                    />
                  </div>
                  <div className="pointer-events-none absolute bottom-5 right-5 hidden rounded-md bg-black/40 px-3 py-2 text-xs font-medium text-white/90 backdrop-blur-md sm:block">
                    Fotocorp preview{asset.contributor?.displayName ? ` • ${asset.contributor.displayName}` : ""}
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
                  <ImageOff className="h-8 w-8" />
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
              metadataRows={actionMetadataRows}
              keywords={keywords}
            />
          </aside>
        </div>



        <section className="mt-12 border-t border-border pt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">{relatedLabel}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Continue browsing related watermarked previews.
              </p>
            </div>
            <Link href={relatedResult.browseHref} className="inline-flex text-sm font-medium text-foreground underline underline-offset-4">
              Browse more
            </Link>
          </div>
          {relatedAssets.length > 0 ? (
            <div className="mt-6">
              <PublicAssetMosaic assets={relatedAssets} />
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

function getAssetTitle(asset: PublicAsset) {
  return asset.headline || asset.title || asset.caption || asset.category?.name || asset.event?.name || "Fotocorp archive image"
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
  const deduped = new Map<string, PublicAsset>()
  let primarySource: "event" | "category" | "photographer" | "archive" = "archive"

  if (asset.event?.id) {
    const eventItems = await listPublicAssets({ eventId: asset.event.id, limit: 20 })
      .then((result) => result.items)
      .catch(() => [])
    const added = appendRelated(deduped, eventItems, asset.id, targetCount)
    if (added > 0) primarySource = "event"
  }

  if (deduped.size < targetCount && asset.category?.id) {
    const categoryItems = await listPublicAssets({ categoryId: asset.category.id, limit: 20 })
      .then((result) => result.items)
      .catch(() => [])
    const added = appendRelated(deduped, categoryItems, asset.id, targetCount)
    if (added > 0 && primarySource === "archive") primarySource = "category"
  }

  if (deduped.size < targetCount && asset.contributor?.id) {
    const photographerItems = await listPublicAssets({ contributorId: asset.contributor.id, limit: 20 })
      .then((result) => result.items)
      .catch(() => [])
    const added = appendRelated(deduped, photographerItems, asset.id, targetCount)
    if (added > 0 && primarySource === "archive") primarySource = "photographer"
  }

  if (deduped.size < targetCount) {
    const newestItems = await listPublicAssets({ limit: 20, sort: "newest" })
      .then((result) => result.items)
      .catch(() => [])
    appendRelated(deduped, newestItems, asset.id, targetCount)
  }

  const items = Array.from(deduped.values()).slice(0, targetCount)
  return {
    items,
    label: relatedLabelForSource(primarySource, asset),
    browseHref: relatedBrowseHref(primarySource, asset),
  }
}

function appendRelated(
  bucket: Map<string, PublicAsset>,
  candidates: PublicAsset[],
  currentAssetId: string,
  targetCount: number,
) {
  let added = 0
  for (const item of candidates) {
    if (item.id === currentAssetId) continue
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
  if (source === "event") return "More from this event"
  if (source === "category") return asset.category?.name ? `More from ${asset.category.name}` : "More from this category"
  if (source === "photographer") return asset.contributor?.displayName ? `More by ${asset.contributor.displayName}` : "More by this photographer"
  return "More from the archive"
}

function getAssetSubtitle(asset: PublicAsset) {
  const parts = [
    asset.event?.name ?? asset.category?.name ?? null,
    asset.event?.location ?? null,
    formatDate(asset.imageDate ?? asset.event?.eventDate),
  ].filter((value): value is string => Boolean(value))

  return parts.length > 0 ? parts.join(" • ") : null
}

function getPreviewFrameStyle(width?: number, height?: number) {
  if (!width || !height) return undefined
  if (width <= 0 || height <= 0) return undefined
  return { aspectRatio: `${width} / ${height}` }
}

function getActionMetadataRows(asset: PublicAsset) {
  return [
    { label: "Photographer", value: asset.contributor?.displayName ?? "Unavailable" },
    { label: "Event", value: asset.event?.name ?? "Unavailable" },
    { label: "Category", value: asset.category?.name ?? "Unavailable" },
    { label: "Source", value: asset.source ? humanizeEnum(asset.source) : "Unavailable" },
  ]
}

function humanizeEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}


