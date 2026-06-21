import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { CaricatureDetailActions } from "@/components/caricatures/caricature-detail-actions"
import {
  CaricatureArtworkTextSection,
  CaricatureDetailChipSection,
  CaricatureDetailMetadataSection,
  CaricatureDetailPanel,
} from "@/components/caricatures/caricature-detail-sections"
import { CaricatureProtectedPreview } from "@/components/caricatures/caricature-protected-preview"
import { CaricatureSearchResultGrid } from "@/components/search/caricature-search-result-grid"
import type { PublicCaricatureDetail } from "@/features/assets/types"
import { getPublicCaricature, searchPublicCaricatures } from "@/lib/api/fotocorp-api"
import {
  formatPublicCaricatureLanguageLabel,
  formatPublicCaricaturePublishedDate,
  isRecentlyPublishedCaricature,
  resolvePublicCaricatureHeadline,
  sanitizePublicCaricatureTags,
  sanitizePublicCaricatureText,
} from "@/lib/caricatures/caricature-public-display"
import {
  buildCaricatureDetailHref,
  buildCaricatureSearchBackHref,
  mapCaricatureSearchItemToGridItem,
} from "@/lib/search/caricature-search"

interface CaricatureDetailPageProps {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ q?: string; segment?: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: CaricatureDetailPageProps) {
  const { id } = await params
  const result = await getPublicCaricature(id).catch(() => null)
  if (!result) {
    return { title: "Caricature Not Found — Fotocorp" }
  }

  const headline = resolvePublicCaricatureHeadline(result.caricature.headline)
  const description = sanitizePublicCaricatureText(result.caricature.description)
  const preview = result.caricature.previews.detail ?? result.caricature.previews.card

  return {
    title: `${headline} — Fotocorp`,
    description: description ?? `Protected caricature preview for ${headline}.`,
    openGraph: {
      title: `${headline} — Fotocorp`,
      description: description ?? `Protected caricature preview for ${headline}.`,
      images: preview?.url ? [{ url: preview.url, alt: headline }] : [],
    },
  }
}

