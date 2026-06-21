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
import {
  completeCaricatureOriginalUpload,
  createCaricatureUploadShell,
  presignCaricatureOriginalUpload,
  type CaricatureOriginalCompleteInput,
  type CaricatureOriginalPresignInput,
  type CaricatureUploadShellInput,
} from "../../../lib/caricatures/caricature-original-upload"
import {
  approveCaricatureForPublish,
  enqueueCaricaturePreviewJob,
  rejectCaricatureAsset,
} from "../../../lib/caricatures/caricature-publish-job"
import { getAdminCaricatureOriginalResponse } from "../../../lib/caricatures/caricature-staff-original"
import { scheduleTypesenseSyncForCaricature } from "../../../lib/search/typesense-public-caricature-sync"

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
  executionCtx?: ExecutionContext,
) {
  const database = db(env)
  const before = await getAdminCaricatureAssetById(database, assetId)
  const result = await updateAdminCaricatureAsset(database, assetId, payload, actorStaffId)
  const becamePublished = before?.status !== "PUBLISHED" && result.status === "PUBLISHED"

  if (becamePublished && result.hasReadyPreviewDerivatives) {
    const syncPromise = scheduleTypesenseSyncForCaricature(database, env, assetId)
    if (executionCtx) {
      executionCtx.waitUntil(syncPromise)
    } else {
      await syncPromise
    }
  }

  return json(result)
}

export function actorStaffIdFromRequest(request: Request): string | null {
  const staffId = request.headers.get("x-admin-auth-user-id")?.trim()
  return staffId || null
}

export async function createCaricatureUploadShellService(
  env: Env,
  payload: CaricatureUploadShellInput,
  actorStaffId: string | null,
) {
  return json(await createCaricatureUploadShell(db(env), payload, actorStaffId), 201)
}

export async function presignCaricatureOriginalUploadService(
  env: Env,
  assetId: string,
  payload: CaricatureOriginalPresignInput,
) {
  return json(await presignCaricatureOriginalUpload(db(env), env, assetId, payload))
}

export async function completeCaricatureOriginalUploadService(
  env: Env,
  assetId: string,
  payload: CaricatureOriginalCompleteInput,
) {
  return json(await completeCaricatureOriginalUpload(db(env), env, assetId, payload))
}

export async function queueCaricaturePreviewsService(
  env: Env,
  assetId: string,
  actorStaffId: string | null,
  executionCtx?: ExecutionContext,
) {
  const result = await enqueueCaricaturePreviewJob(
    db(env),
    env,
    { assetId, staffMemberId: actorStaffId, publishOnSuccess: false },
    executionCtx,
  )
  return json({
    ...result,
    message: "Preview generation queued. Processing starts automatically.",
  })
}

export async function approveCaricatureAssetService(
  env: Env,
  assetId: string,
  actorStaffId: string | null,
  executionCtx?: ExecutionContext,
) {
  const result = await approveCaricatureForPublish(db(env), env, assetId, actorStaffId, executionCtx)
  return json({
    ...result,
    message: result.alreadyQueued
      ? "Caricature publish is already queued. Processing continues automatically."
      : "Caricature approved. Blurred previews and search indexing will run automatically.",
  })
}

export async function rejectCaricatureAssetService(
  env: Env,
  assetId: string,
  actorStaffId: string | null,
) {
  return json(await rejectCaricatureAsset(db(env), assetId, actorStaffId))
}

export async function getAdminCaricatureOriginalService(env: Env, assetId: string) {
  return await getAdminCaricatureOriginalResponse(db(env), env, assetId)
}
