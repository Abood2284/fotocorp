import type { Env } from "../../../appTypes"
import { createHttpDb } from "../../../db"
import { AppError } from "../../../lib/errors"
import { json } from "../../../lib/http"
import {
  createAdminCaricatureAsset,
  getAdminCaricatureAssetById,
  listAdminCaricatureAssets,
  updateAdminCaricatureAsset,
  type AdminCaricatureAssetListFilters,
} from "../../../lib/caricatures/admin-caricature-assets"
import type { CaricatureMetadataInput } from "../../../lib/caricatures/caricature-asset-metadata"

function db(env: Env) {
  if (!env.DATABASE_URL) {
    throw new AppError(500, "DATABASE_URL_MISSING", "Database connection is not configured.")
  }
  return createHttpDb(env.DATABASE_URL)
}

export async function listAdminCaricatureAssetsService(
  env: Env,
  filters: AdminCaricatureAssetListFilters,
) {
  return json(await listAdminCaricatureAssets(db(env), filters))
}

export async function getAdminCaricatureAssetByIdService(env: Env, assetId: string) {
  const result = await getAdminCaricatureAssetById(db(env), assetId)
  if (!result) {
    throw new AppError(404, "CARICATURE_NOT_FOUND", "Caricature not found.")
  }
  return json(result)
}

export async function createAdminCaricatureAssetService(
  env: Env,
  payload: CaricatureMetadataInput,
  actorStaffId: string | null,
) {
  return json(await createAdminCaricatureAsset(db(env), payload, actorStaffId), 201)
}

export async function updateAdminCaricatureAssetService(
  env: Env,
  assetId: string,
  payload: CaricatureMetadataInput,
  actorStaffId: string | null,
) {
  return json(await updateAdminCaricatureAsset(db(env), assetId, payload, actorStaffId))
}

export function actorStaffIdFromRequest(request: Request): string | null {
  const staffId = request.headers.get("x-admin-auth-user-id")?.trim()
  return staffId || null
}
