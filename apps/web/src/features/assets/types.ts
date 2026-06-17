export type PublicAssetSort = "newest" | "oldest" | "relevance" | "popular"

export interface PublicPreview {
  url: string
  width: number
  height: number
}

export interface PublicAssetCategory {
  id: string
  name: string
}

export interface PublicAssetEvent {
  id: string
  name: string | null
  eventDate: string | null
  location: string | null
  assetCount?: number
}

export interface PublicAssetContributor {
  id: string
  displayName: string
}

export interface PublicAsset {
  id: string
  whoIsInPicture: string | null
  caption: string | null
  headline: string | null
  keywords: string | null
  fotokey?: string | null
  copyright?: string | null
  imageDate: string | null
  uploadedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  status?: string
  visibility?: string
  mediaType?: string
  source?: string
  category: PublicAssetCategory | null
  event: PublicAssetEvent | null
  contributor: PublicAssetContributor | null
  previews: {
    thumb: PublicPreview | null
    card: PublicPreview | null
    detail?: PublicPreview | null
  }
}

export interface PublicAssetListResponse {
  items: PublicAsset[]
  nextCursor: string | null
  hasMore?: boolean
  totalCount?: number
  page?: number
  perPage?: number
  totalPages?: number
  filters?: PublicAssetFiltersResponse
  timing?: {
    backend: "typesense" | "postgres"
    tookMs: number
  }
}

export interface PublicAssetDetailResponse {
  asset: PublicAsset
}

export interface PublicAssetFilterCategory {
  id: string
  name: string
  assetCount: number
}

export interface PublicAssetFilterEvent {
  id: string
  name: string | null
  eventDate: string | null
  assetCount: number
}

export interface PublicAssetFiltersResponse {
  categories: PublicAssetFilterCategory[]
  events: PublicAssetFilterEvent[]
  cities?: Array<{ id: string; name: string; assetCount: number }>
  sources?: Array<{ id: string; name: string; assetCount: number }>
}

export interface PublicAssetCollection {
  id: string
  name: string
  assetCount: number
  preview: PublicPreview | null
}

export interface PublicAssetCollectionsResponse {
  items: PublicAssetCollection[]
}

export interface PublicEvent {
  id: string
  name: string
  eventDate: string | null
  assetCount: number
  previewAssetId?: string | null
  preview: PublicPreview | null
  createdAt?: string | null
  location?: string | null
}

export interface PublicEventListResponse {
  items: PublicEvent[]
}

export interface PublicSearchEventResult {
  eventId: string
  eventTitle: string | null
  eventDate: string | null
  eventLocation: string | null
  matchingAssetCount: number
  representativeAssetId: string
  previewUrl: string | null
  previewWidth: number | null
  previewHeight: number | null
}

export interface PublicSearchEventsResponse {
  query: string
  page: number
  limit: number
  foundEvents: number
  totalPages: number
  hasMore: boolean
  items: PublicSearchEventResult[]
  timing?: {
    backend: "typesense"
    tookMs: number
  }
}

export interface PublicHomepageEvent {
  id: string
  title: string
  slug?: string | null
  eventDate?: string | null
  createdAt: string
  location?: string | null
  categoryName?: string | null
  assetCount: number
  previewAssetId?: string | null
  previewUrl: string
  previewWidth?: number | null
  previewHeight?: number | null
}

export type PublicHomepageEditorialSectionKey = "news" | "sports" | "entertainment" | "retro"

export interface PublicHomepageAsset {
  id: string
  title?: string | null
  caption?: string | null
  fotokey?: string | null
  eventName?: string | null
  categoryName?: string | null
  imageDate?: string | null
  createdAt: string
  previewUrl: string
  previewWidth?: number | null
  previewHeight?: number | null
}

export interface PublicHomepageAssetSection {
  key: PublicHomepageEditorialSectionKey
  title: string
  items: PublicHomepageAsset[]
}

export interface PublicLatestEventsResponse {
  items: PublicHomepageEvent[]
  nextCursor: string | null
  hasMore: boolean
  generatedAt: string
}

export interface PublicHomepageFeed {
  latestEventsPreview: {
    items: PublicHomepageEvent[]
    nextCursor: string | null
    hasMore: boolean
  }
  generatedAt: string
}

export type PublicHomepageFeedResult =
  | { ok: true; feed: PublicHomepageFeed; durationMs: number }
  | { ok: false; error: string; code?: string; status?: number; durationMs: number }

export interface PublicHomepageHeroSetItem {
  slot: number
  assetId: string
  fotokey: string | null
  title: string
  eventId: string | null
  eventName: string | null
  previewUrl: string
}

export interface PublicHomepageHeroSetResponse {
  setKey: string | null
  activeFrom: string | null
  activeUntil: string | null
  items: PublicHomepageHeroSetItem[]
}

export interface PublicAssetListParams {
  q?: string
  categoryId?: string
  category?: string
  eventId?: string
  event?: string
  city?: string
  contributorId?: string
  year?: number
  month?: number
  cursor?: string
  page?: number
  limit?: number
  sort?: PublicAssetSort
  includeFacets?: boolean
}

export interface PublicCaricatureSearchItem {
  id: string
  headline: string | null
  description: string | null
  credit: string | null
  categoryId: string | null
  categoryName: string | null
  language: string | null
  hasVisibleText: boolean | null
  keywords: string[]
  depictedSubjects: string[]
  publishedAt: string | null
  createdAt: string | null
  previewUrl: string | null
  width: number | null
  height: number | null
  previews: {
    card: PublicPreview | null
    detail: PublicPreview | null
  }
}

export interface PublicCaricatureSearchResponse {
  items: PublicCaricatureSearchItem[]
  total: number
  totalCount: number
  page: number
  perPage: number
  limit: number
  totalPages: number
  hasMore: boolean
  facets: {
    categories: Array<{ value: string; count: number; name: string; assetCount: number }>
    languages: Array<{ value: string; count: number; name: string; assetCount: number }>
    credits: Array<{ value: string; count: number; name: string; assetCount: number }>
    hasVisibleText: Array<{ value: string; count: number; name: string; assetCount: number }>
  }
  timing?: {
    backend: "typesense"
    tookMs: number
  }
}

export interface PublicCaricatureSearchParams {
  q?: string
  categoryId?: string
  category?: string
  language?: string
  credit?: string
  hasVisibleText?: boolean
  depictedSubject?: string
  page?: number
  limit?: number
  sort?: PublicAssetSort
  includeFacets?: boolean
}

export type PublicLatestEventsSection = "latest" | "news" | "sports" | "entertainment" | "fashion" | "retro"
export type PublicEventBrowseSection = Exclude<PublicLatestEventsSection, "latest">

export interface PublicEventCategoryBrowseResponse extends PublicLatestEventsResponse {
  section: PublicEventBrowseSection
  limit: number
}
