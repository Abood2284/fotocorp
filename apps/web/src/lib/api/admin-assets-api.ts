import "server-only"

import {
  getAdminCatalogAsset,
  getAdminUser,
  fetchAdminAssetOriginal,
  fetchAdminAssetPreview,
  getAdminCatalogFilters,
  getAdminCatalogStats,
  listAdminUsers,
  listAdminCatalogAssets,
  updateAdminUserRole,
  updateAdminUserStatus,
  updateAdminUserSubscription,
  updateAdminAsset,
  updateAdminAssetPublishState,
  updateAdminAssetBulk,
  updateAdminAssetPublishStateBulk,
  deleteAdminCatalogAsset,
} from "@/lib/api/admin-catalog-api"

export const listAdminAssets = listAdminCatalogAssets
export const getAdminAsset = getAdminCatalogAsset
export const getAdminAssetOriginal = fetchAdminAssetOriginal
export const getAdminAssetPreview = fetchAdminAssetPreview
export const getAdminAssetFilters = getAdminCatalogFilters
export const getAdminAssetStats = getAdminCatalogStats
export const updateAdminAssetEditorial = updateAdminAsset
export const updateAdminAssetState = updateAdminAssetPublishState
export const deleteAdminAsset = deleteAdminCatalogAsset
export const updateAdminAssetEditorialBulk = updateAdminAssetBulk
export const updateAdminAssetStateBulk = updateAdminAssetPublishStateBulk
export const listInternalAdminUsers = listAdminUsers
export const getInternalAdminUser = getAdminUser
export const updateInternalAdminUserRole = updateAdminUserRole
export const updateInternalAdminUserStatus = updateAdminUserStatus
export const updateInternalAdminUserSubscription = updateAdminUserSubscription
