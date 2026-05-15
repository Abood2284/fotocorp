import "server-only"

import {
  getAdminCatalogAsset,
  fetchAdminAssetOriginal,
  fetchAdminAssetPreview,
  getAdminCatalogFilters,
  getAdminCatalogStats,
  listAdminUsers,
  listAdminCatalogAssets,
  updateAdminUserSubscription,
  updateAdminAsset,
  updateAdminAssetPublishState,
  updateAdminAssetBulk,
  updateAdminAssetPublishStateBulk,
} from "@/lib/api/admin-catalog-api"

export const listAdminAssets = listAdminCatalogAssets
export const getAdminAsset = getAdminCatalogAsset
export const getAdminAssetOriginal = fetchAdminAssetOriginal
export const getAdminAssetPreview = fetchAdminAssetPreview
export const getAdminAssetFilters = getAdminCatalogFilters
export const getAdminAssetStats = getAdminCatalogStats
export const updateAdminAssetEditorial = updateAdminAsset
export const updateAdminAssetState = updateAdminAssetPublishState
export const updateAdminAssetEditorialBulk = updateAdminAssetBulk
export const updateAdminAssetStateBulk = updateAdminAssetPublishStateBulk
export const listInternalAdminUsers = listAdminUsers
export const updateInternalAdminUserSubscription = updateAdminUserSubscription
