import { and, eq, inArray } from "drizzle-orm"

import type { Env } from "../../appTypes"
import type { DrizzleClient } from "../../db"
import { imageAssets } from "../../db/schema/image-assets"
import { imagePreviewRegenerationJobs } from "../../db/schema/image-preview-regeneration-jobs"
import { AppError } from "../errors"
import { schedulePublishDrainWebhook } from "../jobs/publish-drain-webhook"
import { resolvePreviewObjectId } from "../media/preview-object-id"

export interface EnqueueImagePreviewRegenerationInput {
  assetId: string
  staffMemberId: string | null
}

export interface EnqueueImagePreviewRegenerationResult {
  ok: true
  jobId: string
  assetId: string
  alreadyQueued: boolean
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function assertImagePreviewRegenerationEligible(db: DrizzleClient, assetId: string) {
  if (!isUuid(assetId)) {
    throw new AppError(400, "INVALID_ASSET_ID", "Asset id is invalid.")
  }

  const rows = await db
    .select({
      id: imageAssets.id,
      mediaType: imageAssets.mediaType,
      legacyImageCode: imageAssets.legacyImageCode,
      originalStorageKey: imageAssets.originalStorageKey,
      originalExistsInStorage: imageAssets.originalExistsInStorage,
    })
    .from(imageAssets)
    .where(eq(imageAssets.id, assetId))
    .limit(1)

  const asset = rows[0]
  if (!asset) {
    throw new AppError(404, "ASSET_NOT_FOUND", "Asset was not found.")
  }
  if (asset.mediaType !== "IMAGE") {
    throw new AppError(409, "PREVIEW_NOT_AVAILABLE", "Preview is not available for this asset.")
  }
  if (!asset.originalExistsInStorage || !asset.originalStorageKey?.trim()) {
    throw new AppError(409, "ORIGINAL_NOT_AVAILABLE", "Original image is not available.")
  }

  resolvePreviewObjectId({
    assetId: asset.id,
    legacyImageCode: asset.legacyImageCode,
    originalStorageKey: asset.originalStorageKey,
  })

  return asset
}

export async function enqueueImagePreviewRegeneration(
  db: DrizzleClient,
  env: Env,
  input: EnqueueImagePreviewRegenerationInput,
  executionCtx?: ExecutionContext,
): Promise<EnqueueImagePreviewRegenerationResult> {
  await assertImagePreviewRegenerationEligible(db, input.assetId)

  const activeJob = await db
    .select({ id: imagePreviewRegenerationJobs.id })
    .from(imagePreviewRegenerationJobs)
    .where(
      and(
        eq(imagePreviewRegenerationJobs.imageAssetId, input.assetId),
        inArray(imagePreviewRegenerationJobs.status, ["QUEUED", "RUNNING"]),
      ),
    )
    .limit(1)

  if (activeJob[0]) {
    schedulePublishDrainWebhook(
      env,
      { publishJobId: activeJob[0].id, approvedCount: 1 },
      executionCtx,
    )
    return {
      ok: true,
      jobId: activeJob[0].id,
      assetId: input.assetId,
      alreadyQueued: true,
    }
  }

  const [created] = await db
    .insert(imagePreviewRegenerationJobs)
    .values({
      imageAssetId: input.assetId,
      status: "QUEUED",
      requestedByStaffId: input.staffMemberId,
    })
    .returning({ id: imagePreviewRegenerationJobs.id })

  schedulePublishDrainWebhook(
    env,
    { publishJobId: created.id, approvedCount: 1 },
    executionCtx,
  )

  return {
    ok: true,
    jobId: created.id,
    assetId: input.assetId,
    alreadyQueued: false,
  }
}
