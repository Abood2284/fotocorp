import "server-only"

export const internalApiRoutes = {
  subscriberAssetDownload: (assetId: string) =>
    `/api/v1/internal/assets/${encodeURIComponent(assetId)}/download`,

  subscriberAssetDownloadCheck: (assetId: string) =>
    `/api/v1/internal/assets/${encodeURIComponent(assetId)}/download/check`,

  fotoboxItems: () => "/api/v1/internal/fotobox/items",

  fotoboxItem: (assetId: string) =>
    `/api/v1/internal/fotobox/items/${encodeURIComponent(assetId)}`,

  downloadHistory: () => "/api/v1/internal/downloads/history",

  adminAssets: () => "/api/v1/internal/admin/assets",

  adminAsset: (assetId: string) =>
    `/api/v1/internal/admin/assets/${encodeURIComponent(assetId)}`,

  adminAssetPublishState: (assetId: string) =>
    `/api/v1/internal/admin/assets/${encodeURIComponent(assetId)}/publish-state`,

  adminAssetOriginal: (assetId: string) =>
    `/api/v1/internal/admin/assets/${encodeURIComponent(assetId)}/original`,

  adminAssetPreview: (assetId: string) =>
    `/api/v1/internal/admin/assets/${encodeURIComponent(assetId)}/preview`,

  adminCatalogStats: () => "/api/v1/internal/admin/catalog/stats",
  adminMediaPipelineStatus: () => "/api/v1/internal/admin/media-pipeline/status",

  adminFilters: () => "/api/v1/internal/admin/filters",

  adminUsers: () => "/api/v1/internal/admin/users",

  adminUserSubscription: (authUserId: string) =>
    `/api/v1/internal/admin/users/${encodeURIComponent(authUserId)}/subscription`,

  adminContributorUploads: () => "/api/v1/internal/admin/contributor-uploads",

  adminContributorUploadOriginal: (imageAssetId: string) =>
    `/api/v1/internal/admin/contributor-uploads/${encodeURIComponent(imageAssetId)}/original`,

  adminContributorUploadsApprove: () =>
    "/api/v1/internal/admin/contributor-uploads/approve",

  adminContributorUploadsReject: () => "/api/v1/internal/admin/contributor-uploads/reject",

  adminContributorUploadMetadata: (imageAssetId: string) =>
    `/api/v1/internal/admin/contributor-uploads/${encodeURIComponent(imageAssetId)}`,

  adminContributorUploadReplacePresign: (imageAssetId: string) =>
    `/api/v1/internal/admin/contributor-uploads/${encodeURIComponent(imageAssetId)}/replace-presign`,

  adminContributorUploadReplaceComplete: (imageAssetId: string) =>
    `/api/v1/internal/admin/contributor-uploads/${encodeURIComponent(imageAssetId)}/replace-complete`,

  adminContributorUploadBatchDetail: (batchId: string) =>
    `/api/v1/internal/admin/contributor-uploads/batches/${encodeURIComponent(batchId)}`,

  adminEvents: () => "/api/v1/internal/admin/events",

  adminEvent: (eventId: string) =>
    `/api/v1/internal/admin/events/${encodeURIComponent(eventId)}`,

  adminEventPurge: (eventId: string) =>
    `/api/v1/internal/admin/events/${encodeURIComponent(eventId)}/purge`,
} as const

export function withQuery(path: string, params: URLSearchParams) {
  const query = params.toString()
  return query ? `${path}?${query}` : path
}
