export interface AdminEventListItem {
  id: string
  name: string
  description: string | null
  eventDate: string | null
  eventTime: string | null
  location: string | null
  country: string | null
  stateRegion: string | null
  city: string | null
  photoCount: number
  source: string
  createdAt: string
  updatedAt: string
}

export interface AdminEventListResponse {
  items: AdminEventListItem[]
  total: number
  page: number
  limit: number
}

export interface AdminEventDetail {
  event: AdminEventListItem
  assetStats: {
    total: number
    public: number
    private: number
  }
}

export interface AdminEventPurgeResult {
  success: boolean
  dbDeleted: {
    assets: number
    derivatives: number
  }
  r2Results: {
    originalsDeleted: number
    previewsDeleted: number
    uploadsDeleted: number
    originalsFailed: number
    previewsFailed: number
    uploadsFailed: number
  }
}