export default async function CaricatureDetailPage({ params, searchParams }: CaricatureDetailPageProps) {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const result = await getPublicCaricature(id).catch(() => null)
  if (!result) notFound()

  const { caricature } = result
  const detailHref = buildCaricatureDetailHref(id)
  const backHref = buildCaricatureSearchBackHref(resolvedSearchParams?.q)
  const preview = caricature.previews.detail ?? caricature.previews.card
  const categorySearchHref = `/search?${new URLSearchParams({
    segment: "caricature",
    categoryId: caricature.categoryId,
  }).toString()}`

  const headline = resolvePublicCaricatureHeadline(caricature.headline)
  const description = sanitizePublicCaricatureText(caricature.description)
  const credit = sanitizePublicCaricatureText(caricature.credit)
  const categoryName = sanitizePublicCaricatureText(caricature.categoryName)
  const languageLabel = formatPublicCaricatureLanguageLabel(caricature.language)
  const publishedDate = formatPublicCaricaturePublishedDate(caricature.publishedAt)
  const keywords = sanitizePublicCaricatureTags(caricature.keywords)
  const depictedSubjects = sanitizePublicCaricatureTags(caricature.depictedSubjects)
  const visibleText = sanitizePublicCaricatureText(caricature.visibleText)
  const visibleTextTranslation = sanitizePublicCaricatureText(caricature.visibleTextTranslationEn)
  const showVisibleText = Boolean(visibleText) && caricature.language !== "NO_VISIBLE_TEXT"
  const showTranslation = Boolean(visibleTextTranslation)
  const isNew = isRecentlyPublishedCaricature(caricature.publishedAt)

  const hasAboutContent =
    Boolean(credit || categoryName || languageLabel || publishedDate)
    || keywords.length > 0
    || depictedSubjects.length > 0
  const hasArtworkText = showVisibleText || showTranslation

  const related = await loadRelatedCaricatures(caricature, id)

  return (
    <div className="bg-background pb-20 lg:pb-0">
      <div className="bg-surface-warm/70">
        <div className="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-5 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            >
              <ChevronLeft size={16} aria-hidden />
              Back to caricatures
            </Link>
            {categoryName ? (
              <>
                <span aria-hidden>/</span>
                <Link href={categorySearchHref} className="hover:text-foreground">
                  {categoryName}
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-3 pt-3 pb-5 sm:px-5 lg:px-8 lg:pt-4 lg:pb-7">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.62fr)_minmax(340px,0.58fr)] lg:items-start lg:gap-7">
          <section className="min-w-0 space-y-4">
            <header className="space-y-2 lg:hidden">
              <h1 className="fc-heading-1 text-2xl font-normal tracking-tight text-foreground sm:text-3xl">
                {headline}
              </h1>
              {description ? (
                <p className="max-w-5xl text-sm leading-relaxed text-muted-foreground">{description}</p>
              ) : null}
            </header>

            <CaricatureProtectedPreview preview={preview} alt={headline} />
          </section>

          <aside className="flex flex-col gap-5 bg-surface-stone px-4 py-5 sm:px-5 lg:px-6 lg:py-6">
            <div className="hidden space-y-2 lg:block">
              <h1 className="fc-heading-1 text-2xl font-normal tracking-tight text-foreground lg:text-[2.45rem] lg:leading-[1.08]">
                {headline}
              </h1>
              {description ? (
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              ) : null}
            </div>

            <CaricatureDetailActions assetId={id} detailHref={detailHref} />

            {hasAboutContent ? (
              <CaricatureDetailPanel title="About this work">
                <CaricatureDetailMetadataSection
                  showTitle={false}
                  rows={[
                    { label: "Credit", value: credit },
                    { label: "Category", value: categoryName },
                    { label: "Language", value: languageLabel },
                    {
                      label: "Published",
                      value: publishedDate
                        ? isNew
                          ? `${publishedDate} · New`
                          : publishedDate
                        : null,
                    },
                  ]}
                />

                {keywords.length > 0 ? (
                  <CaricatureDetailChipSection
                    title="Keywords"
                    values={keywords}
                    embedded
                  />
                ) : null}

                {depictedSubjects.length > 0 ? (
                  <CaricatureDetailChipSection
                    title="Depicted subjects"
                    values={depictedSubjects}
                    variant="subjects"
                    embedded
                  />
                ) : null}
              </CaricatureDetailPanel>
            ) : null}

            {hasArtworkText ? (
              <CaricatureArtworkTextSection
                originalText={visibleText}
                translation={visibleTextTranslation}
                languageLabel={languageLabel}
                showOriginal={showVisibleText}
              />
            ) : null}
          </aside>
        </div>

        {related ? (
          <section className="mt-8">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">{related.label}</h2>
              </div>
              {related.browseHref ? (
                <Link
                  href={related.browseHref}
                  className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover"
                >
                  View all
                </Link>
              ) : null}
            </div>
            <CaricatureSearchResultGrid items={related.items} priorityCount={4} />
          </section>
        ) : null}
      </div>
    </div>
  )
}

async function loadRelatedCaricatures(caricature: PublicCaricatureDetail, currentId: string) {
  if (caricature.credit.trim()) {
    try {
      const byCredit = await searchPublicCaricatures({ credit: caricature.credit, limit: 8 })
      const items = byCredit.items
        .filter((item) => item.id !== currentId)
        .slice(0, 5)
        .map(mapCaricatureSearchItemToGridItem)
      if (items.length > 0) {
        const params = new URLSearchParams({ segment: "caricature", credit: caricature.credit })
        return {
          label: `More from ${caricature.credit.trim()}`,
          items,
          browseHref: `/search?${params.toString()}`,
        }
      }
    } catch {
      // Related section is optional; omit when search is unavailable.
    }
  }

  try {
    const byCategory = await searchPublicCaricatures({ categoryId: caricature.categoryId, limit: 8 })
    const items = byCategory.items
      .filter((item) => item.id !== currentId)
      .slice(0, 5)
      .map(mapCaricatureSearchItemToGridItem)
    if (items.length > 0) {
      const params = new URLSearchParams({
        segment: "caricature",
        categoryId: caricature.categoryId,
      })
      return {
        label: "More caricatures",
        items,
        browseHref: `/search?${params.toString()}`,
      }
    }
  } catch {
    // Related section is optional; omit when search is unavailable.
  }

  return null
}
