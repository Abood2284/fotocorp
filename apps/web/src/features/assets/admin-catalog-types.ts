export interface AdminCatalogDerivativeSummary {
  state: "READY" | "FAILED" | "PROCESSING" | "MISSING"
  width: number | null
  height: number | null
  isWatermarked: boolean
  mimeType?: string | null
  updatedAt?: string | null
}

export interface AdminCatalogAssetItem {
  id: string
  legacyImageCode: string | null
  title: string | null
  caption: string | null
  headline: string | null
  description: string | null
  keywords: string | null
  status: string
  visibility: string
  r2Exists: boolean
  r2CheckedAt: string | null
  createdAt: string | null
  imageDate: string | null
  category: { id: string; name: string } | null
  event: { id: string; name: string | null; eventDate: string | null } | null
  contributor: { id: string; displayName: string } | null
  hasPreview: boolean
  previewState?: "READY" | "PARTIAL" | "MISSING"
  previewReady?: boolean
  readyPreviewVariants?: Array<"thumb" | "card" | "detail">
  missingPreviewVariants?: string[]
  preview: { url: string; width: number | null; height: number | null } | null
  updatedAt?: string | null
  derivatives: {
    thumb: AdminCatalogDerivativeSummary
    card: AdminCatalogDerivativeSummary
    detail: AdminCatalogDerivativeSummary
  }
}

export interface AdminCatalogAssetsResponse {
  items: AdminCatalogAssetItem[]
  nextCursor: string | null
}

export interface AdminCatalogAssetResponse {
  asset: AdminCatalogAssetItem
}

export interface AdminCatalogEditorialUpdateInput {
  caption: string | null
  headline: string | null
  description: string | null
  keywords: string[] | null
  categoryId: string | null
  eventId: string | null
  contributorId: string | null
}

export interface AdminCatalogPublishUpdateInput {
  status: "APPROVED" | "REVIEW" | "REJECTED"
  visibility: "PRIVATE" | "PUBLIC"
}

export interface AdminCatalogStats {
  totalAssets: number
  approvedPublicAssets: number
  privateAssets: number
  missingR2Count: number
  readyCardPreviewCount: number
  missingCardPreviewCount: number
  failedDerivativeCount: number
  totalCategories: number
  totalEvents: number
  totalContributors: number
  importedToday: number
  importedMonth: number
}

export interface AdminCatalogFilters {
  statuses: Array<{ status: string; assetCount: number }>
  categories: Array<{ id: string; name: string; assetCount: number }>
  events: Array<{ id: string; name: string | null; eventDate: string | null; assetCount: number }>
  contributors: Array<{ id: string; displayName: string; assetCount: number }>
}

export interface AdminCatalogUserItem {
  id: string
  authUserId: string
  email: string
  displayName: string | null
  role: "USER" | "CONTRIBUTOR" | "ADMIN" | "SUPER_ADMIN"
  status: "ACTIVE" | "SUSPENDED"
  isSubscriber: boolean
  subscriptionStatus: "NONE" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED"
  subscriptionPlanId: string | null
  subscriptionStartedAt: string | null
  subscriptionEndsAt: string | null
  downloadQuotaLimit: number | null
  downloadQuotaUsed: number
  createdAt: string | null
  updatedAt: string | null
}

export interface AdminCatalogUsersResponse {
  items: AdminCatalogUserItem[]
}

export interface AdminCatalogUserResponse {
  user: AdminCatalogUserItem
}

export type AdminCatalogSort =
  | "newest"
  | "oldest"
  | "imageDateDesc"
  | "imageDateAsc"
  | "recentlyUpdated"
  | "missingR2"
  | "missingPreview"
export type AdminCatalogDerivativeFilter = "READY" | "FAILED" | "PROCESSING" | "MISSING"
