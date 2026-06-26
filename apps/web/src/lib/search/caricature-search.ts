import type {
  PublicAssetSort,
  PublicCaricatureSearchItem,
  PublicCaricatureSearchParams,
  PublicCaricatureSearchResponse,
  PublicHomepageCaricature,
  PublicPreview,
} from "@/features/assets/types"
import {
  resolvePublicCaricatureHeadline,
  sanitizePublicCaricatureTags,
  sanitizePublicCaricatureText,
} from "@/lib/caricatures/caricature-public-display"
import { CARICATURE_LANGUAGE_OPTIONS } from "@/lib/caricatures/caricature-upload-metadata"

export interface CaricatureSearchGridItem {
  id: string
  headline: string
  description: string | null
  credit: string | null
  categoryName: string | null
  language: string | null
  publishedAt: string | null
  depictedSubjects: string[]
  hasVisibleText: boolean | null
  hasTranslation: boolean
  preview: PublicPreview | null
}

export function mapHomepageCaricatureToGridItem(item: PublicHomepageCaricature): CaricatureSearchGridItem {
  return mapCaricatureListingToGridItem({
    id: item.id,
    headline: item.headline,
    description: item.description,
    credit: item.credit,
    categoryName: item.categoryName,
    language: item.language,
    hasVisibleText: item.hasVisibleText,
    hasTranslation: item.hasTranslation,
    depictedSubjects: item.depictedSubjects,
    publishedAt: item.publishedAt,
    preview: item.previewUrl && item.previewWidth && item.previewHeight
      ? { url: item.previewUrl, width: item.previewWidth, height: item.previewHeight }
      : null,
  })
}

export function buildCaricatureSearchQueryParams(
  params: PublicCaricatureSearchParams,
): PublicCaricatureSearchParams {
  return {
    q: params.q?.trim() || "*",
    categoryId: params.categoryId,
    category: params.category,
    language: params.language,
    credit: params.credit,
    hasVisibleText: params.hasVisibleText,
    depictedSubject: params.depictedSubject,
    page: params.page ?? 1,
    limit: params.limit ?? 50,
    sort: params.sort ?? "newest",
    includeFacets: params.includeFacets ?? false,
  }
}

export function mapCaricatureSearchItemToGridItem(item: PublicCaricatureSearchItem): CaricatureSearchGridItem {
  const preview = item.previews.card
    ?? (item.previewUrl && item.width && item.height
      ? { url: item.previewUrl, width: item.width, height: item.height }
      : null)

  return mapCaricatureListingToGridItem({
    id: item.id,
    headline: item.headline,
    description: item.description,
    credit: item.credit,
    categoryName: item.categoryName,
    language: item.language,
    hasVisibleText: item.hasVisibleText,
    hasTranslation: item.hasTranslation ?? false,
    depictedSubjects: item.depictedSubjects,
    publishedAt: item.publishedAt,
    preview,
  })
}

interface CaricatureListingGridSource {
  id: string
  headline: string | null | undefined
  description: string | null | undefined
  credit: string | null | undefined
  categoryName: string | null | undefined
  language: string | null | undefined
  hasVisibleText: boolean | null | undefined
  hasTranslation: boolean
  depictedSubjects: string[] | null | undefined
  publishedAt: string | null | undefined
  preview: PublicPreview | null
}

export function mapCaricatureListingToGridItem(source: CaricatureListingGridSource): CaricatureSearchGridItem {
  return {
    id: source.id,
    headline: resolvePublicCaricatureHeadline(source.headline),
    description: sanitizePublicCaricatureText(source.description),
    credit: sanitizePublicCaricatureText(source.credit),
    categoryName: sanitizePublicCaricatureText(source.categoryName),
    language: source.language?.trim() || null,
    publishedAt: source.publishedAt?.trim() || null,
    depictedSubjects: sanitizePublicCaricatureTags(source.depictedSubjects),
    hasVisibleText: source.hasVisibleText ?? null,
    hasTranslation: source.hasTranslation,
    preview: source.preview,
  }
}

export function hasCaricatureSearchIntent(params: {
  q?: string
  categoryId?: string
  language?: string
  credit?: string
  hasVisibleText?: boolean
  depictedSubject?: string
  page?: number
  sort?: string
}) {
  if (params.q?.trim()) return true
  if (params.categoryId?.trim()) return true
  if (params.language?.trim()) return true
  if (params.credit?.trim()) return true
  if (params.hasVisibleText != null) return true
  if (params.depictedSubject?.trim()) return true
  if (params.page != null && params.page > 1) return true
  if (params.sort?.trim() && params.sort !== "newest") return true
  return false
}

export function buildCaricatureDetailHref(assetId: string) {
  return `/caricatures/${encodeURIComponent(assetId)}`
}

export function buildCaricatureSearchBackHref(query?: string | null) {
  const params = new URLSearchParams({ segment: "caricature" })
  const trimmed = query?.trim()
  if (trimmed) params.set("q", trimmed)
  return `/search?${params.toString()}`
}

export function formatCaricatureLanguageLabel(language: string | null | undefined) {
  const normalized = language?.trim().toUpperCase()
  if (!normalized) return "—"
  return CARICATURE_LANGUAGE_OPTIONS.find((option) => option.value === normalized)?.label ?? normalized
}

export interface CaricatureFilterChip {
  key: string
  label: string
  remove: () => void
}

export interface CaricatureSearchFilterParams {
  q?: string
  categoryId?: string
  language?: string
  credit?: string
  hasVisibleText?: boolean
  depictedSubject?: string
  sort?: PublicAssetSort
  page?: number
}

