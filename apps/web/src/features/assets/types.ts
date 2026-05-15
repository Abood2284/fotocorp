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
