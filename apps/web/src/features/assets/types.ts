export type PublicAssetSort = "newest" | "oldest" | "relevance"

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
}

export interface PublicAssetContributor {
  id: string
  displayName: string
}

export interface PublicAsset {
  id: string
  title: string | null
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
  totalCount?: number
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
  preview: PublicPreview | null
  createdAt?: string | null
}

export interface PublicEventListResponse {
  items: PublicEvent[]
}

export interface PublicHomepageEvent {
  id: string
  title: string
  slug?: string | null
  eventDate?: string | null
  createdAt: string
  assetCount: number
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

export interface PublicAssetListParams {
  q?: string
  categoryId?: string
  eventId?: string
  contributorId?: string
  year?: number
  month?: number
  cursor?: string
  limit?: number
  sort?: PublicAssetSort
}