export interface CaricatureFilterListItem {
  id: string
  label: string
  count: number
}

export type CaricatureSearchFacets = PublicCaricatureSearchResponse["facets"]

const TEXT_LANGUAGES = CARICATURE_LANGUAGE_OPTIONS.filter(
  (option) => option.value !== "NO_VISIBLE_TEXT",
)

export function buildCaricatureCategoryFilterItems(
  facets: CaricatureSearchFacets | undefined,
): CaricatureFilterListItem[] {
  return (facets?.categories ?? [])
    .filter((category) => category.assetCount > 0)
    .map((category) => ({
      id: category.value,
      label: category.name,
      count: category.assetCount,
    }))
}

export function buildCaricatureLanguageFilterItems(
  facets: CaricatureSearchFacets | undefined,
): CaricatureFilterListItem[] {
  const facetCounts = new Map(
    (facets?.languages ?? [])
      .filter((language) => language.value !== "NO_VISIBLE_TEXT")
      .map((language) => [language.value, language.assetCount]),
  )

  return TEXT_LANGUAGES
    .map((option) => ({
      id: option.value,
      label: option.label,
      count: facetCounts.get(option.value) ?? 0,
    }))
    .filter((option) => option.count > 0)
}

export function buildCaricatureCreditFilterItems(
  facets: CaricatureSearchFacets | undefined,
): CaricatureFilterListItem[] {
  return (facets?.credits ?? [])
    .filter((credit) => credit.assetCount > 0)
    .map((credit) => ({
      id: credit.value,
      label: credit.name,
      count: credit.assetCount,
    }))
}

export function buildCaricatureDepictedSubjectFilterItems(
  facets: CaricatureSearchFacets | undefined,
): CaricatureFilterListItem[] {
  return (facets?.depictedSubjects ?? [])
    .filter((subject) => subject.assetCount > 0)
    .map((subject) => ({
      id: subject.value,
      label: subject.name,
      count: subject.assetCount,
    }))
}

export function resolveCaricatureFilterUpdates(
  _current: CaricatureSearchFilterParams,
  partial: Partial<CaricatureSearchFilterParams>,
): Partial<CaricatureSearchFilterParams> {
  const next: Partial<CaricatureSearchFilterParams> = { ...partial, page: 1 }

  if (partial.hasVisibleText === false) {
    next.language = undefined
  }

  if (partial.language?.trim()) {
    next.hasVisibleText = true
  }

  return next
}

export function resolveCaricatureSubmitSort(query: string | undefined): PublicAssetSort {
  return query?.trim() ? "relevance" : "newest"
}

export interface CaricatureFilterChipLabels {
  categoryName?: string
}

export function resolveCaricatureCategoryLabel(
  categoryId: string | undefined,
  facets: PublicCaricatureSearchResponse["facets"] | undefined,
  items: PublicCaricatureSearchItem[] | undefined,
) {
  const normalized = categoryId?.trim()
  if (!normalized) return undefined

  const facetMatch = facets?.categories.find(
    (category) => category.value === normalized || category.name === normalized,
  )
  if (facetMatch?.name) return facetMatch.name

  const itemMatch = items?.find((item) => item.categoryId === normalized || item.categoryName === normalized)
  if (itemMatch?.categoryName?.trim()) return itemMatch.categoryName.trim()

  return normalized
}

export function buildCaricatureFilterChips(
  params: CaricatureSearchFilterParams,
  labels: CaricatureFilterChipLabels,
  onRemove: (next: Partial<CaricatureSearchFilterParams>) => void,
): CaricatureFilterChip[] {
  const chips: CaricatureFilterChip[] = []

  if (params.q?.trim()) {
    chips.push({
      key: "q",
      label: params.q.trim(),
      remove: () => onRemove({ q: undefined }),
    })
  }

  const categoryLabel = labels.categoryName ?? params.categoryId?.trim()
  if (categoryLabel) {
    chips.push({
      key: "category",
      label: categoryLabel,
      remove: () => onRemove({ categoryId: undefined }),
    })
  }

  if (params.language?.trim()) {
    chips.push({
      key: "language",
      label: formatCaricatureLanguageLabel(params.language),
      remove: () => onRemove({ language: undefined }),
    })
  }

  if (params.credit?.trim()) {
    chips.push({
      key: "credit",
      label: params.credit.trim(),
      remove: () => onRemove({ credit: undefined }),
    })
  }

  if (params.hasVisibleText === true) {
    chips.push({
      key: "hasVisibleText",
      label: "Has visible text",
      remove: () => onRemove({ hasVisibleText: undefined }),
    })
  }

  if (params.hasVisibleText === false) {
    chips.push({
      key: "hasVisibleText",
      label: "No visible text",
      remove: () => onRemove({ hasVisibleText: undefined }),
    })
  }

  if (params.depictedSubject?.trim()) {
    chips.push({
      key: "depictedSubject",
      label: params.depictedSubject.trim(),
      remove: () => onRemove({ depictedSubject: undefined }),
    })
  }

  return chips
}

export function getStaffCaricatureOriginalUrl(assetId: string) {
  return `/api/staff/upload-wizard/caricatures/${encodeURIComponent(assetId)}/original`
}

export function getContributorCaricatureOriginalUrl(assetId: string) {
  return `/api/contributor/caricatures/${encodeURIComponent(assetId)}/original`
}

export function getCaricatureUploadWizardOriginalUrl(assetId: string, staffMode: boolean) {
  return staffMode ? getStaffCaricatureOriginalUrl(assetId) : getContributorCaricatureOriginalUrl(assetId)
}
