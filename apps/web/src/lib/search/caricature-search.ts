import type {
  PublicCaricatureSearchItem,
  PublicCaricatureSearchParams,
  PublicPreview,
} from "@/features/assets/types"
import { CARICATURE_LANGUAGE_OPTIONS } from "@/lib/caricatures/caricature-upload-metadata"

export interface CaricatureSearchGridItem {
  id: string
  headline: string
  description: string | null
  credit: string | null
  categoryName: string | null
  language: string | null
  preview: PublicPreview | null
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

  return {
    id: item.id,
    headline: item.headline?.trim() || "Untitled caricature",
    description: item.description?.trim() || null,
    credit: item.credit?.trim() || null,
    categoryName: item.categoryName?.trim() || null,
    language: item.language?.trim() || null,
    preview,
  }
}

export function hasCaricatureSearchIntent(params: {
  q?: string
  categoryId?: string
  language?: string
  credit?: string
  hasVisibleText?: boolean
  page?: number
  sort?: string
}) {
  if (params.q?.trim()) return true
  if (params.categoryId?.trim()) return true
  if (params.language?.trim()) return true
  if (params.credit?.trim()) return true
  if (params.hasVisibleText != null) return true
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

export function getStaffCaricatureOriginalUrl(assetId: string) {
  return `/api/staff/upload-wizard/caricatures/${encodeURIComponent(assetId)}/original`
}
