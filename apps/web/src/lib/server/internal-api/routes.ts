import "server-only"

export const internalApiRoutes = {
  subscriberAssetDownload: (assetId: string) =>
    `/api/v1/internal/assets/${encodeURIComponent(assetId)}/download`,

  subscriberAssetDownloadCheck: (assetId: string) =>
    `/api/v1/internal/assets/${encodeURIComponent(assetId)}/download/check`,

  fotoboxItems: () => "/api/v1/internal/fotobox/items",

  fotoboxItem: (assetId: string) =>
    `/api/v1/internal/fotobox/items/${encodeURIComponent(assetId)}`,

  fotoboxBoards: () => "/api/v1/internal/fotobox/items/boards",

  fotoboxBoard: (boardId: string) =>
    `/api/v1/internal/fotobox/items/boards/${encodeURIComponent(boardId)}`,

  fotoboxMigrateAnon: () => "/api/v1/internal/fotobox/items/migrate-anon",

  fotoboxAssetBoardIds: () => "/api/v1/internal/fotobox/items/asset-board-ids",

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

  adminAssetGeneratePreviews: (assetId: string) =>
    `/api/v1/internal/admin/assets/${encodeURIComponent(assetId)}/generate-previews`,

  adminJobsPipelineSnapshot: () => "/api/v1/internal/admin/jobs-pipeline/snapshot",

  adminJobsPipelineWake: () => "/api/v1/internal/admin/jobs-pipeline/wake",

  adminCatalogStats: () => "/api/v1/internal/admin/catalog/stats",
  adminDashboardSummary: () => "/api/v1/internal/admin/dashboard/summary",

  adminFilters: () => "/api/v1/internal/admin/filters",

  adminUsers: () => "/api/v1/internal/admin/users",

  adminUser: (authUserId: string) =>
    `/api/v1/internal/admin/users/${encodeURIComponent(authUserId)}`,

  adminUserRole: (authUserId: string) =>
    `/api/v1/internal/admin/users/${encodeURIComponent(authUserId)}/role`,

  adminUserStatus: (authUserId: string) =>
    `/api/v1/internal/admin/users/${encodeURIComponent(authUserId)}/status`,

  adminUserSubscriptionDetail: (authUserId: string) =>
    `/api/v1/internal/admin/users/${encodeURIComponent(authUserId)}/subscription-detail`,

  adminUserSubscription: (authUserId: string) =>
    `/api/v1/internal/admin/users/${encodeURIComponent(authUserId)}/subscription`,

  adminUserDownloads: (authUserId: string) =>
    `/api/v1/internal/admin/users/${encodeURIComponent(authUserId)}/downloads`,

  adminContributorUploads: () => "/api/v1/internal/admin/contributor-uploads",

  adminContributorUploadBatches: () =>
    "/api/v1/internal/admin/contributor-uploads/batches",

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

  adminStaffUploadWizardContributors: () => "/api/v1/internal/admin/staff-upload-wizard/contributors",
  adminStaffUploadWizardAssetCategories: () => "/api/v1/internal/admin/staff-upload-wizard/asset-categories",
  adminStaffUploadWizardEvents: () => "/api/v1/internal/admin/staff-upload-wizard/events",
  adminStaffUploadWizardUploadBatches: () => "/api/v1/internal/admin/staff-upload-wizard/upload-batches",
  adminStaffUploadWizardUploadBatchDetail: (batchId: string) =>
    `/api/v1/internal/admin/staff-upload-wizard/upload-batches/${encodeURIComponent(batchId)}`,
  adminStaffUploadWizardUploadBatchFiles: (batchId: string) =>
    `/api/v1/internal/admin/staff-upload-wizard/upload-batches/${encodeURIComponent(batchId)}/files`,
  adminStaffUploadWizardUploadBatchFileComplete: (batchId: string, itemId: string) =>
    `/api/v1/internal/admin/staff-upload-wizard/upload-batches/${encodeURIComponent(batchId)}/files/${encodeURIComponent(itemId)}/complete`,
  adminStaffUploadWizardUploadBatchSubmit: (batchId: string) =>
    `/api/v1/internal/admin/staff-upload-wizard/upload-batches/${encodeURIComponent(batchId)}/submit`,
  adminStaffUploadWizardUploadBatchAssetMetadata: (batchId: string, imageAssetId: string) =>
    `/api/v1/internal/admin/staff-upload-wizard/upload-batches/${encodeURIComponent(batchId)}/assets/${encodeURIComponent(imageAssetId)}/metadata`,

  adminEvents: () => "/api/v1/internal/admin/events",

  adminEvent: (eventId: string) =>
    `/api/v1/internal/admin/events/${encodeURIComponent(eventId)}`,

  adminEventPurge: (eventId: string) =>
    `/api/v1/internal/admin/events/${encodeURIComponent(eventId)}/purge`,

  adminEventSearchIndex: (eventId: string) =>
    `/api/v1/internal/admin/events/${encodeURIComponent(eventId)}/search-index`,

  adminEventSearchIndexSync: (eventId: string) =>
    `/api/v1/internal/admin/events/${encodeURIComponent(eventId)}/search-index/sync`,

  adminHomepageHeroPool: () => "/api/v1/internal/admin/homepage-hero-pool",

  adminHomepageHeroPoolCandidates: () => "/api/v1/internal/admin/homepage-hero-pool/candidates",

  adminCaricatureCategories: () => "/api/v1/internal/admin/caricature-categories",

  adminCaricatureAssets: () => "/api/v1/internal/admin/caricature-assets",

  adminCaricatureAsset: (assetId: string) =>
    `/api/v1/internal/admin/caricature-assets/${encodeURIComponent(assetId)}`,

  adminCaricatureUploadShell: () => "/api/v1/internal/admin/caricature-assets/upload-shell",

  adminCaricatureOriginalPresign: (assetId: string) =>
    `/api/v1/internal/admin/caricature-assets/${encodeURIComponent(assetId)}/original/presign`,

  adminCaricatureOriginalComplete: (assetId: string) =>
    `/api/v1/internal/admin/caricature-assets/${encodeURIComponent(assetId)}/original/complete`,

  adminCaricatureGeneratePreviews: (assetId: string) =>
    `/api/v1/internal/admin/caricature-assets/${encodeURIComponent(assetId)}/generate-previews`,

  adminCaricatureApprove: (assetId: string) =>
    `/api/v1/internal/admin/caricature-assets/${encodeURIComponent(assetId)}/approve`,

  adminCaricatureReject: (assetId: string) =>
    `/api/v1/internal/admin/caricature-assets/${encodeURIComponent(assetId)}/reject`,

  adminCaricatureOriginal: (assetId: string) =>
    `/api/v1/internal/admin/caricature-assets/${encodeURIComponent(assetId)}/original`,
} as const

export function withQuery(path: string, params: URLSearchParams) {
  const query = params.toString()
  return query ? `${path}?${query}` : path
}
